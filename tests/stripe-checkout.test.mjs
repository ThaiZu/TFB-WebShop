import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../webshop-orders-api.jsx', import.meta.url),'utf8');
function setup(result,token='guest-token') {
 const calls=[];
 const window={location:{pathname:'/',origin:'https://shop.test'},WSI18n:{getLang:()=> 'pl'},WSAuth:{authHeaders:()=>({Authorization:'Bearer user-token'})}};
 const fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>result};};
 window.WSAuth.authenticatedFetch=fetch;
 vm.runInNewContext(source,{window,URL,console,sessionStorage:{getItem:()=>token},fetch});
 window.WSOrders.endpoint='https://api.test/webshop/orders';
 return {api:window.WSOrders,calls};
}
test('checkout uses saved order reference, owner credentials and safe return URL',async()=>{
 const {api,calls}=setup({url:'https://checkout.stripe.com/c/pay/test',status:'open'});
 const result=await api.pay('WEB-2-20260914-ABCDEF');
 assert.equal(result.checkoutUrl,'https://checkout.stripe.com/c/pay/test');
 assert.equal(calls[0].url,'https://api.test/webshop/orders/WEB-2-20260914-ABCDEF/stripe-checkout');
 assert.equal(calls[0].options.headers['X-Webshop-Order-Token'],'guest-token');
 assert.equal(calls[0].options.headers.Authorization,'Bearer user-token');
 assert.deepEqual(JSON.parse(calls[0].options.body),{return_url:'https://shop.test/',locale:'pl',ui_mode:'form'});
});
test('on-page checkout (form, or embedded from an older API) returns only validated Stripe initialization data, without redirect',async()=>{
 for(const uiMode of ['form','embedded']){
  const session={status:'open',uiMode,clientSecret:'cs_test_fixture_secret_fixture',stripeAccount:'acct_fixture',publishableKey:'pk_test_fixture'};
  const {api}=setup(session);assert.equal((await api.pay('WEB-2-20260914-ABCDEF')).checkoutUrl,undefined);
  for(const change of [{publishableKey:'sk_test_secret'},{stripeAccount:'invalid'},{clientSecret:'pi_other_secret_fixture'}]){
   const {api}=setup({...session,...change});await assert.rejects(api.pay('WEB-2-20260914-ABCDEF'));
  }
 }
});
test('checkout never redirects to untrusted, non-HTTPS or credential-bearing URLs',async()=>{
 for(const url of ['https://evil.test','http://checkout.stripe.com','https://checkout.stripe.com.evil.test','https://evil@checkout.stripe.com/','https://checkout.stripe.com:8443']){
  const {api}=setup({url,status:'open'}); await assert.rejects(api.pay('WEB-2-20260914-ABCDEF'));
 }
});
test('already paid response needs no redirect',async()=>{
 const {api}=setup({status:'paid'}); assert.equal((await api.pay('WEB-2-20260914-ABCDEF')).status,'paid');
});

test('pending webhook response returns local status view and never retries account/order creation',async()=>{
 const {api,calls}=setup({status:'pending'}); const result=await api.pay('WEB-2-20260914-ABCDEF');
 assert.equal(result.pendingUrl,'https://shop.test/?stripe=return&orderRef=WEB-2-20260914-ABCDEF'); assert.equal(calls.length,1); assert.equal(result.checkoutUrl,undefined);
});

test('status reconciliation sends owner credentials and never starts checkout',async()=>{
 const {api,calls}=setup({status:'paid',orderRef:'WEB-2-20260914-ABCDEF',amountMinor:1000,currency:'eur'});
 assert.equal((await api.paymentStatus('WEB-2-20260914-ABCDEF')).status,'paid');
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.test/webshop/orders/WEB-2-20260914-ABCDEF/stripe-status');
 assert.equal(calls[0].options.method,'POST');
 assert.equal(calls[0].options.headers['X-Webshop-Order-Token'],'guest-token');
 assert.equal(calls[0].options.headers.Authorization,'Bearer user-token');
});
test('invalid status response never becomes unpaid',async()=>{
 for(const result of [{},null,{status:'failed'},[]]) {
  const {api}=setup(result);await assert.rejects(api.paymentStatus('WEB-2-20260914-ABCDEF'));
 }
});
