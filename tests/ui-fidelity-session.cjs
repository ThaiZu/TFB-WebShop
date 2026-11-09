/* Production build with intercepted HTTP only: no real accounts, API or DB. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD || '/tmp/tfbuddy-fidelity-session-build';

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.CHROMIUM_PATH || undefined});
 try {
  for (const width of [1440,390]) {
   const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
   await context.addInitScript(()=>{
    const createdAt=Date.now();
    for(const [key,value] of [['ws.lang','pl'],['ws_auth_token','access-A'],['ws_auth_refresh_token','refresh-A']]) {
     sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt,expiresAt:createdAt+43200000}));
    }
   });
   let refreshStatus=503, loginCalls=0, handoffCalls=0;
   const errors=[],external=[];
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='webshop.test')return serveBuild(route,build);
    if(url.hostname!=='api.example.invalid'){external.push(req.url());return route.abort();}
    let data=[];
    if(url.pathname.endsWith('/clients/auth/me')) {
     const a=req.headers().authorization==='Bearer access-A';
     data={user:{id:a?1:2,firstName:a?'Anna':'Beata',lastName:'Test',email:a?'anna@example.invalid':'beata@example.invalid',phone:'+32470123456',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,isBusiness:false,invoice:{}}};
    } else if(url.pathname.endsWith('/clients/auth/refresh'))return route.fulfill({status:refreshStatus,json:{description:'Session rejected'}});
    else if(url.pathname.endsWith('/clients/auth/login')){
     loginCalls++; assert.equal(req.headers().authorization,undefined);
     assert.equal(req.postDataJSON().login,'beata@example.invalid');
     data={access_token:'access-B',session_transport:'cookie'};
    } else if(url.pathname.endsWith('/clients/auth/logout'))data={ok:true};
    else if(url.pathname.endsWith('/handoff')){handoffCalls++;return route.fulfill({status:404,json:{}});}
    else if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
    else if(url.pathname.endsWith('/products/available'))data=[{id:11,name:'Test baguette',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'10.00',allergen_codes:[],ingredients:''},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}];
    else if(url.pathname.endsWith('/locale'))data={language:'pl'};
    else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:false};
    else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
    else if(url.pathname.endsWith('/brand'))data={};
    await route.fulfill({json:data});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
   await page.goto('https://webshop.test/?shop=2&handoff=obsolete-prototype-token');
   await page.locator('.ws-nav__avatar').waitFor({state:'attached'});
   assert.equal(await page.locator('.ws-nav__avatar').textContent(),'A');
   assert.equal(new URL(page.url()).searchParams.has('handoff'),false);
   assert.equal(handoffCalls,0);assert.equal(navigations<=2,true,'No hard reload from prototype link');
   await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);
   await page.locator('.ws-cookie-actions button').last().click();
   await page.locator('.ws-cookie-panel').waitFor({state:'detached'});
   const accountButton=width<1024 ? page.locator('.ws-tabbar__btn--account') : page.getByRole('button',{name:'Konto',exact:true});
   await accountButton.click();await page.getByText('anna@example.invalid',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.WSAuth.refresh()),false);
   assert.equal(await page.locator('.ws-nav__avatar').count(),1,'503 preserves account');
   assert.equal(await page.getByText('anna@example.invalid',{exact:true}).count(),1);
   refreshStatus=401;
   assert.equal(await page.evaluate(()=>window.WSAuth.refresh()),false);
   await page.locator('.ws-nav__avatar').waitFor({state:'detached'});
   assert.equal(await page.getByText('anna@example.invalid',{exact:true}).count(),0,'Revocation removes mounted profile');
   assert.equal(await page.evaluate(()=>window.WSSessionStorage.getItem('ws_auth_token')),null);
   await accountButton.click();
   await page.locator('input[autocomplete=username]').fill('beata@example.invalid');
   await page.locator('input[autocomplete=current-password]').fill('test-password');
   await page.locator('form:has(input[autocomplete=current-password]) button[type=submit]').click();
   await page.locator('.ws-nav__avatar').waitFor({state:'attached'});
   assert.equal(await page.locator('.ws-nav__avatar').textContent(),'B');
   assert.equal(loginCalls,1);
   await page.locator('.ws-shop-confirm .ws-cta').click();
   await accountButton.click();
   await page.getByText('beata@example.invalid',{exact:true}).waitFor();
   assert.equal(await page.getByText('anna@example.invalid',{exact:true}).count(),0);
   await page.locator('.ws-acc__logout').click();await page.locator('.ws-nav__avatar').waitFor({state:'detached'});
   assert.equal(await page.getByText('beata@example.invalid',{exact:true}).count(),0);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   await context.close();
  }
  console.log('PASS: existing session restored despite legacy handoff; 503 preserves account; 401 closes profile; real login form switches A→B; logout clears view; desktop/mobile; no live API or JS errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
