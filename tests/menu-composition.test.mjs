import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {basketShoppingContext,normaliseShoppingContext} from '../webshop-office-context.js';
import {adaptShopCatalogue} from '../webshop-catalog-adapter.js';
const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8').replace(/^import .*\n/gm,'');
test('menu quote transmits identifiers, mode and date, not client prices',async()=>{
 const requests=[];const context={window:{WSAuth:{authHeaders:()=>({}),authenticatedFetch:async(u,o)=>{const p=JSON.parse(o.body);requests.push(p);return {ok:true,json:async()=>({items:p.products.map(l=>({line_key:l.line_key,total_gross_value_after_discount:'8.00'})),totals:{gross_before_discount:'8.00',gross_after_discount:'8.00',discount:'0.00'}})};}}},basketShoppingContext,normaliseShoppingContext};
 vm.runInNewContext(source('webshop-quote-api.jsx'),context);context.window.WSQuote.endpoint='https://example.test/api/v1/quote';
 const selection={menu_id:1,version:2,formula_id:3,steps:[{step_id:4,choice_ids:[5]}]};
 await context.window.WSQuote.quote({shopId:2,mode:'collect',deliveryDate:'2026-10-01',basket:[{line:1,productId:10,qty:1,menu_selection:selection,price:0.01}]});
 assert.deepEqual(requests[0].products[0].menu_selection,selection);assert.equal(requests[0].fulfilment_mode,'collect');assert.equal(requests[0].delivery_date,'2026-10-01');assert.equal(requests[0].products[0].price,undefined);
});
test('all menu components participate in pickup cutoff selection',async()=>{
 const urls=[];const context={window:{},URLSearchParams,fetch:async url=>{urls.push(new URL(url));return {ok:true,json:async()=>[]};}};
 vm.runInNewContext(source('webshop-availability-api.jsx'),context);context.window.WSAvailability.endpoint='https://example.test/availability';
 await context.window.WSAvailability.listSlots({shopId:2,mode:'collect',date:'2026-10-01',basket:[{productId:10,menu_product_ids:[10,20,30]},{productId:20}]});
 assert.equal(urls[0].searchParams.get('productIds'),'10,20,30');
});
test('menu read is scoped to shop date and language',async()=>{
 const urls=[];const context={window:{WSI18n:{getLang:()=> 'pl'}},localStorage:{getItem:()=>null},URLSearchParams,adaptShopCatalogue,normaliseShoppingContext,fetch:async url=>{urls.push(new URL(url));return {ok:true,json:async()=>[]};}};
 context.window.WSAuth={authenticatedFetch:(...a)=>context.fetch(...a)};vm.runInNewContext(source('webshop-catalog-api.jsx'),context);const api=context.window.WSCatalog;api.shopsEndpoint='https://example.test/api/v1/shops';
 await api.listBundles({shopId:2,productId:10,date:'2026-10-01',lang:'nl'});assert.equal(urls[0].pathname,'/api/v1/webshop/shops/2/products/10/menus');assert.equal(urls[0].searchParams.get('lang_code'),'nl');assert.equal(urls[0].searchParams.get('date'),'2026-10-01');
});
