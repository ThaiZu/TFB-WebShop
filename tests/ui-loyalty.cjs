/* Real build, intercepted HTTP only; no live API, customer data or database. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD || '/tmp/tfbuddy-fid07-build';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.CHROMIUM_PATH || undefined});
 try {
  for(const width of [1440,390]) {
   const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
   await context.addInitScript(()=>{
    const createdAt=Date.now();
    for(const [key,value] of [['ws.lang','pl'],['ws_auth_token','access-A']])
     sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt,expiresAt:createdAt+43200000}));
   });
   const errors=[],external=[],loyaltyRequests=[];

   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='webshop.test'&&!url.pathname.startsWith('/api/v1/')) return serveBuild(route,build);
    if(!['api.example.invalid','webshop.test'].includes(url.hostname)){external.push(req.url());return route.abort();}
    let data=[];
    const isA=req.headers().authorization==='Bearer access-A';
    if(url.pathname.endsWith('/clients/auth/me')) data={user:{id:isA?1:2,firstName:isA?'Anna':'Beata',email:isA?'anna@example.invalid':'beata@example.invalid',lastName:'Test',phone:'+32470123456',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,isBusiness:false,invoice:{},fidelityApp:{active:true,installUrl:'https://obsolete-pwa.invalid'}}};
    else if(url.pathname.endsWith('/clients/auth/login')) data={access_token:'access-B',session_transport:'cookie'};
    else if(url.pathname.endsWith('/clients/auth/refresh')) return route.fulfill({status:401,json:{}});
    else if(url.pathname.endsWith('/clients/auth/logout')) data={ok:true};
    else if(url.pathname.endsWith('/shops')) data=[{id:2,name:'Shop A',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1},{id:3,name:'Shop B',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
    else if(url.pathname.endsWith('/products/available')) data=[{id:11,name:'Test bread',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'10.00',allergen_codes:[],ingredients:''},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}];
    else if(url.pathname.startsWith('/shared-assets/'))return route.fulfill({status:404,body:''});
    else if(url.pathname.endsWith('/locale')) data={language:'pl'};
    else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:false};
    else if(url.pathname.endsWith('/privacy-config')) data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
    else if(url.pathname.endsWith('/brand')) data={};
    else if(url.pathname.includes('/webshop/loyalty/')) {
     loyaltyRequests.push(req.url()); assert.equal(url.searchParams.has('clientId'),false); assert.ok(req.headers().authorization);
     if (url.pathname.endsWith('/identity')) data={status:'available',code:'9800000000000001'};
     else if (url.pathname.endsWith('/personal/wallet')) data={balance:47,history:[{source:'PURCHASE',points:3,occurred_at:'2026-11-20 12:00:00'}],bingo:null};
     else throw new Error('Unexpected loyalty request: '+url.pathname);
    }
    try {await route.fulfill({json:data});} catch(error) {if(!/closed|intercept|handled/i.test(error.message)) throw error;}
   });
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   await page.goto('https://webshop.test/?shop=2');
   await page.locator('.ws-nav__avatar').waitFor({state:'attached'});
   await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);
   await page.locator('.ws-cookie-actions button').last().click();
   await page.locator('.ws-cookie-panel').waitFor({state:'detached'});
   const account=width<1024 ? page.locator('.ws-tabbar__btn--account') : page.getByRole('button',{name:'Konto',exact:true});
   await account.click();await page.getByText('anna@example.invalid',{exact:true}).waitFor();
   await page.getByRole('tab',{name:'Program lojalnościowy',exact:true}).click();
   await page.getByRole('heading',{name:'Saldo punktów: 47'}).waitFor();
   await page.getByText('Obecnie nie trwa żadna edycja Bingo.').waitFor();
   await page.getByText('+3',{exact:true}).waitFor();
   await page.locator('.ws-modal__close').click();
   const shortcut=page.locator(width<1024?'.ws-tabbar__btn--loyalty':'.ws-nav__loyalty');
   await shortcut.click();
   const wallet=page.getByRole('dialog');
   await wallet.getByRole('heading',{name:'Saldo punktów: 47'}).waitFor();
   await wallet.locator('.ws-loyalty-wallet__barcode svg').waitFor();
   await wallet.getByRole('button',{name:'Bingo',exact:true}).click();
   await wallet.getByText('Obecnie nie trwa żadna edycja Bingo.').waitFor();
   assert.ok(!loyaltyRequests.some(url=>url.includes('/cards')||url.includes('/rewards')));
   assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
   await context.close();
   console.log('PASS: personal wallet, profile and identity, '+width+'px');
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
