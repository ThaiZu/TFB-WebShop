/* Built WebShop, intercepted HTTP only, no live API or orders. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD||'/tmp/tfbuddy-fid08-build';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
  await context.addInitScript(()=>{const now=Date.now();for(const [key,value] of [['ws.lang','pl'],['ws_auth_token','test-A'],['ws_auth_refresh_token','refresh-A']])sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt:now,expiresAt:now+43200000}));});
  let guest=false;
  const errors=[],quotes=[],external=[],card={id:1,name:'Pain',required:10,colorAccent:'#78352d'};
  const loyaltyApi=require('./helpers/loyalty-api-fixture.cjs')({accessToken:'test-A'});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='webshop.test')return serveBuild(route,build);
   if(url.hostname!=='api.example.invalid'){external.push(req.url());return route.abort();}
   const fixture=loyaltyApi(route.request());if(fixture)return route.fulfill(fixture);
   let data=[];
   if(url.pathname.endsWith('/clients/auth/me')){
    if(guest)return route.fulfill({status:401,json:{}});
    data={user:{id:1,firstName:'Anna',lastName:'Test',email:'anna@example.invalid',phone:'+32470123456',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,invoice:{}}};
   }else if(url.pathname.endsWith('/clients/auth/refresh'))return route.fulfill({status:401,json:{}});
   else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:false};
   else if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Shop A',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1},{id:3,name:'Shop B',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/products/available'))data=[11,12,13].map(id=>({id,name:id===11?'Pain test':id===12?'Pain complet':'No card',id_category:3,is_active:1,webshop_active:1,is_piece_based:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'2.00',allergen_codes:[],ingredients:''},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false},loyaltyStatus:'available',loyaltyCard:id===13?null:card}));
   else if(url.pathname.endsWith('/cart/quote')){
    const p=req.postDataJSON();quotes.push(p);
    const total=p.products.reduce((sum,line)=>sum+Number(line.quantity)*2,0).toFixed(2);
    data={items:p.products.map(line=>({...line,total_gross_value_after_discount:(Number(line.quantity)*2).toFixed(2)})),totals:{gross_before_discount:total,gross_after_discount:total,discount:'0.00'},promotion_suggestions:[]};
    if(p.include_loyalty)data.loyalty_preview={status:'available',cards:[],lines:[],points:{points:2,base_cents:200}};
   }else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/locale'))data={lang:'pl',country:'PL'};
   else if(url.pathname.endsWith('/brand'))data={};
   else if(url.pathname.endsWith('/webshop/loyalty/cards'))data={status:'available',asOf:new Date().toISOString(),items:[],nextCursor:null};
   try{await route.fulfill({json:data});}catch(e){if(!/closed|handled/i.test(e.message))throw e;}
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://webshop.test/?shop=2&category=category%3A3');
  await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);await page.locator('.ws-cookie-actions button').last().click();
  await page.locator('.ws-card').first().waitFor();
  assert.equal(await page.locator('.ws-loyalty-icon__button').count(),0);
  await page.locator('.ws-card .ws-add').first().click();
  await page.locator('.pdm-cta').click();
  await page.locator('.pdm-cta').waitFor({state:'detached'});
  if(width<1024)await page.locator('.ws-tabbar__btn--cart').click();
  await page.locator('.ws-basket:visible').getByText('Przewidywane punkty',{exact:true}).waitFor();
  assert.ok(quotes.some(p=>p.include_loyalty===true));
  assert.ok(quotes.every(p=>p.id_client===undefined && p.loyalty_reward===undefined));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await context.close();console.log('PASS: basket points without legacy cards at '+width+'px');
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
