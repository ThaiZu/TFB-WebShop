const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const pl = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/locales/pl.json')));
let reply;
const context = { window: { WSI18n: { t: key => pl[key] } }, localStorage: { getItem: () => 'test-token' }, fetch: async (url, options) => {
  assert.equal(url, '/clients/auth/billing-verify');
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  return reply;
}};
context.window.setInterval=()=>{};context.window.addEventListener=()=>{};
context.document={addEventListener(){}};
context.window.WSSessionStorage={getItem:key=>key==='ws_auth_token'?'test-token':null};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../webshop-auth-api.jsx'), 'utf8'), context);
context.window.WSAuth.endpoint = '/clients/auth';
(async () => {
  for (const [status, description, key] of [[503,'VIES_BUSY','error.viesBusy'],[422,'VIES_VAT_INVALID','error.vat'],[503,'VIES_UNAVAILABLE','error.vies'],[401,'VIES_AUTH_REQUIRED','error.viesAuth'],[500,'VIES_SAVE_FAILED','error.viesSave'],[404,'Not found','error.verifyUnavailable']]) {
    reply = { ok:false, status, json:async()=>({description}) };
    const result = await context.window.WSAuth.billingVerify({country:'BE',vat:'0123456789'});
    assert.equal(result.ok,false); assert.equal(result.error.message, pl[key]);
  }
  reply = {ok:false,status:404,json:async()=>{throw new Error('HTML');}};
  assert.equal((await context.window.WSAuth.billingVerify({country:'BE',vat:'0123456789'})).error.message,pl['error.verifyUnavailable']);
  reply = {ok:true,status:200,json:async()=>({valid:true,user:{id:42,invoice:{vat:'BE0123456789'}}})};
  const result = await context.window.WSAuth.billingVerify({country:'BE',vat:'0123456789'});
  assert.equal(result.ok,true); assert.equal(result.user.invoice.vat,'BE0123456789');
  console.log('PASS: VAT response handling, localized errors, non-JSON error and successful profile update');
})().catch(error=>{console.error(error);process.exitCode=1;});
