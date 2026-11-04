import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voucherProductPortions} from '../webshop-voucher-targets.js';
import {validateVoucherPage} from '../webshop-vouchers-api.js';

const product={id:101,cat_id:81125,portionOptions:[{v:'entier'},{v:'demi',id_product_portion:2},{v:'quart',id_product_portion:3}]};
test('category voucher matches a product independently of the chosen portion',()=>{
 const voucher={targets:{products:[],categories:[{id:81125,portion:'ONE_QUARTER'}]}};
 assert.deepEqual(voucherProductPortions(voucher,{...product,portion:'entier'}),[{value:'quart',label:'1/4'}]);
 assert.deepEqual(voucherProductPortions(voucher,{...product,portion:'demi'}),[{value:'quart',label:'1/4'}]);
 assert.deepEqual(voucherProductPortions(voucher,{...product,cat_id:99}),[]);
 assert.deepEqual(voucherProductPortions(voucher,{...product,portionOptions:[{v:'entier'}]}),[]);
});
test('explicit product vouchers retain the exact portion and do not match other products',()=>{
 const voucher={targets:{products:[{id:101,portionId:2,portion:'ONE_HALF'}],categories:[]}};
 assert.deepEqual(voucherProductPortions(voucher,product),[{value:'demi',label:'1/2'}]);
 assert.deepEqual(voucherProductPortions(voucher,{...product,id:102}),[]);
 assert.deepEqual(voucherProductPortions({targets:{products:[{id:101,portionId:null,portion:'WHOLE'}],categories:[]}},product),[{value:'entier',label:'1/1'}]);
 assert.deepEqual(voucherProductPortions(null,product),[]);
});
test('wallet validates target metadata while allowing older API responses',()=>{
 const data={status:'available',asOf:'2026-11-03T10:00:00Z',nextCursor:null,items:[{id:1,name:'Tarta',code:'CODE',status:'READY',canUse:true,source:'PROMOTION',validFrom:null,validTo:null,targets:{products:[],categories:[{id:81125,name:'Tarty',portion:'ONE_QUARTER'}]}}]};
 assert.equal(validateVoucherPage(data),data);
 data.items[0].targets.categories[0].portion='INVALID';
 assert.throws(()=>validateVoucherPage(data),/VOUCHER_INVALID_RESPONSE/);
 delete data.items[0].targets;
 assert.equal(validateVoucherPage(data),data);
});
