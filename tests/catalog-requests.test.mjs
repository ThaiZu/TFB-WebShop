import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normaliseShoppingContext } from '../webshop-office-context.js';
import { adaptShopCatalogue } from '../webshop-catalog-adapter.js';

test('concurrent catalogue reads share a request, but refreshes and identities stay separate', async () => {
  let count=0, token='', release;
  const context={window:{WSI18n:{getLang:()=> 'fr'}},localStorage:{getItem:()=>token},URLSearchParams,adaptShopCatalogue,normaliseShoppingContext,
    fetch:()=>{count++;return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>[]});});}};
  context.window.WSSessionStorage=context.localStorage;
  context.window.WSAuth={authenticatedFetch:(...args)=>context.fetch(...args)};
  const source=fs.readFileSync(new URL('../webshop-catalog-api.jsx',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'');
  vm.runInNewContext(source,context);
  const api=context.window.WSCatalog;api.shopsEndpoint='https://example.test/api/v1/shops';
  const a=api.loadCatalogue({shopId:2,mode:'collect'});
  const b=api.loadCatalogue({shopId:2,mode:'delivery'});
  assert.equal(count,1);release();await Promise.all([a,b]);
  const c=api.loadCatalogue({shopId:2});assert.equal(count,2);const releaseC=release;
  token='different-customer';const d=api.loadCatalogue({shopId:2});assert.equal(count,3);
  releaseC();release();await Promise.all([c,d]);
});


test('availability uses the catalogue endpoint and no cart reservation API is exposed', async () => {
  const urls=[];
  const context={window:{WSI18n:{getLang:()=> 'pl'}}, localStorage:{getItem:()=>null}, URLSearchParams, adaptShopCatalogue,normaliseShoppingContext,
    fetch:async(url)=>{ urls.push(new URL(url)); return {ok:true,json:async()=>[]}; }};
  context.window.WSSessionStorage=context.localStorage;
  context.window.WSAuth={authenticatedFetch:(...args)=>context.fetch(...args)};
  const source=fs.readFileSync(new URL('../webshop-catalog-api.jsx',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'');
  vm.runInNewContext(source,context);
  const api=context.window.WSCatalog;api.shopsEndpoint='https://example.test/api/v1/shops';
  await api.loadCatalogue({shopId:2,date:'2026-09-10',mode:'collect'});
  await api.loadCatalogue({shopId:3,date:'2026-09-11',mode:'collect'});
  assert.equal(urls[0].pathname,'/api/v1/shops/2/products/available');
  assert.equal(urls[0].searchParams.get('date'),'2026-09-10');
  assert.equal(urls[0].searchParams.get('lang_code'),'pl');
  assert.equal(urls[0].searchParams.get('alias_type'),'webshop');
  assert.ok(urls[0].searchParams.get('include').split(',').includes('webshop_availability'));
  assert.equal(urls[1].pathname,'/api/v1/shops/3/products/available');
  assert.equal(urls[1].searchParams.get('date'),'2026-09-11');
  await api.loadCatalogue({shopId:2,includeLoyalty:true});
  assert.ok(urls[2].searchParams.get('include').split(',').includes('loyalty'));
  assert.ok(!urls[0].searchParams.get('include').split(',').includes('loyalty'));
  for(const method of ['getStock','reserve','release']) assert.equal(api[method],undefined);
});
