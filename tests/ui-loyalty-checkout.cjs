/* Intercept orders/Stripe. Local pickup may read the actual payment-method list. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD||'/tmp/fidelity-checkout-build';
const local=process.env.CHECKOUT_LOCAL_URL||null;
const pageData=(items,nextCursor=null)=>({status:'available',asOf:new Date().toISOString(),items,nextCursor});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try {for(const width of [1440,390]) {for(const scenario of (process.env.CHECKOUT_SCENARIOS||'none,reserved,expired,mismatch,optional,free,pickup,unavailable,mixed,invoice').split(',')) {
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
  await context.addInitScript(()=>{const now=Date.now()-3600000;for(const [key,value] of [['ws.lang','pl'],['ws_auth_token','test-A'],['ws_auth_refresh_token','refresh-A']])sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt:now,expiresAt:now+43200000}));});
  const errors=[],orders=[],quotes=[];let stripeCalls=0,rewardMode=['optional','free'].includes(scenario)?'ready':['pickup','unavailable','mixed'].includes(scenario)?'none':scenario;
  const loyaltyApi=require('./helpers/loyalty-api-fixture.cjs')({accessToken:'test-A',findVoucher:code=>code==='PERSONAL-4'?{name:'Personal bread'}:null});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='webshop.test')return serveBuild(route,build);
   const localHost=local&&url.hostname===new URL(local).hostname;
   if(localHost&&!url.pathname.includes('/api/v1/'))return route.continue();
   if(localHost&&scenario==='pickup'&&url.pathname.endsWith('/payment-methods'))return route.continue();
   if(url.hostname!=='api.example.invalid'&&!(localHost&&url.pathname.includes('/api/v1/')))return route.abort();
   const fixture=loyaltyApi(route.request());if(fixture)return route.fulfill(fixture);
   let data=[];
   if(url.pathname.endsWith('/clients/auth/me'))data={user:{id:1,firstName:'Anna',lastName:'Test',email:'anna@example.invalid',phone:'+32470123456',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,invoice:{}}};
   else if(url.pathname.endsWith('/clients/auth/refresh'))return route.fulfill({status:401,json:{}});
   else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:true};
   else if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Shop A',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/products/available'))data=[{id:11,name:'Test bread',id_category:3,is_active:1,webshop_active:1,is_piece_based:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'10.00',allergen_codes:[],ingredients:''},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}];
   else if(url.pathname.endsWith('/cart/quote')){
    const p=req.postDataJSON();quotes.push(p);const discount=p.voucher_code?'10.00':'0.00',total=p.voucher_code?'0.00':'10.00';
    data={items:p.products.map(line=>({...line,unit_gross_price:'10.00',total_gross_value_before_discount:'10.00',total_gross_value_after_discount:total,item_discount_value:discount})),shopping_context:p.shopping_context,billing:{mode:'person'},totals:{gross_before_discount:'10.00',gross_after_discount:total,discount},promotion_suggestions:[],...(p.voucher_code?{voucher:{code:p.voucher_code,valid:true,matches_cart:true}}:{})};
   }
   else if(url.pathname.endsWith('/availability/slots'))data=[{id:1,label:'15:00 – 15:30',capacity:30,current_orders:0,available:true}];
   else if(url.pathname.endsWith('/payment-methods'))data=scenario==='unavailable'?[]:scenario==='pickup'?[{method:'shop',family:'shop',label:'Pay at pickup'}]:[...(scenario==='mixed'?[{method:'shop',family:'shop',label:'Pay at pickup'}]:[]),{method:'stripe',family:'stripe',label:'Karta'}];
   else if(url.pathname.endsWith('/webshop/billing/companies'))data=[
    {id:50,name:'Default company',vat:'BE0123456789',isDefault:true},
    {id:51,name:'Other company',vat:'BE0987654321',isDefault:false},
   ];
   else if(url.pathname.endsWith('/webshop/vouchers/prepare'))data={prepared:0,hasMore:false};
   else if(url.pathname.endsWith('/webshop/vouchers'))data=pageData([{id:4,code:'PERSONAL-4',name:'Test bread',source:'LOYALTY',status:'READY',validFrom:null,validTo:null,canUse:true}]);
   else if(url.pathname.endsWith('/webshop/loyalty/identity'))data={status:'available',code:'FID1-1-'+'A'.repeat(32)};
   else if(url.pathname.endsWith('/webshop/loyalty/cards'))data=pageData([{id:1,name:'Pain',required:10,balance:2,progress:2,debt:0,pendingEvents:0,readyRewards:rewardMode==='none'?0:1,accepting:true,shops:[{id:2,name:'Shop A'}],rewardLabel:'Bread'}]);
   else if(url.pathname.endsWith('/webshop/loyalty/rewards')&&rewardMode==='ready'&&!url.searchParams.has('cursor'))data=pageData([{id:3,status:'EXPIRED',code:null,earnedAt:'2026-01-01T00:00:00Z',expiresAt:'2000-01-01T00:00:00Z',productIds:[11],portionIds:[],stampsCost:10}],'rewards-next');
   else if(url.pathname.endsWith('/webshop/loyalty/rewards'))data=pageData(rewardMode==='none'?[]:[{id:4,status:rewardMode==='reserved'?'RESERVED':'READY',code:rewardMode==='reserved'?null:'A'.repeat(32),earnedAt:'2026-10-01T00:00:00Z',expiresAt:rewardMode==='expired'?'2000-01-01T00:00:00Z':null,productIds:rewardMode==='mismatch'?[12]:[11],portionIds:[],stampsCost:10}]);
   else if(url.pathname.endsWith('/webshop/orders')&&req.method()==='POST'){const payload=req.postDataJSON();orders.push(payload);data={orderId:44,orderRef:'WEB-2-20261030-ABCDEF',total:payload.voucher?0:10,paymentType:payload.payment.method};}
   else if(url.pathname.endsWith('/stripe-checkout')){stripeCalls++;data={status:'paid'};}
   else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/locale'))data={lang:'pl',country:'PL'};
   try {await route.fulfill({json:data});}catch(e){if(!/closed|handled/i.test(e.message))throw e;}
  });
  let page=null;
  async function checkout(mode){
   rewardMode=mode;if(page)await page.close();page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')console.log('Browser:',message.text());});
   const config=context.waitForEvent('response',{predicate:response=>new URL(response.url()).pathname.endsWith('/config')});
   await page.goto((local||'https://webshop.test/')+'?shop=2&category=category%3A3');
   await config;
   await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);
   if(await page.locator('.ws-cookie-panel').count()){await page.locator('.ws-cookie-actions button').last().click();await page.locator('.ws-cookie-panel').waitFor({state:'detached'});}
   await page.locator('.ws-nav__avatar').waitFor({state:'attached'}).catch(async error=>{console.log({width,scenario,errors,auth:await page.evaluate(()=>({auth:!!window.WSAuth,token:!!window.WSSessionStorage?.getItem('ws_auth_token')}))});await page.screenshot({path:'/tmp/checkout-startup-stuck.png'});throw error;});
   await page.locator('.ws-tabbar__btn--loyalty').waitFor({state:'attached'});
   if(scenario==='free') {
    await page.locator(width<1024?'.ws-tabbar__btn--account':'.ws-nav__avatar').click();
    await page.getByRole('tab',{name:'Moje Vouchery',exact:true}).click();
    await page.getByRole('region',{name:'Moje Vouchery',exact:true}).getByRole('button',{name:'Wykorzystaj',exact:true}).click();
    await page.getByRole('button',{name:'Wybrany',exact:true}).waitFor();
    await page.locator('.ws-modal__close').click();
    await page.locator('.ws-modal').waitFor({state:'detached'});
    if(await page.locator('.ws-toast__close').count())await page.locator('.ws-toast__close').click();
   }
   await page.locator('.ws-card .ws-add').first().click();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
   if(width<1024)await page.locator('.ws-tabbar__btn--cart').click();
   await page.locator('.ws-basket:visible .ws-cta').click();
   const next=page.locator('.ws-checkout__foot-actions .ws-cta');
   await next.click();
   await page.getByText('15:00 – 15:30',{exact:true}).click().catch(async error=>{await page.screenshot({path:'/tmp/checkout-stuck.png'});console.log({width,mode,errors,checkout:await page.locator('.ws-checkout').innerText().catch(()=>null),button:await next.evaluate(el=>({disabled:el.disabled,conf:!!el.__wsTapConf,press:el.__wsTap})).catch(()=>null)});throw error;});await next.click();
   if(!['unavailable','pickup'].includes(scenario))await page.locator('input[name=payment]:checked').waitFor({state:'attached'}).catch(async error=>{await page.screenshot({path:'/tmp/checkout-payment-stuck.png'});console.log({width,mode,errors,checkout:await page.locator('.ws-checkout').innerText().catch(()=>null),button:await next.evaluate(el=>({disabled:el.disabled,conf:!!el.__wsTapConf,press:el.__wsTap})).catch(()=>null)});throw error;});
   return next;
  }
  const pay=await checkout(rewardMode);
  if(scenario==='invoice') {
   const types=page.getByRole('group',{name:'Rodzaj faktury',exact:true});
   const none=types.getByRole('radio',{name:'Bez faktury'});
   const personal=types.getByRole('radio',{name:'Faktura imienna'});
   const company=types.getByRole('radio',{name:'Faktura na firmę'});
   const companies=page.getByLabel('Firma do faktury');
   assert.equal(await types.getByRole('radio').count(),3);
   assert.equal(await none.isChecked(),true);
   await personal.check();
   assert.equal(await companies.count(),0);
   await none.check();
   await company.check();
   assert.equal(await companies.inputValue(),'50');
   assert.ok((await companies.boundingBox()).height>=52);
   assert.equal(await companies.evaluate(node=>getComputedStyle(node).fontSize),'16px');
   await companies.selectOption('51');
  }
  const rewardPanel=page.getByRole('region',{name:'Odbiór nagrody',exact:true});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await rewardPanel.count(),0,'Legacy reward picker is replaced by the voucher wallet');
  if(scenario==='free')await page.waitForFunction(()=>document.querySelector('input[name=payment]:checked')?.value==='shop');
  if(['unavailable','pickup'].includes(scenario)) {
   assert.equal(await pay.isDisabled(),true);
   await page.locator('.ws-checkout__foot [role=alert]').getByText(/Brak dostępnych metod płatności/).waitFor();
   assert.equal(await page.locator('input[name=payment][value=shop]').count(),0,'Paid goods never offer pickup payment');
   assert.equal(await pay.evaluate(node=>getComputedStyle(node).cursor),'not-allowed');
   assert.equal(orders.length,0);assert.equal(stripeCalls,0);
  } else if(['none','optional','free','mixed','invoice'].includes(scenario)) {
   if(scenario==='mixed')assert.equal(await page.locator('input[name=payment][value=shop]').count(),0,'Old API pickup option is filtered out');
   await page.screenshot({path:`/tmp/fidelity-checkout-${scenario}-${width}.png`});
   if(scenario==='optional'){await pay.focus();await page.keyboard.press('Enter');}
   else if(width<600)await pay.tap();else await pay.click();
   await page.waitForFunction(()=>document.querySelector('.ws-checkout')===null,{},{timeout:10000}).catch(async error=>{console.log({width,scenario,errors,orders,alerts:await page.getByRole('alert').allTextContents()});throw error;});
   assert.equal(orders.length,1);
   assert.equal(orders[0].loyalty_reward||null,null);
   assert.equal(orders[0].voucher||null,scenario==='free'?'PERSONAL-4':null);
   if(scenario==='invoice')assert.deepEqual(orders[0].invoice_request,{type:'company',companyId:51,po:''});
   assert.equal(orders[0].payment.method,scenario==='free'?'shop':'stripe');
   assert.equal(stripeCalls,scenario==='free'?0:1);
  } else assert.equal(orders.length,0);
  assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS checkout ${width}px: ${scenario}`);
 } }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
