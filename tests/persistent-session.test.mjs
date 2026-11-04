import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const authCode=fs.readFileSync(new URL('../webshop-auth-api.jsx',import.meta.url),'utf8');
const storageCode=fs.readFileSync(new URL('../public/session-storage.js',import.meta.url),'utf8');
const shopCode=fs.readFileSync(new URL('../webshop-shop-router.jsx',import.meta.url),'utf8');
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
const store=map=>({get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
function page(local=new Map(),handler) {
 const session=new Map(),events={},calls=[];let now=100000000;
 const window={location:{search:''},localStorage:store(local),sessionStorage:store(session),addEventListener:(k,v)=>events[k]=v,setInterval(){},dispatchEvent(){}};
 const ctx={window,document:{addEventListener(){}},navigator:{},URLSearchParams,Event,Date:{now:()=>now},console,
  atob:value=>Buffer.from(value,'base64').toString(),fetch:async(url,options)=>{calls.push({url,options});return handler?.(url,options)??response({access_token:'access',session_transport:'cookie'});}};
 vm.runInNewContext(storageCode,ctx);vm.runInNewContext(authCode,ctx);vm.runInNewContext(shopCode,ctx);
 window.WSAuth.endpoint='/api/v1/clients/auth';
 return {window,session,local,calls,events,advance:ms=>now+=ms};
}
test('returning page restores authentication using only HttpOnly cookie transport',async()=>{
 const first=page();assert.equal(await first.window.WSAuth.ensureFreshSession(),true);
 assert.equal(first.calls[0].url,'/api/v1/clients/auth/refresh');
 assert.equal(first.calls[0].options.credentials,'include');
 assert.equal(first.calls[0].options.headers['X-Webshop-Session'],'cookie');
 assert.deepEqual(JSON.parse(first.calls[0].options.body),{});
 assert.equal(first.session.size,0);assert.equal(first.local.size,0);
 const reopened=page(first.local);assert.equal(await reopened.window.WSAuth.ensureFreshSession(),true);
 assert.equal(reopened.calls.length,1);
});
test('offline logout remains logged out after reopening and retains the remembered shop',async()=>{
 const local=new Map();const first=page(local,()=>{throw Error('offline');});
 first.window.WSShopRouter.setActive('4');await first.window.WSAuth.logout();
 const reopened=page(local);assert.equal(reopened.window.WSShopRouter.current(),'4');
 assert.equal(await reopened.window.WSAuth.ensureFreshSession(),false);assert.equal(reopened.calls.length,0);
});
test('shop survives a fresh tab for 60 days and expires at its deadline',()=>{
 const local=new Map();const first=page(local);first.window.WSShopRouter.setActive('4');
 const reopened=page(local);assert.equal(reopened.window.WSShopRouter.current(),'4');
 reopened.advance(60*24*60*60*1000-1);assert.equal(reopened.window.WSSessionStorage.getItem('ws.activeShop'),'4');
 reopened.advance(1);assert.equal(reopened.window.WSSessionStorage.getItem('ws.activeShop'),null);
});
test('customer profile is never persisted and corrupt remembered shops are discarded',()=>{
 const f=page();f.window.WSSessionStorage.setItem('ws.customer','private');
 assert.equal(f.session.size,0);assert.equal(f.local.size,0);
 assert.equal(f.window.WSSessionStorage.getItem('ws.customer'),'private');
 f.local.set('ws.preference.v1:ws.activeShop','broken');assert.equal(f.window.WSSessionStorage.getItem('ws.activeShop'),null);
});

test('existing tab refresh token is exchanged for a cookie before its valid access token is used',async()=>{
 const local=new Map(),session=new Map();let request;
 const ctx={window:{WSSessionStorage:{getItem:key=>key==='ws_auth_token'?'old-access':key==='ws_auth_refresh_token'?'legacy-refresh':null,removeItem(){}},setInterval(){},addEventListener(){},dispatchEvent(){}},document:{addEventListener(){}},navigator:{},Event,console,
  fetch:async(url,options)=>{request={url,options};return response({access_token:'new-access',session_transport:'cookie'});}};
 vm.runInNewContext(authCode,ctx);ctx.window.WSAuth.endpoint='/api/v1/clients/auth';
 assert.equal(await ctx.window.WSAuth.ensureFreshSession(),true);
 assert.equal(request.url,'/api/v1/clients/auth/refresh');assert.equal(JSON.parse(request.options.body).refresh_token,'legacy-refresh');
 assert.equal(ctx.window.WSAuth.authHeaders().Authorization,'Bearer new-access');
});
