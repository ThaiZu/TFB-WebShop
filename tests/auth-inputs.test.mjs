import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const bundle = fs.readFileSync(new URL('../webshop-full-bundle.jsx', import.meta.url), 'utf8');
const prefixes = bundle.match(/const PHONE_PREFIXES = \[[\s\S]*?\n\];/)[0];
const split = bundle.slice(bundle.indexOf('function splitPhoneInput('), bundle.indexOf('function phonePrefixOptions('));
const context = vm.createContext({});
vm.runInContext(prefixes + '\n' + split, context);
test('autofill separates international prefixes without guessing national numbers', () => {
  for (const [input, prefix, phone] of [
    ['+48 501 234 567', '+48', '501234567'],
    ['0048 501-234-567', '+48', '501234567'],
    ['+352 621 123 456', '+352', '621123456'],
    ['0470 123 456', '+32', '0470 123 456'],
  ]) {
    const actual = context.splitPhoneInput(input, '+32');
    assert.equal(actual.phonePrefix, prefix); assert.equal(actual.phone, phone);
  }
});
test('postal codes accept Belgium, Poland, Netherlands and UK without allowing markup', () => {
  const regex = vm.runInNewContext(bundle.match(/const CP_RE = .*;/)[0] + '\nCP_RE');
  for (const value of ['1000', '00-001', '12345', '1234 AB', 'SW1A 1AA']) assert.equal(regex.test(value), true, value);
  for (const value of ['', '<script>', 'a'.repeat(17)]) assert.equal(regex.test(value), false, value);
});
test('registration sends the same canonical phone for equivalent input formats', async () => {
  const requests = [];
  const ctx = { window: {setInterval(){},addEventListener(){}}, document:{addEventListener(){}}, localStorage: {getItem: () => null}, navigator: {language: 'pl'},
    fetch: async (url, options) => {requests.push(JSON.parse(options.body)); return {ok: false, status: 409, json: async () => ({message: 'Already exists'})};} };
  ctx.window.WSSessionStorage = ctx.localStorage;
  vm.runInNewContext(fs.readFileSync(new URL('../webshop-auth-api.jsx', import.meta.url), 'utf8'), ctx);
  ctx.window.WSAuth.endpoint = '/clients/auth';
  for (const phone of ['0470 123 456', '+32470123456', '0032470123456']) {
    await ctx.window.WSAuth.register({phone, phonePrefix: '+32', shopId: 2});
    assert.equal(requests.at(-1).phone, '+32470123456');
  }
  await ctx.window.WSAuth.register({phone: '06 12345678', phonePrefix: '+39', shopId: 2});
  assert.equal(requests.at(-1).phone, '+390612345678');
});
