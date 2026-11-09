import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { defaultShoppingContext, normaliseShoppingContext, sameShoppingContext, basketShoppingContext, needsCartReplacement, hasUnsupportedOfficeConfiguration } from '../webshop-office-context.js';
import { adaptShopCatalogue } from '../webshop-catalog-adapter.js';
const office = { mode:'office_catalog',office_id:10,offer_id:null };
const offer = { mode:'office_offer',office_id:10,offer_id:20 };
test('contexts are explicit, canonical and cannot mix modes or offices',()=>{
 assert.deepEqual(normaliseShoppingContext(null),{mode:'standard',office_id:null,offer_id:null});
 assert.equal(sameShoppingContext(office,{mode:'office_catalog',office_id:'10'}),true);
 assert.equal(needsCartReplacement([],offer),false);
 const cart=[{productId:11,shopping_context:office}];
 assert.equal(needsCartReplacement(cart,office),false);
 assert.equal(needsCartReplacement(cart,offer),true);
 assert.equal(needsCartReplacement([{...cart[0],shop_id:2}],office,3),true);
 assert.equal(needsCartReplacement([{...cart[0],shop_id:2}],office,2),false);
 assert.equal(needsCartReplacement(cart,{mode:'standard'}),true);
 assert.equal(needsCartReplacement(cart,{mode:'office_catalog',office_id:12}),true);
 assert.throws(()=>basketShoppingContext([...cart,{productId:11,shopping_context:offer}]),/Mixed/);
 assert.throws(()=>normaliseShoppingContext({mode:'office_offer',office_id:10}),/Invalid/);
 assert.throws(()=>normaliseShoppingContext({mode:'evil'}),/Invalid/);
});
test('quote transmits cart context and identity on every line rather than last menu',async()=>{
 const calls=[];const sandbox={window:{WSAuth:{authHeaders:()=>({Authorization:'Bearer test'})}},normaliseShoppingContext,basketShoppingContext,
  fetch:async(url,request)=>{calls.push({url,...request});return{ok:true,json:async()=>({items:[{line_key:'web-1',total_gross_value_after_discount:'8.00'}],totals:{gross_before_discount:'10.00',discount:'2.00',gross_after_discount:'8.00'}})};}};
 sandbox.window.WSAuth.authenticatedFetch=sandbox.fetch;
 vm.runInNewContext(fs.readFileSync(new URL('../webshop-quote-api.jsx',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,''),sandbox);
 sandbox.window.WSQuote.endpoint='/quote';
 await sandbox.window.WSQuote.quote({shopId:2,deliveryDate:'2026-09-18',basket:[{line:1,productId:11,qty:2,id_product_portion:17,shopping_context:offer}]});
 const payload=JSON.parse(calls[0].body);
 assert.equal(payload.delivery_date,'2026-09-18');
 assert.deepEqual(payload.shopping_context,offer);assert.deepEqual(payload.products[0].shopping_context,offer);
 assert.equal(payload.products[0].id_product_portion,17);assert.equal(payload.products[0].quantity,2);
 assert.equal(calls[0].headers.Authorization,'Bearer test');
 assert.equal('price' in payload.products[0],false);
});
test('office catalogue is scoped with auth and leaves standard catalogue endpoint intact',async()=>{
 const reads=[];const sandbox={window:{WSI18n:{getLang:()=> 'pl'},WSOffices:{catalogue:async data=>{reads.push(data);return{products:[],context:offer,billing:{mode:'company'}};}}},localStorage:{getItem:()=>null},URLSearchParams,adaptShopCatalogue,normaliseShoppingContext,
 fetch:async url=>{reads.push(url);return{ok:true,json:async()=>[]};}};
 sandbox.window.WSAuth={authenticatedFetch:sandbox.fetch};
 vm.runInNewContext(fs.readFileSync(new URL('../webshop-catalog-api.jsx',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,''),sandbox);
 sandbox.window.WSCatalog.shopsEndpoint='https://example.test/shops';
 const result=await sandbox.window.WSCatalog.loadCatalogue({shopId:2,date:'2026-09-18',shoppingContext:offer});
 assert.equal(reads[0].officeId,10);assert.equal(reads[0].offerId,20);assert.equal(reads[0].date,'2026-09-18');
 assert.equal(result.billing.mode,'company');
 await sandbox.window.WSCatalog.loadCatalogue({shopId:2});assert.match(reads[1],/\/shops\/2\/products\/available/);
});
test('NIP search preserves all results and joining carries only chosen office',async()=>{
 const calls=[];const sandbox={window:{WSAuth:{authHeaders:()=>({Authorization:'Bearer test'})}},URLSearchParams,
 fetch:async(url,request)=>{calls.push({url,...request});return{ok:true,json:async()=>({offices:[{id:10},{id:11}]})};}};
 sandbox.window.WSAuth.authenticatedFetch=sandbox.fetch;
 vm.runInNewContext(fs.readFileSync(new URL('../webshop-offices-api.jsx',import.meta.url),'utf8'),sandbox);
 const api=sandbox.window.WSOffices;api.consumerEndpoint='/webshop/offices';
 assert.equal((await api.searchMemberships({shop:2,tax_number:'BE123'})).length,2);
 await api.joinMembership({shop:2,tax_number:'BE123',officeId:11});
 assert.equal(calls[1].url,'/webshop/offices/11/join');assert.deepEqual(JSON.parse(calls[1].body),{shop:2,tax_number:'BE123'});
 assert.equal(calls[1].headers.Authorization,'Bearer test');
});
test('portion-only offer never silently reintroduces whole product',()=>{
 const row={id:11,name:'Cake',id_category:3,webshop_active:1,is_active:1,click_and_collect:1,office_delivery:1,is_divisible:0,
 category:{name:'Cakes',groups:[]},webshop:{price_gross:'10.00'},availability_periods:[],office_whole_available:false,
 portions:[{id:8,portion_type:'ONE_HALF',is_active:1,is_ready_for_sale:1,shop_price_gross:'4.00'}]};
 const product=adaptShopCatalogue([row],{mode:'collect'}).products[0];
 assert.equal(product.price,4);assert.deepEqual(product.portionOptions.map(p=>p.v),['demi']);
 const free={...row,office_whole_available:true,shopping_context:offer,webshop:{price_gross:'0.00'},portions:[]};
 assert.equal(adaptShopCatalogue([free],{mode:'collect'}).products[0].price,0);
 assert.equal(adaptShopCatalogue([{...free,shopping_context:null}],{mode:'collect'}).products.length,0);
});

test('server changed-quote response retains replacement quote and typed error',async()=>{
 const replacement={totals:{gross_after_discount:'9.00'}};
 const sandbox={window:{WSAuth:{authHeaders:()=>({})}},sessionStorage:{setItem(){}},
 fetch:async()=>({ok:false,status:409,json:async()=>({status:'error',description:'WEBSHOP_QUOTE_CHANGED',errors:{quote:replacement}})})};
 vm.runInNewContext(fs.readFileSync(new URL('../webshop-orders-api.jsx',import.meta.url),'utf8'),sandbox);
 sandbox.window.WSOrders.endpoint='/orders';
 await assert.rejects(()=>sandbox.window.WSOrders.place({}),error=>error.code==='WEBSHOP_QUOTE_CHANGED'&&error.quote.totals.gross_after_discount==='9.00');
});

test('office customisations fail closed when pricing only understands a product and portion',()=>{
 assert.equal(hasUnsupportedOfficeConfiguration({options:[],bundleId:null,bundleOfferId:null,bundleSlots:{}}),false);
 assert.equal(hasUnsupportedOfficeConfiguration({options:[{label:'Extra filling'}]}),true);
 assert.equal(hasUnsupportedOfficeConfiguration({bundleId:12}),true);
 assert.equal(hasUnsupportedOfficeConfiguration({bundleOfferId:24}),true);
 assert.equal(hasUnsupportedOfficeConfiguration({bundleSlots:{a:[4]}}),true);
 assert.equal(hasUnsupportedOfficeConfiguration({offerDiscount:1}),true);
});

test('default menu prefers any available offer, then an office catalogue, then the shop',()=>{
 assert.equal(defaultShoppingContext([]).mode,'standard');
 assert.deepEqual(defaultShoppingContext([{id:10,offers:[]}]),{mode:'office_catalog',office_id:10,offer_id:null});
 assert.deepEqual(defaultShoppingContext([{id:10,offers:[]},{id:11,offers:[{id:20},{id:21}]}]),{mode:'office_offer',office_id:11,offer_id:20});
 assert.equal(defaultShoppingContext([{id:10,status:'inactive',offers:[{id:20}]}]).mode,'standard');
});
