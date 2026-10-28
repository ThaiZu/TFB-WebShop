import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../public/cookie-consent.js', import.meta.url), 'utf8');
const readyConfig = () => ({ schemaVersion: 1, scope: 'atelierby', policyVersion: 'atelierby-2026-01',
 consentMode: 'basic', choiceLifetimeMonths: 6, status: 'ready', policies: {}, integrations: {
 ga4: { enabled: true, category: 'analytics', id: 'G-TEST123' },
 googleAds: { enabled: true, category: 'advertising', id: 'AW-123' },
 meta: { enabled: true, category: 'advertising', id: '123' } } });
function boot({ initial, blocked = false, configured = true, nowAt = Date.UTC(2026,9,26) } = {}) {
 let now = nowAt, timer;
 const cookieJar = new Map(), cookieWrites = [];
 const document = { get cookie(){return [...cookieJar].map(([k,v])=>k+'='+v).join('; ');},set cookie(value){cookieWrites.push(value);const name=value.split('=')[0];if(value.includes('Max-Age=0'))cookieJar.delete(name);} };
 const handlers = {}, store = new Map(initial ? [['ws.consent', JSON.stringify(initial)]] : []);
 class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
 const window = {document,location:{hostname:'webshop.atelierby.be',pathname:'/WebShop/catalogue/',protocol:'https:'},localStorage:{getItem(k){if(blocked)throw Error();return store.get(k)??null;},setItem(k,v){if(blocked)throw Error();store.set(k,v);},removeItem(k){if(blocked)throw Error();store.delete(k);}},addEventListener(k,fn){handlers[k]=fn;},dispatchEvent(){},setTimeout(fn,delay){timer={fn,delay};return 1;},clearTimeout(){}};
 vm.runInNewContext(source,{window,Date:Clock,Event:class{},URL,AbortController});
 if (configured) window.WSConsent.configure(readyConfig());
 return {api:window.WSConsent,store,cookieJar,cookieWrites,event:(k,e)=>handlers[k](e),advance(ms){now+=ms;timer.fn();}};
}
test('default denial, independent categories, no replay and effective withdrawal',()=>{
 const {api}=boot(),events=[];
 api.register('ga4',{category:'analytics',start:()=>events.push('start'),stop:()=>events.push('stop'),track:e=>events.push(e)});
 api.track('analytics','before');assert.deepEqual(events,[]);
 api.save({analytics:true,advertising:false});assert.equal(api.allows('advertising'),false);
 api.track('analytics','after');api.reject();api.track('analytics','denied');
 assert.deepEqual(events,['start','after','stop']);
});
test('reload and invalid/expired/versioned records',()=>{
 const b=boot();b.api.save({analytics:false,advertising:true});const r=JSON.parse(b.store.get('ws.consent'));
 assert.equal(boot({initial:r}).api.allows('advertising'),true);
 for(const patch of [{policy:'old'},{decidedAt:r.expiresAt},{expiresAt:r.decidedAt},{analytics:'yes'},{scope:'another-brand'}])assert.equal(boot({initial:{...r,...patch}}).api.get(),null);
});
test('expires after six months, not after maximum browser timeout',()=>{
 const b=boot();b.api.save({analytics:true,advertising:true});b.advance(2147483647);assert.equal(b.api.allows('analytics'),true);b.advance(200*86400000);assert.equal(b.api.get(),null);
});
test('blocked storage preserves explicit choice in memory; next visit denies',()=>{
 const {api}=boot({blocked:true});assert.equal(api.get(),null);assert.equal(api.save({analytics:true,advertising:false}).persisted,false);assert.equal(api.allows('analytics'),true);assert.equal(boot({blocked:true}).api.get(),null);assert.throws(()=>api.save({analytics:'yes',advertising:false}));
});
test('another tab clearing storage revokes active adapters',()=>{
 const b=boot();let stopped=0;b.api.register('googleAds',{category:'advertising',start(){},stop(){stopped++;}});b.api.save({analytics:false,advertising:true});b.store.clear();b.event('storage',{key:null});assert.equal(b.api.allows('advertising'),false);assert.equal(stopped,1);
});
test('HTML has no unconditional Google or Meta including noscript',()=>{
 for(const f of ['index.html','landing/b2b/evenements-b2b.html'])assert.doesNotMatch(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),/googletagmanager\.com|connect\.facebook\.net|facebook\.com\/tr/);
});

test('consent alone cannot activate an unconfigured, draft or malformed integration',()=>{
 const b=boot({configured:false});let starts=0,stops=0;
 b.api.register('ga4',{category:'analytics',start(){starts++;},stop(){stops++;}});
 b.api.save({analytics:true,advertising:false});assert.equal(starts,0);
 b.api.configure({...readyConfig(),status:'draft'});assert.equal(starts,0);
 const invalid=readyConfig();invalid.integrations.ga4.id='https://attacker.invalid/script.js';
 b.api.configure(invalid);assert.equal(starts,0);
 b.api.configure(readyConfig());assert.equal(starts,1);
 b.api.configure(null);assert.equal(stops,1);assert.equal(b.api.integrationAllowed('ga4'),false);
});
test('policy change requires a fresh choice, links are HTTPS-only and config is isolated',()=>{
 const b=boot();b.api.save({analytics:true,advertising:true});
 assert.equal(b.api.configure({...readyConfig(),policyVersion:'new'}),true);
 assert.equal(b.api.get(),null);
 b.api.save({analytics:true,advertising:true});
 assert.equal(b.api.get().policy,'new');
 const value=readyConfig();value.policies={fr:{privacyUrl:'javascript:alert(1)',cookiesUrl:'https://webshop.atelierby.be/cookies'}};
 b.api.configure(value);const config=b.api.configuration();
 assert.equal(config.policies.fr.privacyUrl,null);assert.equal(config.policies.fr.cookiesUrl,value.policies.fr.cookiesUrl);
 b.api.save({analytics:true,advertising:true});
 config.integrations.ga4.enabled=false;assert.equal(b.api.integrationAllowed('ga4'),true);
});

test('withdrawing only analytics aborts pending loads and preserves advertising and essential data',()=>{
 const b=boot(),contexts={},stops=[];
 for(const [id,category] of [['ga4','analytics'],['meta','advertising']])b.api.register(id,{category,start(ctx){contexts[id]=ctx;},stop(){stops.push(id);}});
 b.api.save({analytics:true,advertising:true});
 b.store.set('ws_auth_token','session');b.store.set('ws.order.token.WEB-1','guest');
 for(const name of ['_ga','_ga_TEST','_fbp','essential'])b.cookieJar.set(name,'value');
 b.api.save({analytics:false,advertising:true});
 assert.equal(contexts.ga4.signal.aborted,true);assert.equal(contexts.ga4.isAllowed(),false);
 assert.equal(contexts.meta.signal.aborted,false);assert.deepEqual(stops,['ga4']);
 assert.equal(b.cookieJar.has('_ga'),false);assert.equal(b.cookieJar.has('_fbp'),true);
 assert.equal(b.cookieJar.has('essential'),true);assert.equal(b.store.get('ws_auth_token'),'session');
 assert.equal(b.store.get('ws.order.token.WEB-1'),'guest');
 b.api.reject();assert.equal(b.cookieJar.has('_fbp'),false);
 assert.ok(b.cookieWrites.some(v=>v.includes('Domain=atelierby.be')));
 assert.ok(b.cookieWrites.some(v=>v.includes('Path=/WebShop/')));
});
test('new policy reopens choice; old stored choice cannot return on focus or reload',()=>{
 const b=boot();b.api.save({analytics:true,advertising:true});let empty=0;
 b.api.subscribe(value=>{if(value===null)empty++;});
 b.api.configure({...readyConfig(),policyVersion:'atelierby-2026-02'});
 assert.equal(b.api.get(),null);assert.ok(empty>0);assert.equal(b.store.has('ws.consent'),false);
 b.event('focus',{});assert.equal(b.api.get(),null);
 b.api.save({analytics:false,advertising:true});assert.equal(b.api.get().policy,'atelierby-2026-02');
});
test('month-end expiry clamps to February and removes only the expired choice',()=>{
 const b=boot({nowAt:Date.UTC(2026,7,31,12)});b.api.save({analytics:true,advertising:false});
 b.store.set('ws_auth_token','keep');assert.equal(b.api.get().expiresAt,Date.UTC(2027,1,28,12));
 b.advance(200*86400000);assert.equal(b.api.get(),null);assert.equal(b.store.has('ws.consent'),false);assert.equal(b.store.get('ws_auth_token'),'keep');
});
test('stop failure disables dispatch and requires review/reload instead of restarting the adapter',()=>{
 const b=boot();let started=0,tracked=0;
 b.api.register('ga4',{category:'analytics',start(){started++;},stop(){throw Error('failed');},track(){tracked++;}});
 b.api.save({analytics:true,advertising:false});b.api.reject();
 assert.equal(b.api.status().reloadRequired,true);
 b.api.save({analytics:true,advertising:false});b.api.track('analytics','purchase',{});
 assert.equal(started,1);assert.equal(tracked,0);
});
test('changing measurement identity aborts the previous loader before starting a new one',()=>{
 const b=boot(),contexts=[];
 b.api.register('ga4',{category:'analytics',start(ctx){contexts.push(ctx);},stop(){}});
 b.api.save({analytics:true,advertising:false});const next=readyConfig();next.integrations.ga4.id='G-SECOND';b.api.configure(next);
 assert.equal(contexts.length,2);assert.equal(contexts[0].signal.aborted,true);assert.equal(contexts[0].isAllowed(),false);assert.equal(contexts[1].id,'G-SECOND');
});

test('a choice for the current server policy survives subsequent page loads',()=>{
 const b=boot();const cfg={...readyConfig(),policyVersion:'atelierby-2026-02'};
 b.api.configure(cfg);b.api.save({analytics:true,advertising:false});
 const next=boot({initial:b.api.get(),configured:false});next.api.configure(cfg);
 assert.equal(next.api.get().policy,'atelierby-2026-02');assert.equal(next.api.integrationAllowed('ga4'),true);
});
test('disabled provider cookies are removed without deleting another allowed provider',()=>{
 const b=boot();b.api.save({analytics:true,advertising:true});
 b.cookieJar.set('_gcl_au','ads');b.cookieJar.set('_fbp','meta');b.cookieJar.set('_ga','analytics');
 const config=readyConfig();config.integrations.meta.enabled=false;b.api.configure(config);
 assert.equal(b.cookieJar.has('_fbp'),false);assert.equal(b.cookieJar.has('_gcl_au'),true);assert.equal(b.cookieJar.has('_ga'),true);
});
test('sessionStorage changes cannot accidentally revoke the local consent record',()=>{
 const b=boot();b.api.save({analytics:true,advertising:false});
 const stored=b.store.get('ws.consent');b.event('storage',{key:'ws.consent',storageArea:{}});
 assert.equal(b.store.get('ws.consent'),stored);assert.equal(b.api.allows('analytics'),true);
});

test('rejected asynchronous start is stopped and cannot leave a tracking channel active',async()=>{
 const b=boot();let stopped=0,tracked=0;
 b.api.register('ga4',{category:'analytics',start(){return Promise.reject(Error('loader'));},stop(){stopped++;},track(){tracked++;}});
 b.api.save({analytics:true,advertising:false});await new Promise(resolve=>setImmediate(resolve));
 b.api.track('analytics','purchase',{});assert.equal(stopped,1);assert.equal(tracked,0);
});
test('expiry aborts an active adapter and does not delete purchase recovery',()=>{
 const b=boot();let signal,stopped=0;
 b.api.register('ga4',{category:'analytics',start(ctx){signal=ctx.signal;},stop(){stopped++;}});
 b.api.save({analytics:true,advertising:false});b.store.set('ws.pendingPay','order');
 b.advance(200*86400000);assert.equal(signal.aborted,true);assert.equal(stopped,1);
 assert.equal(b.store.get('ws.pendingPay'),'order');assert.equal(b.api.get(),null);
});

test('an expired record from a closed tab is physically pruned once server policy is known',()=>{
 const b=boot();b.api.save({analytics:true,advertising:false});const record=b.api.get();
 const next=boot({initial:record,nowAt:record.expiresAt+1});
 assert.equal(next.api.get(),null);assert.equal(next.store.has('ws.consent'),false);
});

test('unverified or malformed contacts are never exposed as active banner links',()=>{
 const b=boot();b.api.configure({...readyConfig(),contact:{email:'webshop@atelierby.be',verified:false}});
 assert.equal(b.api.configuration().contact,null);
 b.api.configure({...readyConfig(),contact:{email:'webshop@atelierby.be?body=bad',verified:true}});assert.equal(b.api.configuration().contact,null);
 b.api.configure({...readyConfig(),contact:{email:'webshop@atelierby.be',verified:true}});assert.equal(b.api.configuration().contact.email,'webshop@atelierby.be');
});

test('controller notices require confirmed roles and bounded translated text',()=>{
 const {api}=boot();const config={...readyConfig(),controllerNotice:{pl:'  Confirmed controller  ',fr:'x'.repeat(1001),nl:7}};
 api.configure(config);assert.equal(api.configuration().controllerNotice.pl,undefined);
 api.configure({...config,controllerRolesConfirmed:true});assert.equal(api.configuration().controllerNotice.pl,'Confirmed controller');assert.equal(api.configuration().controllerNotice.fr,undefined);assert.equal(api.configuration().controllerNotice.nl,undefined);
});
