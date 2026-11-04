import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loyaltyPreview,loyaltyLineKey} from '../webshop-loyalty-preview.js';
const card={id:1,name:'Pain',required:10,before:8,increment:3,after:1,newRewards:1,remaining:9,pendingEvents:2};
const preview=()=>({status:'available',cards:[{...card}],lines:[{lineKey:'web-a',cardId:1,increment:2},{lineKey:'web-b',cardId:1,increment:1}]});
test('multiple lines share one server estimate with pending events kept separate',()=>{assert.equal(loyaltyPreview(preview()).cards[0].after,1);});
test('missing malformed and inconsistent estimates do not become zero balances',()=>{
 for(const data of [null,{}, {...preview(),cards:[{...card,before:null}]},{...preview(),cards:[{...card,after:0}]},{...preview(),lines:[]},{...preview(),cards:[card,card]}])
  assert.equal(loyaltyPreview(data).status,'unavailable');
});
test('guest cannot display personal balance',()=>{
 const p=preview();p.status='signIn';assert.equal(loyaltyPreview(p).status,'unavailable');
 for(const key of ['before','after','newRewards','remaining','pendingEvents'])p.cards[0][key]=null;
 assert.equal(loyaltyPreview(p).status,'signIn');
});
test('negative balance is a debt and cannot fabricate a reward',()=>{
 const p=preview();Object.assign(p.cards[0],{before:-5,after:-2,newRewards:0,remaining:12});
 assert.equal(loyaltyPreview(p).cards[0].after,-2);
});
test('line mapping agrees with existing WebShop quote keys',()=>{
 assert.equal(loyaltyLineKey({line:'promotion:17_a'}),'web-promotion-17-a');
 assert.equal(loyaltyLineKey({},4),'web-4');
});

test('loyalty quote uses session-bound JSON and sends no client identity',async()=>{
 const fs=await import('node:fs'),vm=await import('node:vm');
 const {normaliseShoppingContext,basketShoppingContext}=await import('../webshop-office-context.js');
 let request;
 const window={WSAuth:{authHeaders:()=>({Authorization:'Bearer test'}),authenticatedJson:async(url,options)=>{
   request=options;return {response:{ok:true},data:{items:[{line_key:'web-a',total_gross_value_after_discount:'6.00'}],totals:{gross_before_discount:'6.00',gross_after_discount:'6.00',discount:'0.00'},loyalty_preview:preview()}};
 }}};
 vm.runInNewContext(fs.readFileSync(new URL('../webshop-quote-api.jsx',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,''),{window,normaliseShoppingContext,basketShoppingContext});
 window.WSQuote.endpoint='https://api.example.invalid/quote';
 const result=await window.WSQuote.quote({shopId:2,basket:[{line:'a',productId:11,qty:3}],includeLoyalty:true});
 const payload=JSON.parse(request.body);assert.equal(payload.include_loyalty,true);assert.equal(payload.id_client,undefined);assert.equal(request.cache,'no-store');
 assert.equal(result.loyalty_preview.cards[0].before,8);
 window.WSAuth.authenticatedJson=async()=>{throw new Error('SESSION_CHANGED');};
 await assert.rejects(()=>window.WSQuote.quote({shopId:2,basket:[{line:'a',productId:11,qty:3}],includeLoyalty:true}),/SESSION_CHANGED/);
});
