/* Real build, authenticated account fixtures and intercepted API only. No live purchases or customer data. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD||'/tmp/customer-voucher-webshop-build';
const voucher=(id,status='READY',changes={})=>({id,code:'PERSONAL-'+id,name:'Bagietka',source:'LOYALTY',status,canUse:status==='READY',validFrom:null,validTo:null,...changes});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  await context.addInitScript(()=>{const now=Date.now()-3600000;for(const [key,value] of [['ws.lang','pl'],['ws_auth_token','wallet-A'],['ws_auth_refresh_token','refresh-A']])sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt:now,expiresAt:now+43200000}));});
  let mode='ready',release,held;
  let activation={code:null,name:null,revision:0,reserved:false};let activationWrites=0;
  const requests=[],errors=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname==='webshop.test')return serveBuild(route,build);
   if(url.hostname!=='api.example.invalid')return route.abort();
   let data=[];
   if(url.pathname.endsWith('/clients/auth/me'))data={user:{id:42,firstName:'Anna',lastName:'Test',email:'anna@example.invalid',phone:'+32470123456',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,invoice:{}}};
   else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:true};
   else if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Shop A',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/locale'))data={language:'pl'};
   else if(url.pathname.endsWith('/webshop/loyalty/identity'))data={status:'available',code:'FID1-16-'+'A'.repeat(32)};
   else if(url.pathname.endsWith('/webshop/loyalty/cards'))data={status:'available',asOf:new Date().toISOString(),items:[],nextCursor:null};
   else if(url.pathname.endsWith('/webshop/vouchers/activation')){
    assert.equal(request.headers().authorization,'Bearer wallet-A');
    if(request.method()==='POST'){
     const input=request.postDataJSON();assert.equal(Number(input.shopId),2);assert.equal(input.revision,activation.revision);
     activationWrites++;activation={...activation,code:input.code,name:input.code?'Bagietka':null,revision:activation.revision+1};
    }
    data=activation;
   }
   else if(url.pathname.includes('/webshop/vouchers')){
    requests.push({url:request.url(),method:request.method()});
    assert.equal(request.headers().authorization,'Bearer wallet-A');
    assert.equal(url.searchParams.has('clientId'),false);assert.equal(url.searchParams.has('id_client'),false);
    if(url.pathname.endsWith('/prepare')){assert.equal(request.method(),'POST');assert.deepEqual(request.postDataJSON(),{});data={prepared:0,hasMore:false};}
    else {
     if(mode==='error')return route.fulfill({status:503,json:{error:'VOUCHER_UNAVAILABLE'}});
     if(mode==='hold'){held?.();await new Promise(resolve=>release=resolve);}
     data={status:'available',asOf:new Date().toISOString(),items:mode==='empty'?[]:url.searchParams.has('cursor')?[voucher(89,'READY',{source:'PROMOTION'})]:[
      voucher(100),voucher(99,'RESERVED'),voucher(98,'USED'),voucher(97,'READY',{validTo:'2000-01-01T00:00:00Z'}),voucher(96,'REVOKED'),voucher(95,'READY',{canUse:false})],nextCursor:mode==='empty'||url.searchParams.has('cursor')?null:'90'};
    }
   }
   try{await route.fulfill({json:data});}catch(error){if(!/closed|handled/i.test(error.message))throw error;}
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://webshop.test/?shop=2');
  await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);
  if(await page.locator('.ws-cookie-panel').count())await page.locator('.ws-cookie-actions button').last().click();
  await page.locator('.ws-nav__avatar').waitFor({state:'attached'});
  await page.locator(width<1024?'.ws-tabbar__btn--account':'.ws-nav__avatar').click();
  await page.getByRole('tab',{name:'Moje Vouchery',exact:true}).click();
  const panel=page.getByRole('region',{name:'Moje Vouchery',exact:true});
  await panel.getByRole('button',{name:'Wykorzystaj',exact:true}).click();
  await panel.locator('.is-selected').waitFor();
  assert.equal(activation.code,'PERSONAL-100');assert.equal(activationWrites,1);
  await page.reload();
  const shortcut=page.locator(width<1024?'.ws-tabbar__btn--loyalty':'.ws-nav__loyalty');
  await shortcut.getByRole('img',{name:'Aktywny voucher',exact:true}).waitFor();
  assert.equal(activationWrites,1,'Reload reads the server without activating again');
  // Emulate the POS completing a transaction while the phone remains open.
  activation={...activation,code:null,name:null,revision:activation.revision+1};
  await shortcut.getByRole('img',{name:'Aktywny voucher',exact:true}).waitFor({state:'detached'});
  assert.equal(activationWrites,1,'Consumption is observed without a client write');
  assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS shared voucher activation ${width}px: API selection, reload persistence, POS consumption polling`);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
