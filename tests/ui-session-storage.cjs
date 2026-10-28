/* Built app, intercepted requests only. No production accounts or real tokens. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const serveBuild=require('./helpers/static-build.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try {
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='webshop.test') return serveBuild(route,path.resolve(__dirname,'../dist'));
   if(url.hostname!=='api.tfbuddy.local') throw Error('Unexpected external request '+url);
   let json=[];
   if(url.pathname.endsWith('/privacy-config')) json={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'draft',policies:{},integrations:{}};
   if(url.pathname.endsWith('/locale')) json={language:'fr'};
   if(url.pathname.endsWith('/login')) json={access_token:'fixture-access',refresh_token:'fixture-refresh'};
   if(url.pathname.endsWith('/me')) {
    if(route.request().headers().authorization!=='Bearer fixture-access') return route.fulfill({status:401,json:{}});
    json={user:{id:7,name:'Fixture',email:'fixture@example.test'}};
   }
   return route.fulfill({json});
  });
  const page=await context.newPage();await page.goto('https://webshop.test/');
  await page.waitForFunction(()=>window.WSAuth?.endpoint&&window.WSI18n?.isLoaded());
  assert.equal(await page.evaluate(async()=>{
   const result=await window.WSAuth.login({email:'fixture@example.test',password:'fixture'});
   window.WSI18n.setCustomer(result.user);window.WSSessionStorage.setItem('ws.deliveryPreference:7:2','{"officeId":18,"siteId":4}');
   sessionStorage.setItem('ws.pendingPay','payment-fixture');window.WSConsent.reject();
   return result.ok;
  }),true);
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('ws_auth_token'),localStorage.getItem('ws.customer'),!!localStorage.getItem('ws.consent')]),[null,null,true]);
  await page.reload();await page.waitForFunction(()=>window.WSAuth?.endpoint&&window.WSI18n?.isLoaded());
  assert.deepEqual(await page.evaluate(async()=>[(await window.WSAuth.me())?.id,window.WSI18n.getCustomer()?.id,sessionStorage.getItem('ws.pendingPay')]),[7,7,'payment-fixture']);
  const independent=await context.newPage();await independent.goto('https://webshop.test/');await independent.waitForFunction(()=>window.WSAuth?.endpoint);
  assert.equal(await independent.evaluate(()=>window.WSSessionStorage.getItem('ws_auth_token')),null);await independent.close();
  await page.evaluate(()=>window.WSAuth.logout());
  assert.deepEqual(await page.evaluate(()=>['ws_auth_token','ws_auth_refresh_token','ws.customer','ws.deliveryPreference:7:2'].map(key=>window.WSSessionStorage.getItem(key))),[null,null,null,null]);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ws.pendingPay')),null);
  await context.close();console.log('PASS session storage: real login, reload, same-tab payment state, independent tab, logout, consent retained without permanent profile/tokens');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
