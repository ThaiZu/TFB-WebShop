/* Real build, authenticated account fixtures and intercepted API only. No live purchases or customer data. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD||'/tmp/fidelity-personal-vouchers-build';
const voucher=(id,status='READY',changes={})=>({id,code:'PERSONAL-'+id,name:'Bagietka',source:'LOYALTY',status,canUse:status==='READY',validFrom:null,validTo:null,...changes});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try {for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  await context.addInitScript(()=>{const now=Date.now()-3600000;for(const [key,value] of [['ws.lang','pl'],['ws_auth_token','wallet-A'],['ws_auth_refresh_token','refresh-A']])sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt:now,expiresAt:now+43200000}));});
  let mode='ready',release,held;
  const requests=[],errors=[];
  const loyaltyApi=require('./helpers/loyalty-api-fixture.cjs')({accessToken:'wallet-A',findVoucher:code=>['PERSONAL-100','PERSONAL-89'].includes(code)?{name:'Bagietka'}:null});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname==='webshop.test')return serveBuild(route,build);
   if(url.hostname!=='api.example.invalid')return route.abort();
   const fixture=loyaltyApi(route.request());if(fixture)return route.fulfill(fixture);
   let data=[];
   if(url.pathname.endsWith('/clients/auth/me'))data={user:{id:42,firstName:'Anna',lastName:'Test',email:'anna@example.invalid',phone:'+32470123456',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,invoice:{}}};
   else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:true};
   else if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Shop A',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/locale'))data={language:'pl'};
   else if(url.pathname.endsWith('/webshop/loyalty/identity'))data={status:'available',code:'FID1-16-'+'A'.repeat(32)};
   else if(url.pathname.endsWith('/webshop/loyalty/cards'))data={status:'available',asOf:new Date().toISOString(),items:[],nextCursor:null};
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
  await panel.locator('.ws-vouchers__item').first().waitFor();
  assert.equal(await panel.getByRole('button',{name:'Wykorzystaj',exact:true}).count(),1,'Expired, reserved, used, revoked and other-shop codes cannot be applied');
  assert.equal(await panel.locator('.ws-vouchers__item').count(),1,'Only active vouchers usable in the current shop are shown');
  assert.equal(await panel.getByText('Wygasły',{exact:true}).count(),0);
  await panel.getByRole('button',{name:'Pokaż więcej',exact:true}).click();
  await panel.getByText('PERSONAL-89',{exact:true}).waitFor();
  assert.equal(await panel.locator('.ws-vouchers__item').count(),2);
  await panel.locator('.ws-vouchers__item').first().getByRole('button',{name:'Wykorzystaj',exact:true}).click();
  assert.equal(await page.locator('.ws-modal:visible').count(),1,'Selecting a voucher keeps the account open');
  await panel.locator('.is-selected').waitFor();
  assert.equal(await panel.locator('.is-selected').count(),1);
  assert.equal(await panel.getByRole('button',{name:'Wybrany',exact:true}).isDisabled(),true);
  assert.equal(await panel.locator('.is-locked').getByRole('button').isDisabled(),true);
  await page.locator('.ws-modal__close').click();
  const shortcut=page.locator(width<1024?'.ws-tabbar__btn--loyalty':'.ws-nav__loyalty');
  const indicator=shortcut.getByRole('img',{name:'Aktywny voucher',exact:true});
  await indicator.waitFor();
  assert.equal(await page.locator('.ws-active-voucher').count(),0,'The standalone voucher banner is removed');
  const badge=await indicator.boundingBox(),button=await shortcut.boundingBox();
  assert.equal(await indicator.evaluate(el=>el.parentElement.tagName),'BUTTON','Voucher badge belongs directly to the button');
  assert.equal(await indicator.evaluate(el=>el.offsetParent===el.parentElement),true,'The button anchors the voucher badge');
  assert.ok(Math.abs(badge.x+badge.width-button.x-button.width)<=5&&Math.abs(badge.y-button.y)<=5,'Voucher badge sits at the top right edge of the button');
  const cardIcon=shortcut.locator('.ws-loyalty-shortcut__card');
  for(const motion of ['ws-loyalty-card-move','ws-loyalty-card-flip','ws-loyalty-card-pulse']) {
   await page.waitForFunction(({selector,motion})=>getComputedStyle(document.querySelector(selector)).animationName===motion,{selector:(width<1024?'.ws-tabbar__btn--loyalty':'.ws-nav__loyalty')+' .ws-loyalty-shortcut__card',motion});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await cardIcon.evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.screenshot({path:`/tmp/active-voucher-${width}.png`});
  await shortcut.click();
  const wallet=page.locator('.ws-loyalty-wallet:modal');
  await wallet.getByRole('button',{name:'Vouchery',exact:true}).click();
  await wallet.locator('.is-selected').waitFor();
  await wallet.getByRole('button',{name:'Pokaż więcej',exact:true}).click();
  assert.equal(await wallet.locator('.is-locked').getByRole('button').isDisabled(),true);
  await wallet.getByRole('button',{name:'Usuń wybór',exact:true}).click();
  await wallet.locator('.is-selected').waitFor({state:'detached'});
  assert.equal(await wallet.getByRole('button',{name:'Wykorzystaj',exact:true}).count(),2);
  await wallet.locator('.ws-vouchers__item').last().getByRole('button',{name:'Wykorzystaj',exact:true}).click();
  assert.equal(await wallet.isVisible(),true,'Selecting a voucher keeps the customer card open');
  assert.equal(await wallet.locator('.is-selected code').textContent(),'PERSONAL-89');
  await wallet.getByRole('button',{name:'Usuń wybór',exact:true}).click();
  await wallet.locator('.ws-loyalty-wallet__close').click();
  await indicator.waitFor({state:'detached'});
  await page.locator(width<1024?'.ws-tabbar__btn--account':'.ws-nav__avatar').click();
  await page.getByRole('tab',{name:'Moje Vouchery',exact:true}).click();
  await panel.locator('.ws-vouchers__item').first().waitFor();
  assert.equal(await panel.locator('.is-selected,.is-locked').count(),0,'Clearing the selection unlocks vouchers across both views');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`/tmp/customer-vouchers-${width}.png`});
  mode='error';await panel.getByRole('button',{name:'Odśwież',exact:true}).click();await panel.getByRole('alert').waitFor();
  mode='empty';await panel.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();await panel.getByText('Nie masz jeszcze voucherów.',{exact:true}).waitFor();
  assert.equal(await panel.locator('code').count(),0);
  mode='hold';const pending=new Promise(resolve=>held=resolve);await panel.getByRole('button',{name:'Odśwież',exact:true}).click();await pending;
  await page.evaluate(()=>window.dispatchEvent(new Event('ws:session-ended')));release();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.ws-vouchers code').count(),0,'A late response must not restore voucher codes after session end');
  assert.deepEqual(errors,[]);assert.ok(requests.some(request=>request.method==='POST'));
  await context.close();console.log(`PASS personal vouchers ${width}px: lifecycle, pagination, expiry, errors, session isolation and layout`);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
