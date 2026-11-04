import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../webshop-auth-api.jsx', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
const response = (data, status = 200) => ({ok:status >= 200 && status < 300, status, json:async()=>data});
const pair = name => ({access_token:`access-${name}`,session_transport:'cookie'});
const credentials = name => ({identifier:`${name}@example.invalid`,password:'test-password'});
function fixture(handler, signedIn = true) {
  const store = new Map(signedIn ? [['ws_auth_token','access-A']] : []);
  const calls = [], events = [];
  let cleared = 0;
  const context = {
    window:{setInterval(){},addEventListener(){},dispatchEvent(event){events.push(event.type);}},
    document:{addEventListener(){}}, navigator:{language:'pl'}, Event, console,
    atob:value=>Buffer.from(value,'base64').toString(),
    fetch:async(url,options={})=>{
      calls.push({url,options});
      if (handler) { const result = handler(url,options); if (result !== undefined) return result; }
      if (url.endsWith('/login')) return response(pair('B'));
      if (url.endsWith('/me')) return response({user:{id:options.headers.Authorization === 'Bearer access-A' ? 1 : 2}});
      if (url.endsWith('/logout')) return response({ok:true});
      throw Error(`Unexpected request: ${url}`);
    },
  };
  context.window.WSSessionStorage = {
    getItem:key=>store.get(key) ?? null, setItem:(key,value)=>store.set(key,value), removeItem:key=>store.delete(key),
    clearCustomer(){cleared++;},
  };
  vm.runInNewContext(source, context);
  const auth = context.window.WSAuth; auth.endpoint='/clients/auth';
  return {auth,store,calls,events,get cleared(){return cleared;}};
}

test('Fidelity uses central login and /me with the token pair, without ending guest checkout', async () => {
  const f = fixture(null,false);
  const result = await f.auth.login(credentials('B'));
  assert.equal(result.ok,true); assert.equal(result.user.id,2);
  assert.equal(f.calls[0].url,'/clients/auth/login');
  assert.deepEqual(JSON.parse(f.calls[0].options.body),{login:'B@example.invalid',password:'test-password'});
  assert.equal(f.calls[0].options.headers.Authorization,undefined);
  assert.equal(f.calls[1].url,'/clients/auth/me');
  assert.equal(f.calls[1].options.headers.Authorization,'Bearer access-B');
  assert.equal(f.store.get('ws_auth_refresh_token'),undefined);
  assert.equal(f.events.includes('ws:session-ended'),false);
});

test('legacy single token and malformed token pairs cannot open or mix sessions', async () => {
  for (const payload of [{token:'legacy',user:{id:99}},{access_token:'new'}, {access_token:{},refresh_token:'new'}, {access_token:' ',refresh_token:'new'}]) {
    const f=fixture(url=>url.endsWith('/login')?response(payload):undefined);
    assert.equal((await f.auth.login(credentials('B'))).ok,false);
    assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-A');
    assert.equal(f.store.get('ws_auth_refresh_token'),undefined);
    assert.equal(f.calls.length,1);
  }
});

test('late login after logout is discarded and its newly issued refresh token is revoked', async () => {
  const pending=deferred();
  const f=fixture(url=>url.endsWith('/login')?pending.promise:undefined,false);
  const login=f.auth.login(credentials('B'));
  const logout=f.auth.logout();
  pending.resolve(response(pair('B')));
  await logout;
  assert.equal((await login).ok,false); assert.equal(f.store.size,0);
  assert.ok(f.calls.filter(c=>c.url.endsWith('/logout')).every(c=>!JSON.parse(c.options.body).refresh_token));
});

test('only the most recent of two login attempts can establish the session', async () => {
  const first=deferred(),second=deferred();
  const f=fixture((url,o)=>url.endsWith('/login')?(JSON.parse(o.body).login.startsWith('A')?first.promise:second.promise):undefined,false);
  const a=f.auth.login(credentials('A')); const b=f.auth.login(credentials('B'));
  first.resolve(response(pair('A'))); assert.equal((await a).ok,false);
  second.resolve(response(pair('B'))); assert.equal((await b).user.id,2);
  assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-B');
  assert.equal(f.store.get('ws_auth_refresh_token'),undefined);
});

test('late profile body for customer A is not delivered after customer B signs in', async () => {
  const body=deferred(),started=deferred();
  const f=fixture((url,o)=>{
    if (url.endsWith('/me') && o.headers.Authorization==='Bearer access-A') return {ok:true,status:200,json(){started.resolve();return body.promise;}};
  });
  const old=f.auth.me(); await started.promise;
  assert.equal((await f.auth.login(credentials('B'))).user.id,2);
  body.resolve({user:{id:1,firstName:'Private A'}});
  assert.equal(await old,null); assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-B');
  assert.equal(f.events.filter(e=>e==='ws:session-ended').length,1);
});

test('late rejection for A does not clear B or replay A request under B credentials', async () => {
  const pending=deferred(),started=deferred();
  const f=fixture((url,o)=>{
    if(url.endsWith('/me') && o.headers.Authorization==='Bearer access-A'){started.resolve();return pending.promise;}
  });
  const old=f.auth.me(); await started.promise;
  await f.auth.login(credentials('B'));
  pending.resolve(response({},401)); assert.equal(await old,null);
  assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-B');
  assert.equal(f.calls.filter(c=>c.url.endsWith('/refresh')).length,0);
  assert.equal(f.calls.filter(c=>c.url.endsWith('/me')).length,2);
});

test('profile PATCH from A is never retried with B credentials', async () => {
  const pending=deferred(),started=deferred();
  const f=fixture((url,o)=>{
    if(o.method==='PATCH'){started.resolve();return pending.promise;}
  });
  const write=f.auth.updateMe({firstName:'A'}); await started.promise;
  await f.auth.login(credentials('B'));
  pending.resolve(response({},401)); assert.equal((await write).ok,false);
  assert.equal(f.calls.filter(c=>c.options.method==='PATCH').length,1);
  assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-B');
});

test('account JSON transport discards a delayed Fidelity body after logout', async () => {
  const body=deferred(),started=deferred();
  const f=fixture(url=>{
    if(url.includes('/loyalty/')) return {ok:true,status:200,json(){started.resolve();return body.promise;}};
  });
  // Transport fixture only: the actual card read endpoint belongs to FID-07.
  const read=f.auth.authenticatedJson('/webshop/loyalty/cards?shopId=1');
  const rejected=assert.rejects(read,e=>e.code==='SESSION_CHANGED');
  await started.promise; await f.auth.logout();
  body.resolve({cards:[{balance:8}]}); await rejected;
  assert.equal(f.calls[0].options.headers.Authorization,'Bearer access-A');
  assert.equal(f.calls[0].url.includes('clientId'),false);
});

test('all profile-returning mutations discard late customer A responses', async () => {
  for (const [method,args,path] of [
    ['updateMe',{firstName:'A'},'/me'], ['billingVerify',{vat:'BE123'},'/billing-verify'],
    ['setOfficeSite',1,'/office'], ['addCompanyNoVat',{name:'A'},'/billing-company'],
    ['unlinkCompany',undefined,'/billing-company/unlink'],
  ]) {
    const body=deferred(),started=deferred();
    const f=fixture((url,o)=>{
      if(url.endsWith(path) && ['POST','PATCH'].includes(o.method))return {ok:true,status:200,json(){started.resolve();return body.promise;}};
    });
    const write=f.auth[method](args); await started.promise;
    await f.auth.login(credentials('B'));
    body.resolve({ok:true,valid:true,user:{id:1}});
    assert.equal((await write).ok,false,method);
    assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-B',method);
  }
});

test('a delayed refresh rejection cannot end the newly accepted session', async () => {
  const pending=deferred();
  const f=fixture(url=>url.endsWith('/refresh')?pending.promise:undefined);
  const refresh=f.auth.refresh();
  const login=f.auth.login(credentials('B'));
  pending.resolve(response({},401)); await refresh; await login;
  assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-B');
  assert.equal(f.events.filter(e=>e==='ws:session-ended').length,1);
});

test('successful refresh arriving after logout is revoked, without restoring the session', async () => {
  const pending=deferred();
  const f=fixture(url=>url.endsWith('/refresh')?pending.promise:undefined);
  const refresh=f.auth.refresh();
  await Promise.resolve(); await Promise.resolve();
  const logout=f.auth.logout();
  pending.resolve(response(pair('rotated')));
  await logout;
  assert.equal(await refresh,false); assert.equal(f.store.size,0);
  assert.ok(f.calls.some(c=>c.url.endsWith('/logout')));
});

test('transient refresh failures preserve identity while rejected refresh clears account views', async () => {
  for (const status of [401,403,503]) {
    const f=fixture(url=>url.endsWith('/refresh')?response({},status):undefined);
    assert.equal(await f.auth.refresh(),false);
    assert.equal(Boolean(f.auth.authHeaders().Authorization),status===503);
    assert.equal(f.events.includes('ws:session-ended'),status!==503);
  }
  const f=fixture(url=>{if(url.endsWith('/refresh'))throw Error('offline');});
  assert.equal(await f.auth.refresh(),false); assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-A');
  assert.equal(f.events.length,0);
});

test('a rejected cookie restoration ends the session and does not retry on every timer tick', async () => {
  const f=fixture(url=>url.endsWith('/refresh')?response({},401):undefined,false);
  assert.equal(await f.auth.ensureFreshSession(),false);
  assert.equal(await f.auth.ensureFreshSession(),false);
  assert.equal(f.calls.length,1);
});

test('rotation does not end the account session or discard an in-flight profile', async () => {
  const body=deferred(),started=deferred();
  const f=fixture(url=>{
    if(url.endsWith('/refresh'))return response(pair('rotated'));
    if(url.endsWith('/me'))return {ok:true,status:200,json(){started.resolve();return body.promise;}};
  });
  const profile=f.auth.me(); await started.promise; await f.auth.refresh();
  body.resolve({user:{id:1}});
  assert.equal((await profile).id,1); assert.equal(f.events.length,0);
});

test('legacy PWA handoff and unverified set-password do not create a second authentication path', async () => {
  const f=fixture();
  assert.equal((await f.auth.handoff('prototype-token')).ok,false);
  assert.equal((await f.auth.setPassword({email:'a@example.invalid',password:'new'})).ok,false);
  assert.equal(f.calls.length,0); assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-A');
});

test('a malformed profile write response is an error, never a replacement customer', async () => {
  for (const reply of [response({}), {ok:true,status:200,json:async()=>{throw Error('HTML body');}}]) {
    const f=fixture((url,o)=>o.method==='PATCH'?reply:undefined);
    assert.equal((await f.auth.updateMe({firstName:'A'})).ok,false);
    assert.equal(f.auth.authHeaders().Authorization?.replace('Bearer ',''),'access-A');
  }
});
