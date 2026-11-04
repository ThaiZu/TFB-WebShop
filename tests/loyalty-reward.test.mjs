import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {rewardSelection,rewardLines} from '../webshop-loyalty-reward.js';
import {normaliseShoppingContext,basketShoppingContext} from '../webshop-office-context.js';
const basket=[{line:'a',productId:1,qty:1},{line:'b',productId:2,qty:3}];
const choice={id:4,line:'b',client:10,shop:1};
test('reward follows the selected basket line after removal of another line',()=>{
  assert.deepEqual(rewardSelection(choice,basket,10,1,true,'collect','standard'),{id:4,line_index:1});
  assert.deepEqual(rewardSelection(choice,basket.slice(1),10,1,true,'collect','standard'),{id:4,line_index:0});
  assert.equal(rewardSelection(choice,basket.slice(0,1),10,1,true,'collect','standard'),null);
});
test('reward cannot survive identity, shop, channel or program changes',()=>{
  for (const args of [[null,1,true,'collect','standard'],[11,1,true,'collect','standard'],[10,2,true,'collect','standard'],
    [10,1,false,'collect','standard'],[10,1,true,'delivery','standard'],[10,1,true,'collect','office_catalog']])
    assert.equal(rewardSelection(choice,basket,...args),null);
});
test('only unexpired ready rewards offer eligible whole basket items',()=>{
  const reward={status:'READY',productIds:[1,2],expiresAt:'2030-01-01T00:00:00Z'};
  assert.equal(rewardLines(reward,basket,Date.parse('2026-10-29')).length,2);
  for(const change of [{status:'RESERVED'},{status:'REDEEMED'},{expiresAt:'2020-01-01T00:00:00Z'},{productIds:null}])
    assert.deepEqual(rewardLines({...reward,...change},basket,Date.now()),[]);
  for(const change of [{menu_selection:{}},{id_product_portion:4},{weight_grams:100},{qty:0.5}])
    assert.deepEqual(rewardLines(reward,[{...basket[0],...change}],Date.now()),[]);
});
test('reward quote requires authenticated response confirmation and never falls back to full price',async()=>{
 let request;
 const body={items:[{line_key:'web-a',total_gross_value_after_discount:'0.00'}],totals:{gross_before_discount:'2.00',discount:'2.00',gross_after_discount:'0.00'},
   loyalty_reward:{id:4,line_index:0,discount:'2.00'}};
 const window={WSAuth:{authHeaders:()=>({}),authenticatedJson:async(url,options)=>{request=JSON.parse(options.body);return {response:{ok:true},data:body};}}};
 vm.runInNewContext(fs.readFileSync(new URL('../webshop-quote-api.jsx',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,''),{window,normaliseShoppingContext,basketShoppingContext});
 window.WSQuote.endpoint='https://example.invalid/quote';
 const args={shopId:1,basket:[basket[0]],loyaltyReward:{id:4,line_index:0}};
 await window.WSQuote.quote(args);
 assert.deepEqual(request.loyalty_reward,{id:4,line_index:0});assert.equal(request.id_client,undefined);
 delete body.loyalty_reward;
 await assert.rejects(()=>window.WSQuote.quote(args),/LOYALTY_REWARD_UNAVAILABLE/);
});

test('only explicitly selected reward portions qualify',()=>{const line={line:'p',productId:1,qty:1,id_product_portion:101};assert.equal(rewardLines({status:'READY',productIds:[],portionIds:[101]},[line],Date.now()).length,1);assert.equal(rewardLines({status:'READY',productIds:[1],portionIds:[]},[line],Date.now()).length,0);});
