/* Built WebShop, intercepted HTTP only, no live API or orders. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD||'/tmp/tfbuddy-fid08-build';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
  await context.addInitScript(()=>{const now=Date.now();for(const [key,value] of [['ws.lang','pl'],['ws_auth_token','test-A'],['ws_auth_refresh_token','refresh-A']])sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt:now,expiresAt:now+43200000}));});
  let flag=true,failure=false,guest=false,hold=false,release,started=false;
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
   else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:flag};
   else if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Shop A',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1},{id:3,name:'Shop B',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/products/available'))data=[11,12,13].map(id=>({id,name:id===11?'Pain test':id===12?'Pain complet':'No card',id_category:3,is_active:1,webshop_active:1,is_piece_based:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'2.00',allergen_codes:[],ingredients:''},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false},loyaltyStatus:'available',loyaltyCard:id===13?null:card}));
   else if(url.pathname.endsWith('/cart/quote')){
    const p=req.postDataJSON(),quoteGuest=guest;quotes.push(p);
    if(hold&&p.include_loyalty){started=true;await new Promise(resolve=>{release=resolve;});}
    const total=p.products.reduce((sum,line)=>sum+Number(line.quantity)*2,0).toFixed(2);
    data={items:p.products.map(line=>({...line,total_gross_value_after_discount:(Number(line.quantity)*2).toFixed(2)})),totals:{gross_before_discount:total,gross_after_discount:total,discount:'0.00'},promotion_suggestions:[]};
    if(p.include_loyalty){const lines=p.products.filter(line=>line.id_product!==13).map(line=>({lineKey:line.line_key,cardId:1,increment:Number(line.quantity)}));const increment=lines.reduce((sum,line)=>sum+line.increment,0),before=p.id_shop===3?2:8,newRewards=Math.floor((before+increment)/10),after=(before+increment)%10;
     data.loyalty_preview=failure?{status:'unavailable',cards:[],lines:[]}:{status:quoteGuest?'signIn':'available',lines,cards:lines.length?[{...card,increment,before:quoteGuest?null:before,after:quoteGuest?null:after,newRewards:quoteGuest?null:newRewards,remaining:quoteGuest?null:10-after,pendingEvents:quoteGuest?null:1}]:[]};}
   }else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/locale'))data={lang:'pl',country:'PL'};
   else if(url.pathname.endsWith('/brand'))data={};
   else if(url.pathname.endsWith('/webshop/loyalty/cards'))data={status:'available',asOf:new Date().toISOString(),items:[],nextCursor:null};
   try{await route.fulfill({json:data});}catch(e){if(!/closed|handled/i.test(e.message))throw e;}
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://webshop.test/?shop=2&category=category%3A3');
  await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);await page.locator('.ws-cookie-actions button').last().click();
  const icons=page.locator('.ws-card .ws-loyalty-icon__button'),popup=page.locator('.ws-loyalty-popover');
  await icons.first().waitFor();assert.equal(await icons.count(),2);
  await icons.first().focus();await page.keyboard.press('Enter');await popup.getByText('Saldo: 8 → 9 / 10',{exact:true}).waitFor({timeout:10000}).catch(async e=>{await page.screenshot({path:'/tmp/fid08-failure.png'});console.log({errors,quotes,popup:await popup.allTextContents(),expanded:await icons.first().getAttribute('aria-expanded')});throw e;});
  assert.equal(await page.locator('.pdm-title').count(),0);
  await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});assert.equal(await icons.first().evaluate(el=>el===document.activeElement),true);
  await page.locator('.ws-card .ws-add').first().click();const detailIcon=page.locator('.pdm-head .ws-loyalty-icon__button');await detailIcon.waitFor();
  await page.locator('.pdm-qty__btn').last().click();await page.locator('.pdm-qty__btn').last().click();await detailIcon.click();
  await popup.getByText('Pieczątki za tę pozycję: +3',{exact:true}).waitFor();await popup.getByText('Saldo: 8 → 1 / 10',{exact:true}).waitFor();
  await popup.getByText('Przewidywane nowe nagrody: 1',{exact:true}).waitFor();assert.ok((await popup.innerText()).includes('Oczekujące operacje'));
  await page.screenshot({path:`/tmp/fid08-detail-${width}.png`,fullPage:true});
  await page.keyboard.press('Escape');assert.equal(await page.locator('.pdm-title').count(),1);await page.locator('.pdm-cta').click();await page.locator('.pdm-title').waitFor({state:'detached'});
  await icons.nth(1).click();await popup.getByText('Pieczątki za cały koszyk: +4',{exact:true}).waitFor();await popup.getByText('Pieczątki za tę pozycję: +1',{exact:true}).waitFor();
  await page.mouse.click(width-5,60);await popup.waitFor({state:'detached'});
  if(width<1024)await page.locator('.ws-tabbar__btn--cart').click();
  await page.locator('.ws-basket:visible .ws-loyalty-icon__button').first().click();await popup.getByText('Pieczątki za cały koszyk: +3',{exact:true}).waitFor();await page.keyboard.press('Escape');
  if(width<1024)await page.locator('.ws-drawer__close').click();
  failure=true;await icons.first().click();await popup.getByText('Prognoza jest chwilowo niedostępna. Możesz kontynuować zakupy.',{exact:true}).waitFor();assert.ok(!(await popup.innerText()).includes('Saldo:'));
  failure=false;await popup.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();await popup.getByText('Pieczątki za cały koszyk: +4',{exact:true}).waitFor();
  await popup.getByRole('button',{name:'Moje karty',exact:true}).click();await page.locator('[role="tab"][aria-selected="true"]').filter({hasText:'Program lojalnościowy'}).waitFor();await page.locator('.ws-modal__close').click();
  await page.locator('.ws-nav__shopchip:visible,.ws-nav__shopplate:visible,.ws-shopbar__switch:visible').first().click();
  await page.locator('.ws-shopcard').filter({hasText:'Shop B'}).click();
  await page.getByRole('button',{name:'Usuń koszyk i zmień sklep',exact:true}).click();
  await page.locator('.ws-pref-nudge__no').click();
  await icons.first().click();await popup.getByText('Saldo: 2 → 3 / 10',{exact:true}).waitFor();await page.keyboard.press('Escape');
  hold=true;await icons.first().click();for(let i=0;i<50&&!started;i++)await page.waitForTimeout(20);assert.ok(started);
  guest=true;await page.evaluate(()=>window.WSAuth.logout());hold=false;release();await popup.waitFor({state:'detached'});
  await icons.first().click();await popup.getByText('Zaloguj się, aby zobaczyć prognozę dla swojego salda.',{exact:true}).waitFor();assert.ok(!(await popup.innerText()).includes('Saldo:'));
  await page.screenshot({path:`/tmp/fid08-guest-${width}.png`,fullPage:true});await page.keyboard.press('Escape');
  flag=false;await page.reload();await page.locator('.ws-card').first().waitFor();assert.equal(await page.locator('.ws-loyalty-icon__button').count(),0);
  assert.ok(quotes.some(p=>p.include_loyalty===true));assert.ok(quotes.every(p=>p.id_client===undefined));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();console.log(`PASS Fidelity shopping ${width}px`);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
