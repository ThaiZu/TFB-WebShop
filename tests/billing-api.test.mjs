import {test} from 'node:test';
import assert from 'node:assert/strict';
import {billingRequest,billingError} from '../webshop-billing-api.js';
import fs from 'node:fs';
import vm from 'node:vm';

test('billing uses session-bound JSON and the central API without accepting a caller endpoint',async()=>{
  const previous=globalThis.window;
  try {
    globalThis.window={WSAuth:{endpoint:'https://shop.example.invalid/api/v1/clients/auth',authenticatedFetch(){},
      authenticatedJson:async(url,options)=>{
        assert.equal(url,'https://shop.example.invalid/api/v1/webshop/billing/companies');
        assert.equal(options.credentials,'include');
        assert.deepEqual(JSON.parse(options.body),{country:'BE',vat:'0123456789'});
        return {response:{ok:true},data:[{id:1,isDefault:true}]};
      }}};
    assert.deepEqual(await billingRequest('/companies',{method:'POST',body:{country:'BE',vat:'0123456789'}}),[{id:1,isDefault:true}]);
  } finally {globalThis.window=previous;}
});

test('billing forwards API errors and rejects non-PDF responses',async()=>{
  const previous=globalThis.window;
  try {
    globalThis.window={WSAuth:{endpoint:'/clients/auth',authenticatedFetch(){},
      authenticatedJson:async()=>({response:{ok:false},data:{description:'BILLING_ALREADY_ISSUED'}}),
      authenticatedBlob:async()=>({response:{ok:true,headers:new Headers({'content-type':'text/html'})},data:new Blob(['invalid'])})}};
    await assert.rejects(billingRequest('/orders/WEB'),/BILLING_ALREADY_ISSUED/);
    await assert.rejects(billingRequest('/orders/WEB/pdf',{pdf:true}),/BILLING_UNAVAILABLE/);
  } finally {globalThis.window=previous;}
});

test('billing error messages never expose unknown server diagnostics',()=>{
  const previous=globalThis.window;
  try {
    globalThis.window={WSI18n:{t:key=>key==='billing.error.generic'?'Please try again':key}};
    assert.equal(billingError(new Error('SQLSTATE private diagnostic')),'Please try again');
  } finally {globalThis.window=previous;}
});

test('a PDF completing after logout cannot be delivered to another session',async()=>{
  const storage={getItem:()=>null,removeItem(){},setItem(){}};
  const context={window:{setInterval(){},addEventListener(){},dispatchEvent(){},WSSessionStorage:storage,localStorage:storage},
    document:{addEventListener(){}},Event,fetch:async()=>({ok:true,status:200,json:async()=>({})})};
  vm.runInNewContext(fs.readFileSync(new URL('../webshop-auth-api.jsx',import.meta.url),'utf8'),context);
  const auth=context.window.WSAuth;auth.endpoint='/clients/auth';
  let finish;
  const body=new Promise(resolve=>{finish=resolve;});
  auth.authenticatedFetch=async()=>({ok:true,status:200,blob:()=>body});
  const pending=auth.authenticatedBlob('/private-invoice');
  await Promise.resolve();await auth.logout();finish(new Blob(['%PDF-1.4']));
  await assert.rejects(pending,error=>error.code==='SESSION_CHANGED');
});
