import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../public/session-storage.js',import.meta.url),'utf8');
const MAX=43200000;
function storage(map=new Map()) {return {get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function fixture(local=new Map(),session=new Map()) {
 let now=100000000;const events={};
 const window={localStorage:storage(local),sessionStorage:storage(session),addEventListener:(name,fn)=>events[name]=fn};
 const ctx={window,Date:{now:()=>now}};vm.runInNewContext(code,ctx);
 return {window,api:window.WSSessionStorage,events,ctx,advance:ms=>now+=ms,local,session};
}
test('upgrade deletes only known legacy personal keys, preserving consent and other apps',()=>{
 const local=new Map([['ws_auth_token','secret'],['ws.customer','personal'],['ws.deliveryPreference:7:2','office'],['ws.consent','choice'],['other-app','keep']]);
 fixture(local);assert.deepEqual([...local],[['ws.consent','choice'],['other-app','keep']]);
});
test('reload and payment navigation retain session; independent tab does not; expiry is not extended by reads',()=>{
 const f=fixture();f.api.setItem('ws_auth_token','access');f.api.setItem('ws.customer','profile');
 vm.runInNewContext(code,f.ctx);assert.equal(f.window.WSSessionStorage.getItem('ws_auth_token'),'access');
 assert.equal(fixture().api.getItem('ws_auth_token'),null);
 f.advance(MAX-1);assert.equal(f.api.getItem('ws.customer'),'profile');
 f.advance(1);f.events.pageshow();assert.equal(f.api.getItem('ws_auth_token'),null);assert.equal(f.session.size,0);
});
test('corrupt, future and unbounded restored records are removed',()=>{
 const f=fixture();for(const raw of ['broken',JSON.stringify({value:'x',createdAt:200000000,expiresAt:243200000}),JSON.stringify({value:'x',createdAt:100000000,expiresAt:Infinity})]) {
 f.session.set('ws.session.v1:ws.customer',raw);assert.equal(f.api.getItem('ws.customer'),null);assert.equal(f.session.size,0);
 }
});
test('blocked storage uses memory, never writes permanent storage, and still expires',()=>{
 const f=fixture();f.window.sessionStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 f.api.setItem('ws_auth_token','access');assert.equal(f.api.getItem('ws_auth_token'),'access');assert.equal(f.local.size,0);
 f.advance(MAX);assert.equal(f.api.getItem('ws_auth_token'),null);
});
test('logout clears customer-scoped preferences but retains language and shop',()=>{
 const f=fixture();for(const key of ['ws.customer','ws.deliveryPreference:7:2','ws.accountTab','ws.lang','ws.activeShop']) f.api.setItem(key,'value');
 f.api.clearCustomer();assert.equal(f.api.getItem('ws.customer'),null);assert.equal(f.api.getItem('ws.deliveryPreference:7:2'),null);assert.equal(f.api.getItem('ws.accountTab'),null);assert.equal(f.api.getItem('ws.lang'),'value');assert.equal(f.api.getItem('ws.activeShop'),'value');
});
