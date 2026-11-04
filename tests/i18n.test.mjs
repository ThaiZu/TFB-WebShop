import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const dictionaries=Object.fromEntries(['fr','nl','pl'].map(lang=>[lang,JSON.parse(fs.readFileSync(new URL(`public/locales/${lang}.json`,root)))]));
test('all languages have matching keys, parameters and emphasis markers',()=>{
 for(const lang of ['nl','pl']) {
  assert.deepEqual(Object.keys(dictionaries[lang]),Object.keys(dictionaries.fr));
  for(const [key,text] of Object.entries(dictionaries.fr)) {
   assert.deepEqual((dictionaries[lang][key].match(/\{\w+\}/g)||[]).sort(),(text.match(/\{\w+\}/g)||[]).sort(),key);
   for(const marker of ['**','__']) assert.equal(dictionaries[lang][key].split(marker).length,text.split(marker).length,key);
  }
 }
});
test('Polish loads on demand and persists across shop and page changes',async()=>{
 const storage=new Map(),requests=[];let documentLanguage;
 function create() {
  const context={window:{},navigator:{language:'fr'},document:{documentElement:{setAttribute:(key,value)=>{documentLanguage=value;}}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    fetch:async(url)=>{requests.push(url);return {ok:true,json:async()=>dictionaries[url.split('/').pop().split('.')[0]]};}};
  context.window.WSSessionStorage = context.localStorage;
 vm.runInNewContext(fs.readFileSync(new URL('webshop-i18n.jsx',root),'utf8').replace('import.meta.env.BASE_URL',JSON.stringify('/')),context);
  return context.window.WSI18n;
 }
 const i=create();await i.load();assert.ok(!requests.includes('/locales/pl.json'));
 await i.setLang('pl');await i.load();i.applyShop({languages:'fr,nl',default_lang:'nl'});
 assert.equal(i.getLang(),'pl');assert.equal(documentLanguage,'pl');
 assert.equal(i.t('pd.addToCart'),'Dodaj do koszyka');assert.equal(i.t('profile.greeting',{name:'Anna'}),'Witaj, Anna');
 const second=create();await second.load();assert.equal(second.getLang(),'pl');assert.equal(second.t('nav.category.backAll'),'Wszystkie kategorie');
});

test('IP locale is used before render, falls back to French and never replaces an explicit choice', async () => {
 const storage=new Map(),requests=[];
 function create() {
  const context={window:{},navigator:{language:'fr'},document:{documentElement:{setAttribute:()=>{}}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    fetch:async(url)=>{requests.push(url);if(url==='/webshop/locale')return {ok:true,json:async()=>({language:'pl'})};return {ok:true,json:async()=>dictionaries[url.split('/').pop().split('.')[0]]};}};
  context.window.WSSessionStorage = context.localStorage;
 vm.runInNewContext(fs.readFileSync(new URL('webshop-i18n.jsx',root),'utf8').replace('import.meta.env.BASE_URL',JSON.stringify('/')),context);
  return context.window.WSI18n;
 }
 const first=create();first.setLocaleEndpoint('/webshop/locale');await first.detectFromIp();await first.load();
 assert.equal(first.getLang(),'pl');assert.ok(!storage.has('ws.lang'));
 await first.setLang('nl');
 const second=create();second.setLocaleEndpoint('/webshop/locale');await second.detectFromIp();
 assert.equal(second.getLang(),'nl');assert.equal(requests.filter(url=>url==='/webshop/locale').length,1);
 const fallback=create();fallback.setLocaleEndpoint('/webshop/locale');storage.clear();
 fallback.setLocaleEndpoint('/missing-locale');await fallback.detectFromIp();
 assert.equal(fallback.getLang(),'fr');
});

test('all literal component and standalone keys exist in every dictionary', () => {
 const files=['webshop-loyalty-reward.jsx','webshop-office-delivery.jsx','webshop-profile-offices.jsx','webshop-purchase-details.jsx','webshop-stripe-return.jsx','webshop-full-bundle.jsx','webshop-i18n-react.jsx','webshop-allergens.jsx','public/inscription.html','public/reset-password.html','public/activate-account.html','public/activate-account.js'];
 for(const file of files) {
  const source=fs.readFileSync(new URL(file,root),'utf8');
  const keys=[...source.matchAll(/(?:\bt|\bwsText)\(['"]([\w.]+)['"]\s*[,)]/g)].map(m=>m[1]);
  keys.push(...[...source.matchAll(/data-i18n(?:-placeholder)?="([\w.]+)"/g)].map(m=>m[1]));
  for(const key of keys) for(const lang of ['fr','nl','pl']) assert.ok(dictionaries[lang][key],`${file}: ${lang}.${key}`);
 }
});

test('language changes wait for the dictionary and translate already visible API errors',async()=>{
 let release,fail=false;
 const context={window:{},console:{warn:()=>{}},navigator:{language:'fr'},document:{documentElement:{setAttribute:()=>{}}},
 localStorage:{getItem:()=>null,setItem:()=>{}},fetch:async(url)=>{
   const lang=url.split('/').pop().split('.')[0];
   if(lang==='pl')await new Promise(resolve=>{release=resolve});
   return {ok:!fail,status:503,json:async()=>dictionaries[lang]};
 }};
 context.window.WSSessionStorage = context.localStorage;
 vm.runInNewContext(fs.readFileSync(new URL('webshop-i18n.jsx',root),'utf8').replace('import.meta.env.BASE_URL',JSON.stringify('/')),context);
 const i=context.window.WSI18n;await i.load();
 const saved=i.t('ui.cutoffReached',{time:'12:30'}),pending=i.setLang('pl');
 assert.equal(i.getLang(),'fr');release();await pending;assert.equal(i.getLang(),'pl');
 assert.equal(i.message(saved),dictionaries.pl['ui.cutoffReached'].replace('{time}','12:30'));
 assert.equal(i.message('Invalid credentials'),dictionaries.pl['error.credentials']);
 assert.equal(i.message('WEBSHOP_SLOT_UNAVAILABLE'),dictionaries.pl['error.slotUnavailable']);
 assert.equal(i.message('An account or a previous webshop order already uses this email or phone. Use password reset to access it.'),dictionaries.pl['error.duplicate']);
 assert.equal(i.message('Untranslated arbitrary server failure'),dictionaries.pl['error.unexpected']);
 fail=true;assert.equal(await i.setLang('nl'),false);assert.equal(i.getLang(),'pl');
});
