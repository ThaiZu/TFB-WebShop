import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {basketShoppingContext,normaliseShoppingContext} from '../webshop-office-context.js';
const source=fs.readFileSync(new URL('../webshop-quote-api.jsx',import.meta.url),'utf8').replace(/^import .*\n/,'');
test('quote preserves personalization IDs and version, accepts parent-only display row',async()=>{
 let sent;
 const window={WSAuth:{authenticatedFetch:async(url,req)=>{
   sent=JSON.parse(req.body);
   return {ok:true,json:async()=>({items:[{line_key:sent.products[0].line_key,total_gross_value_after_discount:'6.50'}],order_items:[{},{}],totals:{gross_before_discount:'6.50',gross_after_discount:'6.50',discount:'0.00'}})};
 }}};
 vm.runInNewContext(source,{window,basketShoppingContext,normaliseShoppingContext});window.WSQuote.endpoint='/quote';
 const selection={version:3,option_ids:[14,15]};
 const result=await window.WSQuote.quote({shopId:2,basket:[{line:'one',productId:4,qty:1,personalization_selection:selection}]});
 assert.deepEqual(sent.products[0].personalization_selection,selection);assert.equal(result.items.length,1);assert.equal(result.order_items.length,2);
});
test('checkout forwards configuration and loading barrier includes personalization',()=>{
 const bundle=fs.readFileSync(new URL('../webshop-full-bundle.jsx',import.meta.url),'utf8');
 assert.match(bundle,/personalization_selection:l.personalization_selection/);
 assert.match(bundle,/detailOptionsState.personalizationReady===false/);
 assert.match(bundle,/personalization: line\?\.personalization_selection/);
});
