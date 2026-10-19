import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../webshop-auth-api.jsx', import.meta.url), 'utf8');
function setup(response, ok = true) {
  const calls = [], removed = [];
  const context = { window: {setInterval:()=>0,addEventListener:()=>{}}, document:{addEventListener:()=>{}}, navigator: { language: 'pl' }, localStorage: { getItem: () => null, removeItem: k => removed.push(k) }, fetch: async (url, options) => {
    calls.push({url,body:JSON.parse(options.body)}); return {ok,json:async()=>response};
  }};
  vm.runInNewContext(source, context); context.window.WSAuth.endpoint = '/clients/auth';
  return {api:context.window.WSAuth,calls,removed};
}
test('SMS request uses central API and canonical phone, not legacy OTP endpoint', async () => {
  const {api,calls} = setup({request_token:'a'.repeat(64),expires_in:180,retry_after:60});
  const result = await api.otpRequest({phone:'0470 123456',phonePrefix:'+32'});
  assert.equal(result.ok,true); assert.equal(calls[0].url,'/clients/auth/password/reset/sms/request');
  assert.equal(calls[0].body.phone,'+32470123456'); assert.equal(result.expires_in,180);
});
test('reset sends challenge, code and separate confirmation; success clears both old tokens', async () => {
  const {api,calls,removed} = setup({ok:true});
  const result = await api.otpSetPassword({requestToken:'a'.repeat(64),code:'123456',password:'abcd',passwordConfirm:'efgh'});
  assert.equal(result.ok,true); assert.equal(calls[0].body.new_password_confirm,'efgh');
  assert.equal(calls[0].body.request_token,'a'.repeat(64)); assert.deepEqual(removed,['ws_auth_token','ws_auth_refresh_token']);
});
test('errors and malformed success response never count as a sent SMS', async () => {
  for (const [response,ok] of [[{description:'SMS_RESET_LIMIT'},false],[{},true]]) {
    const {api} = setup(response,ok);
    const result = await api.otpRequest({phone:'+32470123456'}); assert.equal(result.ok,false);
  }
});
test('all active WebShop languages contain SMS UI and error translations', () => {
  for (const locale of ['fr','nl','pl']) {
    const dict=JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url)));
    for (const key of ['sent','success','code','resend','SMS_RESET_INVALID','SMS_RESET_LIMIT','SMS_RESET_UNAVAILABLE']) assert.ok(dict['smsReset.'+key]);
  }
});
