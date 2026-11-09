/* Intercepted paid-order status and wallet data only. No real payments or orders. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD||'/tmp/fidelity-voucher-awards-build';
const reference='WEB-2-20261102-ABCDEF';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  await context.addInitScript(()=>{const now=Date.now()-3600000;for(const[key,value]of[['ws.lang','pl'],['ws_auth_token','award-A'],['ws_auth_refresh_token','refresh-A']])sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt:now,expiresAt:now+43200000}));});
  let paid=false,delayIdentity=true;
  const errors=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname==='webshop.test')return serveBuild(route,build);
   if(url.hostname!=='api.example.invalid')return route.abort();
   let data=[];
   if(url.pathname.endsWith('/clients/auth/me')){
    if(delayIdentity){await new Promise(resolve=>setTimeout(resolve,300));delayIdentity=false;}
    data={user:{id:42,firstName:'Anna',email:'anna@example.invalid',lastName:'Test',phone:'123456789',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,invoice:{}}};
   }
   else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:true};
   else if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/locale'))data={language:'pl'};
   else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/webshop/loyalty/identity'))data={status:'available',code:'FID1-16-'+'A'.repeat(32)};
   else if(url.pathname.endsWith('/webshop/loyalty/cards'))data={status:'available',asOf:new Date().toISOString(),items:[],nextCursor:null};
   else if(url.pathname.endsWith('/stripe-status'))data={orderRef:reference,status:paid?'paid':'unpaid',amountMinor:11290,currency:'eur'};
   else if(url.pathname.endsWith('/webshop/orders/'+reference))data={orderRef:reference,payment:{method:'stripe',status:paid?'paid':'pending'},mode:'collect',slot:{label:'12:00 – 12:30'},items:[{name:'Tarta Ø28',quantity:5,unitGrossPrice:22.58,totalGross:112.9}],rewardVouchers:paid?Array.from({length:5},(_,i)=>({code:'AWARD-'+i,valid_from:'2099-01-01 00:00:00',valid_to:'2099-02-01 00:00:00'})):[]};
   else if(url.pathname.endsWith('/webshop/vouchers/prepare'))data={prepared:0,hasMore:false};
   else if(url.pathname.endsWith('/webshop/vouchers'))data={status:'available',asOf:new Date().toISOString(),nextCursor:null,items:Array.from({length:5},(_,i)=>({id:i+1,name:'Ćwiartka tarty',code:'AWARD-'+i,source:'PROMOTION',status:'UPCOMING',validFrom:'2099-01-01T00:00:00Z',validTo:'2099-02-01T00:00:00Z',canUse:false}))};
   await route.fulfill({json:data});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`https://webshop.test/?shop=2&stripe=return&orderRef=${reference}`);
  await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);
  if(await page.locator('.ws-cookie-panel').count())await page.locator('.ws-cookie-actions button').last().click();
  const payment=page.getByRole('dialog',{name:'Płatność',exact:true});
  await payment.getByRole('button',{name:'Przejdź do płatności',exact:true}).waitFor();
  assert.equal(await page.locator('.ws-order-vouchers').count(),0,'Pending payments do not announce awards');
  assert.equal(await page.getByRole('img',{name:'Nowe vouchery',exact:true}).count(),0);
  paid=true;await payment.getByRole('button',{name:'Odśwież',exact:true}).click();
  await payment.getByText('Dodano vouchery do Twojego konta: 5',{exact:true}).waitFor();
  const shortcut=page.locator(width<1024?'.ws-tabbar__btn--loyalty':'.ws-nav__loyalty');
  await shortcut.getByRole('img',{name:'Nowe vouchery',exact:true}).waitFor({state:'attached'});
  await payment.getByRole('button',{name:'Zamknij',exact:true}).click();
  await page.reload();await shortcut.getByRole('img',{name:'Nowe vouchery',exact:true}).waitFor();
  await page.evaluate(ref=>window.dispatchEvent(new CustomEvent('ws:stripe-recovery',{detail:{orderRef:ref}})),reference);
  await payment.getByText('Dodano vouchery do Twojego konta: 5',{exact:true}).waitFor();
  await payment.getByRole('button',{name:'Przejdź do Moich Voucherów',exact:true}).click();
  await payment.waitFor({state:'detached'});
  const wallet=page.getByRole('region',{name:'Moje Vouchery',exact:true});
  await wallet.getByText('Nie masz teraz voucherów dostępnych do użycia.',{exact:true}).waitFor();
  await wallet.getByRole('button',{name:'Pokaż wszystkie',exact:true}).click();
  assert.equal(await wallet.locator('.ws-vouchers__item').count(),5);
  assert.equal(await wallet.getByText('Wkrótce dostępny',{exact:true}).count(),5);
  assert.equal(await wallet.getByRole('button',{name:'Wykorzystaj',exact:true}).count(),0,'Future vouchers cannot be used early');
  assert.match(await wallet.locator('.ws-vouchers__meta').first().innerText(),/Ważny od/);
  assert.equal(await shortcut.getByRole('img',{name:'Nowe vouchery',exact:true}).count(),0,'Reading vouchers acknowledges the notice');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/voucher-awards-${width}.png`});
  await page.locator('.ws-modal__close').click();
  await page.evaluate(ref=>window.dispatchEvent(new CustomEvent('ws:stripe-recovery',{detail:{orderRef:ref}})),reference);
  await payment.getByText('Dodano vouchery do Twojego konta: 5',{exact:true}).waitFor();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await shortcut.getByRole('img',{name:'Nowe vouchery',exact:true}).count(),0,'Reopening an acknowledged order does not create another notice');
  await page.evaluate(()=>window.dispatchEvent(new Event('ws:session-ended')));
  assert.equal(await page.evaluate(()=>window.WSSessionStorage.getItem('ws.voucher-notices.42')),null);
  assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS voucher awards ${width}px: paid-only confirmation, unread badge, reload, future vouchers, acknowledgement, session cleanup`);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
