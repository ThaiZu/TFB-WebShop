import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { createGa4Adapter, sanitizeGa4Event } from '../webshop-ga4.js';
function fixture() {
 const storage = new Map(), scripts = [];
 const w = { sessionStorage: {getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;}} };
 const doc = {createElement(){return {remove(){this.removed=true;}};},head:{appendChild(s){scripts.push(s);}}};
 let allowed = true;
 const controller = new AbortController();
 const ctx = {id:'G-TEST123',signal:controller.signal,isAllowed:()=>allowed};
 const adapter = createGa4Adapter(w,doc);
 return {w,doc,storage,scripts,ctx,adapter,disable(){allowed=false;controller.abort();},commands:()=>Array.from(w.wsGa4Layer||[],v=>Array.from(v))};
}
const event = {items:[{item_id:'11',quantity:1,price:10}],value:10,transaction_id:'WEB-2-20261027-ABCDEF'};
test('loads only on start, drops events during load, disables advertising and sanitizes metadata',()=>{
 const f=fixture();f.adapter.track('purchase',event);assert.equal(f.scripts.length,0);
 f.adapter.start(f.ctx);assert.equal(f.scripts.length,1);assert.equal(f.scripts[0].referrerPolicy,'no-referrer');
 assert.equal(f.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-TEST123&l=wsGa4Layer');
 f.adapter.track('add_to_cart',event);assert.equal(f.commands().filter(c=>c[0]==='event').length,0);
 const config=f.commands().find(c=>c[0]==='config')[2];assert.equal(config.send_page_view,false);assert.equal(config.page_referrer,'');assert.equal(config.allow_google_signals,false);
 f.scripts[0].onload();assert.equal(f.commands().filter(c=>c[1]==='page_view').length,1);
 f.adapter.track('add_to_cart',{...event,email:'private@example.invalid',page_location:'https://example.invalid/?token=secret'});
 const sent=f.commands().at(-1);assert.equal(sent[2].send_to,'G-TEST123');assert.equal(JSON.stringify(sent).includes('secret'),false);assert.equal(JSON.stringify(sent).includes('@'),false);
});
test('withdrawal stops events, clears only optional storage, and regrant reuses a loaded script',()=>{
 const f=fixture();f.adapter.start(f.ctx);f.scripts[0].onload();f.adapter.track('purchase',event);
 f.storage.set('ws.pendingPay','keep');f.disable();f.adapter.stop();
 assert.equal(f.w['ga-disable-G-TEST123'],true);assert.equal(f.commands().length,0);assert.equal(f.storage.size,1);assert.equal(f.storage.get('ws.pendingPay'),'keep');
 f.adapter.track('purchase',event);assert.equal(f.commands().length,0);
 f.adapter.start({...f.ctx,signal:new AbortController().signal,isAllowed:()=>true});assert.equal(f.scripts.length,1);
});
test('cancelled load cannot send a late pageview and requires reload if interrupted',()=>{
 const f=fixture();f.adapter.start(f.ctx);f.disable();assert.throws(()=>f.adapter.stop(),/Reload required/);
 f.scripts[0].onload();assert.equal(f.commands().length,0);assert.equal(f.w['ga-disable-G-TEST123'],true);
});
test('purchase is deduplicated within a page and across reloads, never for pre-consent events',()=>{
 const f=fixture();f.adapter.track('purchase',event);assert.equal(f.storage.size,0);
 f.adapter.start(f.ctx);f.scripts[0].onload();f.adapter.track('purchase',event);f.adapter.track('purchase',event);
 assert.equal(f.commands().filter(c=>c[1]==='purchase').length,1);
 const next=createGa4Adapter(f.w,f.doc);next.start(f.ctx);f.scripts[1].onload();next.track('purchase',event);
 assert.equal(f.commands().filter(c=>c[1]==='purchase').length,1);
});
test('strict payload allowlist, numeric product IDs and confirmed monetary values',()=>{
 assert.equal(sanitizeGa4Event('purchase',{...event,value:undefined}),null);
 assert.equal(sanitizeGa4Event('purchase',{...event,transaction_id:'customer@example.invalid'}),null);
 assert.equal(sanitizeGa4Event('view_item',{items:[{item_id:'email@example.invalid',quantity:1}]}),null);
 assert.deepEqual(sanitizeGa4Event('add_to_cart',{...event,note:'secret',items:[{item_id:'11',quantity:1,name:'secret',token:'secret'}]}),{currency:'EUR',items:[{item_id:'11',quantity:1}],value:10});
});
test('runtime requires both a verified ID and explicit analytics consent',()=>{
 const f=fixture(),source=fs.readFileSync(new URL('../public/cookie-consent.js',import.meta.url),'utf8');
 f.w.localStorage={getItem:()=>null,setItem(){},removeItem(){}};f.w.addEventListener=()=>{};f.w.clearTimeout=()=>{};f.w.setTimeout=()=>1;
 vm.runInNewContext(source,{window:f.w,URL,Date,AbortController,Event});const api=f.w.WSConsent;
 api.register('ga4',f.adapter);api.save({analytics:true,advertising:false});assert.equal(f.scripts.length,0);
 const config={schemaVersion:1,scope:'atelierby',policyVersion:'atelierby-2026-01',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{ga4:{enabled:true,category:'analytics',id:null}}};
 api.configure(config);assert.equal(f.scripts.length,0);
 api.configure({...config,integrations:{ga4:{enabled:true,category:'analytics',id:'G-TEST123'}}});assert.equal(f.scripts.length,1);
 f.scripts[0].onload();api.reject();assert.equal(f.w['ga-disable-G-TEST123'],true);
});

test('a GA4 property switch requires reload rather than silently using the previous property',()=>{
 const f=fixture();f.adapter.start(f.ctx);f.scripts[0].onload();
 assert.throws(()=>f.adapter.start({...f.ctx,id:'G-SECOND'}),/Reload required/);
 assert.throws(()=>f.adapter.stop(),/Reload required/);assert.equal(f.w['ga-disable-G-TEST123'],true);
});
