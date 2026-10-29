import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };
function fixture(fetch) {
 const storage=new Map([['ws_auth_token','access'],['ws_auth_refresh_token','refresh']]);
 const context={window:{setInterval(){},addEventListener(){},dispatchEvent(){}},document:{addEventListener(){}},Event,console,fetch,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 context.window.WSSessionStorage = context.localStorage;
 vm.runInNewContext(fs.readFileSync(new URL('../webshop-auth-api.jsx',import.meta.url),'utf8'),context);
 const api=context.window.WSAuth;api.endpoint='/auth';return {api,storage};
}
test('logout clears both tokens before API completes and sends the captured refresh token',async()=>{
 const response=deferred(); let request;
 const {api,storage}=fixture((url,options)=>{request={url,options};return response.promise;});
 const logout=api.logout();
 assert.equal(storage.size,0);
 assert.equal(request.url,'/auth/logout');
 assert.equal(JSON.parse(request.options.body).refresh_token,'refresh');
 assert.equal(request.options.keepalive,true);
 assert.equal(await api.me(),null);
 response.resolve({ok:true});await logout;
});
test('network failure cannot prevent local logout',async()=>{
 const {api,storage}=fixture(async()=>{throw new Error('offline');});
 await api.logout();assert.equal(storage.size,0);assert.equal(await api.me(),null);
});
test('in-flight token refresh cannot restore a logged-out session',async()=>{
 const response=deferred();
 const {api,storage}=fixture(url=>url.endsWith('/refresh')?response.promise:Promise.resolve({ok:true}));
 const refresh=api.refresh();await api.logout();
 response.resolve({ok:true,json:async()=>({access_token:'new-access',refresh_token:'new-refresh'})});
 assert.equal(await refresh,false);assert.equal(storage.size,0);
});
test('in-flight profile response cannot restore a logged-out user',async()=>{
 const body=deferred();
 const {api}=fixture(async url=>url.endsWith('/me')?{ok:true,json:()=>body.promise}:{ok:true});
 const profile=api.me();await Promise.resolve();await api.logout();
 body.resolve({user:{id:7}});assert.equal(await profile,null);
});
