const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const store = new Map([['ws_auth_token','old'],['ws_auth_refresh_token','refresh']]);
let refreshes=0, requests=0, rejectRefresh=false, timer;
const context={atob:value=>Buffer.from(value,'base64').toString(),document:{visibilityState:'visible',addEventListener(){}},window:{setInterval:fn=>{timer=fn;},addEventListener(){}},localStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},fetch:async(url,options)=>{
  if(url.endsWith('/refresh')) {
    refreshes++;
    await new Promise(resolve=>setTimeout(resolve,10));
    return {ok:!rejectRefresh,status:rejectRefresh?401:200,json:async()=>rejectRefresh?{}:{access_token:'new',refresh_token:'rotated'}};
  }
  requests++;
  const ok=options.headers.Authorization==='Bearer new';
  return {ok,status:ok?200:401};
}};
context.window.WSSessionStorage = context.localStorage;
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../webshop-auth-api.jsx'),'utf8'),context);
const auth=context.window.WSAuth;auth.endpoint='/auth';
(async()=>{
 const results=await Promise.all(Array.from({length:5},()=>auth.authenticatedFetch('/catalog')));
 assert.ok(results.every(result=>result.ok));assert.equal(refreshes,1);assert.equal(requests,10);
 const expiring = 'header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+60})).toString('base64url')+'.signature';
 store.set('ws_auth_token',expiring);
 timer();
 await auth.ensureFreshSession();
 assert.equal(refreshes,2);assert.equal(store.get('ws_auth_token'),'new');
 store.set('ws_auth_token',expiring);
 const before=requests;
 assert.equal((await auth.authenticatedFetch('/catalog')).ok,true);
 assert.equal(requests,before+1);assert.equal(refreshes,3);
 store.set('ws_auth_token','expired');rejectRefresh=true;
 const result=await auth.authenticatedFetch('/catalog');
 assert.equal(result.status,401);assert.equal(refreshes,4);assert.equal(store.get('ws_auth_token'),undefined);
 console.log('PASS: concurrent 401, background refresh, proactive refresh before request, invalid refresh without looping');
})().catch(error=>{console.error(error);process.exitCode=1;});
