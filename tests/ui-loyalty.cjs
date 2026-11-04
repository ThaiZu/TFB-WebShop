/* Real build, intercepted HTTP only; no live API, customer data or database. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD || '/tmp/tfbuddy-fid07-build';
const pageData=(items,nextCursor=null)=>({status:'available',asOf:new Date().toISOString(),items,nextCursor});
const card=(id,name,changes={})=>({id,name,code:'pain',version:1,required:10,balance:8,progress:8,debt:0,pendingEvents:1,readyRewards:1,accepting:true,hasHistory:true,
  scope:'SHOP',shops:[{id:2,name:'Shop A'}],rewardLabel:'Jeden chleb gratis',imagePath:'',colorTint:'#f8dbbe',colorFill:'#78352d',colorAccent:'#573a23',...changes});
const reward=(id,status='READY',changes={})=>({id,status,code:status==='READY' ? id.toString(16).toUpperCase().padStart(32,'A') : null,
  earnedAt:'2026-01-01T10:00:00Z',expiresAt:null,redeemedAt:null,stampsCost:10,...changes});

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
   let mode='ready',flag=true,releaseConfig,releaseCards,held=false;
   const configGate=new Promise(resolve=>{releaseConfig=resolve;});
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='webshop.test') return serveBuild(route,build);
    if(url.hostname!=='api.example.invalid'){external.push(req.url());return route.abort();}
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
    else if(url.pathname.endsWith('/config')){await configGate;data=flag===null?{}:{fidelityTabEnabled:flag};}
    else if(url.pathname.endsWith('/privacy-config')) data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
    else if(url.pathname.endsWith('/brand')) data={};
    else if(url.pathname.includes('/webshop/loyalty/')) {
     loyaltyRequests.push(req.url()); assert.equal(url.searchParams.has('clientId'),false); assert.ok(req.headers().authorization);
     const kind=url.pathname.split('/').pop(),cursor=url.searchParams.get('cursor');
     if(kind==='identity')data={status:'available',code:'FID1-'+(isA?'1':'2')+'-'+(isA?'A':'B').repeat(32)};
     else if(kind==='program') data={status:'available',asOf:new Date().toISOString(),id:Number(url.searchParams.get('cardId')),startsAt:'2026-10-01T00:00:00Z',endsAt:null,rewardValidityDays:30,products:[{id:11,name:'Test bread'},{id:12,name:'Tarta jabłkowa'}],categories:[{id:3,name:'Pieczywo'}],excludedProducts:[{id:13,name:'Bułka'}],rewardChoices:[{id:12,name:'Tarta jabłkowa',portion:null},{id:101,name:'Tarta jabłkowa',portion:'1/2'}]};
     else if(kind==='cards') {
      if(mode==='error') return route.fulfill({status:503,json:{error:'LOYALTY_UNAVAILABLE'}});
      if(mode==='hold') {held=true; await new Promise(resolve=>{releaseCards=resolve;});}
      data=pageData(url.searchParams.get('shopId')==='3' ? [card(10,'Karta sklepu B',{shops:[{id:3,name:'Shop B'}]})] : !isA ? [card(9,'Karta Beaty')] : mode==='empty' ? [] : cursor ? [card(3,'Sieć',{required:100,balance:25,progress:25,scope:'NETWORK',shops:[{id:2,name:'Shop A'},{id:3,name:'Shop B'}]})] : [card(1,'Pain Anny'),card(2,'Cookies',{balance:-2,progress:0,debt:2,accepting:false,pendingEvents:0,imagePath:'/images/missing.svg',imageUrl:'https://api.example.invalid/shared-assets/images/missing.svg'})], isA && mode!=='empty' && !cursor ? 'cards-2' : null);
     } else if(kind==='rewards') data=pageData(cursor ? [reward(6)] : [reward(1),reward(2,'RESERVED'),reward(3,'EXPIRED',{expiresAt:'2026-02-01T10:00:00Z'}),reward(4,'REDEEMED'),reward(5,'REVOKED')],cursor?null:'rewards-2');
     else data=pageData(cursor ? [{id:'1',kind:'EARN',delta:8,balanceAfter:8,occurredAt:'2026-01-01T10:00:00Z'}] : [{id:'3',kind:'ISSUE',delta:-10,balanceAfter:1,occurredAt:'2026-01-02T10:00:00Z'},{id:'2',kind:'EARN',delta:3,balanceAfter:11,occurredAt:'2026-01-02T10:00:00Z'}],cursor?null:'history-2');
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
   assert.equal(await page.getByRole('tab',{name:'Program lojalnościowy',exact:true}).count(),0,'Unknown flag must not expose loyalty');
   assert.equal(await page.locator('.ws-nav__loyalty').count(),0,'Unknown flag must not expose desktop shortcut');
   assert.equal(loyaltyRequests.length,0);
   releaseConfig();
   const fidelity=page.getByRole('tab',{name:'Program lojalnościowy',exact:true});
   await fidelity.click();
   await page.getByText('Pain Anny',{exact:true}).waitFor();
   await page.locator('.ws-loyalty__balance').first().getByText('8 z 10 pieczątek',{exact:true}).waitFor();
   const artwork=page.locator('.ws-loyalty__artwork').first();
   assert.equal(await artwork.locator('.ws-loyalty__stamp').count(),10);
   assert.equal(await artwork.locator('.ws-loyalty__stamp.is-filled').count(),8);
   assert.equal(await page.locator('.ws-loyalty__artwork').nth(1).locator('.is-filled').count(),0,'Debt must not fill stamps');
   assert.equal(await artwork.locator('.ws-loyalty__logo').evaluate(image=>image.complete&&image.naturalWidth>0),true);
   assert.ok((await artwork.locator('.ws-loyalty__reward-band').textContent()).includes('10 pieczątek = Jeden chleb gratis'));
   assert.equal(await artwork.evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(248, 219, 190)');
   assert.equal(await artwork.locator('h3').evaluate(node=>getComputedStyle(node).color),'rgb(87, 58, 35)');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Card artwork fits the viewport');
   await page.screenshot({path:`/tmp/fid07-cards-${width}.png`});
   await page.getByText(/oczekuje na rozliczenie/).waitFor();
   {
    await page.locator('.ws-modal__close').click();mode='hold';held=false;
    const shortcut=page.locator(width<1024?'.ws-tabbar__btn--loyalty':'.ws-nav__loyalty');
    if(width<1024){
     assert.equal(await page.locator('.ws-nav__loyalty').isVisible(),false);
     const [cartBox,qrBox,profileBox]=await Promise.all([page.locator('.ws-tabbar__btn--cart').boundingBox(),shortcut.boundingBox(),page.locator('.ws-tabbar__btn--account').boundingBox()]);
     assert.ok(cartBox.x+cartBox.width<=qrBox.x && qrBox.x+qrBox.width<=profileBox.x);
     assert.ok(Math.abs(qrBox.width-qrBox.height)<1);
    }else{
     const [qrBox,accountBox]=await Promise.all([shortcut.boundingBox(),account.boundingBox()]);
     assert.ok(qrBox.x+qrBox.width<=accountBox.x,'Desktop loyalty shortcut is beside the account');
     assert.equal(await shortcut.evaluate(node=>node.nextElementSibling.getAttribute('aria-label')),'Konto');
     assert.equal(await shortcut.getAttribute('aria-haspopup'),'dialog');
    }
    await shortcut.focus();await page.keyboard.press('Enter');await page.locator('.ws-loyalty-wallet:modal .ws-loyalty-wallet__qr svg').waitFor();
    assert.equal(await page.locator('.ws-loyalty-wallet__identity code').count(),0,'QR identity stays scannable without showing the raw code');
    assert.equal(await page.locator('.ws-loyalty-wallet__hint, .ws-loyalty-wallet header small').count(),0);
    await page.waitForFunction(()=>document.querySelector('.ws-loyalty-wallet__loading')===null);
    assert.equal(await page.locator('.ws-loyalty-wallet__program').count(),0,'Identity QR does not wait for program data');
    const qr=await page.locator('.ws-loyalty-wallet__qr').boundingBox();assert.ok(qr.y>=0&&qr.y+qr.height<=1000);
    await page.screenshot({path:'/tmp/fidelity-mobile-wallet.png'});
    mode='ready';await page.waitForFunction(()=>document.querySelector('.ws-loyalty-wallet__programs [role=status]')!==null);releaseCards();
    await page.locator('.ws-loyalty-wallet__program').first().waitFor();
    assert.equal(await page.locator('.ws-loyalty-wallet__program').first().locator('.is-filled').count(),8);
    await page.screenshot({path:`/tmp/fidelity-wallet-${width}.png`});
    await page.screenshot({path:'/tmp/fidelity-mobile-wallet-programs.png'});
    await page.locator('.ws-loyalty-wallet__program').first().click();
    const wallet=page.locator('.ws-loyalty-wallet:modal');
    const rulesToggle=wallet.locator('summary').filter({hasText:/^Zasady programu$/});
    const productsToggle=wallet.locator('summary').filter({hasText:/^Produkty naliczające pieczątki$/});
    const rewardChoicesToggle=wallet.locator('summary').filter({hasText:/^Produkty do wyboru jako nagroda$/});
    const historyToggle=wallet.locator('summary').filter({hasText:/^Historia pieczątek$/});
    const cardToggle=wallet.locator('.ws-loyalty-wallet__card>summary');
    await rulesToggle.waitFor();
    assert.equal(await wallet.locator('details').count(),5);
    assert.equal(await wallet.locator('details[open]').count(),1,'Only the card preview starts expanded');
    assert.equal(await cardToggle.evaluate(node=>node.parentElement.open),true);
    assert.equal(await wallet.getByLabel('Szukaj produktu',{exact:true}).isVisible(),false);
    assert.equal(await wallet.locator('.ws-loyalty__artwork').isVisible(),true);
    const cardBox=await wallet.locator('.ws-loyalty__artwork').boundingBox();
    assert.ok(cardBox.width<=301,'Program card uses a compact preview');
    assert.equal(await wallet.getByRole('region',{name:'Nagrody',exact:true}).count(),0,'Wallet omits the separate rewards list');
    assert.equal(loyaltyRequests.filter(url=>url.includes('/rewards')).length,0,'Wallet does not fetch hidden rewards');
    await page.screenshot({path:`/tmp/fidelity-program-collapsed-${width}.png`});
    await cardToggle.focus();await page.keyboard.press('Enter');
    assert.equal(await cardToggle.evaluate(node=>node.parentElement.open),false,'Card can still be collapsed');
    await page.keyboard.press('Enter');
    await wallet.locator('.ws-loyalty__artwork').waitFor();
    await page.screenshot({path:'/tmp/fidelity-mobile-program-top.png'});
    assert.equal(await wallet.locator('.ws-loyalty__artwork').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(248, 219, 190)');
    assert.equal(await wallet.evaluate(node=>node.scrollWidth>node.clientWidth),false,'Program details fit the wallet');
    assert.equal(await page.locator('.ws-modal').count(),0,'Details stay inside the wallet');
    assert.equal(loyaltyRequests.filter(url=>url.includes('/history')).length,0,'History loads on demand');
    await rulesToggle.click();
    await wallet.getByRole('region',{name:'Zasady programu',exact:true}).waitFor();
    await rulesToggle.click();
    assert.equal(await rulesToggle.evaluate(node=>node.parentElement.open),false,'Rules can be collapsed again');
    await productsToggle.click();
    await wallet.getByLabel('Szukaj produktu',{exact:true}).fill('tarta');
    assert.equal(await wallet.locator('.ws-loyalty-wallet__products li').count(),1);
    await page.screenshot({path:`/tmp/fidelity-program-products-${width}.png`});
    await productsToggle.click();await productsToggle.click();
    assert.equal(await wallet.getByLabel('Szukaj produktu',{exact:true}).inputValue(),'tarta','Product search survives collapsing');
    await rewardChoicesToggle.click();
    await wallet.getByRole('region',{name:'Produkty do wyboru jako nagroda'}).waitFor();
    assert.match(await wallet.getByRole('region',{name:'Produkty do wyboru jako nagroda'}).textContent(),/1\/2/);
    await rewardChoicesToggle.click();
    assert.equal(await rewardChoicesToggle.evaluate(node=>node.parentElement.open),false,'Reward choices can be collapsed again');
    await historyToggle.click();
    await wallet.getByRole('region',{name:'Historia pieczątek',exact:true}).waitFor();
    await wallet.getByText('Zdobyte pieczątki',{exact:true}).first().waitFor();
    await page.screenshot({path:'/tmp/fidelity-mobile-program-details.png'});
    await wallet.getByRole('button',{name:'Pokaż mój QR',exact:true}).click();
    await wallet.locator('.ws-loyalty-wallet__qr svg').waitFor();
    assert.equal(await wallet.evaluate(node=>node.scrollTop),0);
    await wallet.getByRole('button',{name:'Zamknij kartę klienta',exact:true}).click();
    assert.equal(await shortcut.evaluate(node=>node===document.activeElement),true,'Closing restores shortcut focus');
    await shortcut.click();await page.locator('.ws-loyalty-wallet:modal').waitFor();
    await page.keyboard.press('Escape');await page.locator('.ws-loyalty-wallet').waitFor({state:'detached'});
    await account.click();
    await fidelity.click();
    await page.getByText('Pain Anny',{exact:true}).waitFor();
   }

   await page.locator('.ws-loyalty').getByRole('button',{name:'Pokaż więcej',exact:true}).click();
   await page.getByText('Sieć',{exact:true}).waitFor();
   assert.equal(await page.locator('.ws-loyalty__card').count(),3);
   assert.equal(await page.locator('.ws-loyalty__card').nth(2).locator('.ws-loyalty__stamp').count(),20);
   assert.equal(await page.locator('.ws-loyalty__card').nth(2).locator('.ws-loyalty__stamp-limit').isVisible(),true);
   await page.waitForFunction(()=>{const image=document.querySelectorAll('.ws-loyalty__logo')[1];return image.complete&&image.naturalWidth>0&&!image.src.endsWith('missing.svg');});
   await page.locator('.ws-loyalty__card').first().getByRole('button',{name:'Nagrody i historia',exact:true}).click();
   const rewards=page.getByRole('region',{name:'Nagrody',exact:true});
   const history=page.getByRole('region',{name:'Historia pieczątek',exact:true});
   await rewards.getByText('Cofnięta po korekcie',{exact:true}).waitFor();
   assert.equal(await rewards.getByRole('button',{name:'Przejdź do Moich Voucherów',exact:true}).count(),1);
   assert.equal(await page.locator('.ws-loyalty__qr').count(),0,'Reward redemption moved to personal vouchers');
   assert.equal(await page.locator('.ws-loyalty__qr a').count(),0);
   await rewards.scrollIntoViewIfNeeded();
   await page.screenshot({path:`/tmp/fid07-qr-${width}.png`});
   await rewards.getByRole('button',{name:'Pokaż więcej',exact:true}).click();
   await history.getByRole('button',{name:'Pokaż więcej',exact:true}).click();
   await page.waitForFunction(()=>document.querySelectorAll('.ws-loyalty__reward').length===6 && document.querySelectorAll('.ws-loyalty__history li').length===3);
   await page.screenshot({path:`/tmp/fid07-${width}.png`});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'No horizontal page overflow');
   await page.getByRole('button',{name:'Wszystkie karty',exact:true}).click();
   mode='error';await page.locator('.ws-loyalty').getByRole('button',{name:'Odśwież',exact:true}).click();
   await page.getByText(/Nie udało się pobrać danych programu/).waitFor();
   assert.equal(await page.locator('.ws-loyalty__balance').count(),0,'Failure is not zero balance');
   mode='empty';await page.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();
   await page.getByText(/nie ma jeszcze kart dostępnych/).waitFor();
   mode='hold';await page.locator('.ws-loyalty').getByRole('button',{name:'Odśwież',exact:true}).click();
   await page.getByText('Wczytujemy karty…',{exact:true}).waitFor();
   await page.waitForTimeout(30);assert.equal(held,true);
   await page.evaluate(()=>window.WSAuth.logout());
   releaseCards();mode='ready';
   await page.locator('.ws-nav__avatar').waitFor({state:'detached'});
   assert.equal(await page.locator('.ws-loyalty').count(),0);
   await page.locator(width<1024?'.ws-tabbar__btn--loyalty':'.ws-nav__loyalty').click();
   await page.locator('input[autocomplete=username]').fill('beata@example.invalid');
   await page.locator('input[autocomplete=current-password]').fill('test-password');
   await page.locator('form:has(input[autocomplete=current-password]) button[type=submit]').click();
   await page.locator('.ws-nav__avatar').waitFor({state:'attached'});
   await page.locator('.ws-shop-confirm .ws-cta').click();
   await account.click();await page.getByText('beata@example.invalid',{exact:true}).waitFor();
   await fidelity.click();await page.getByText('Karta Beaty',{exact:true}).waitFor();
   assert.equal(await page.getByText('Pain Anny',{exact:true}).count(),0);
   for(const nextFlag of [false,null]) {
    await page.locator('.ws-modal__close').click();flag=nextFlag;
    const before=loyaltyRequests.length;
    const loaded=page.waitForResponse(response=>response.url().endsWith('/webshop/config'));
    await account.click();await loaded;
    await page.getByRole('button',{name:'Moje zakupy',exact:true}).waitFor();
    assert.equal(await fidelity.count(),0,'Disabled or absent flag hides the tab');
    assert.equal(loyaltyRequests.length,before,'Hidden tab never requests private cards');
   }
   await page.locator('.ws-modal__close').click();flag=true;
   await page.locator('.ws-nav__shopchip:visible,.ws-nav__shopplate:visible,.ws-shopbar__switch:visible').first().click();
   const catalogueLoaded=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/products/available'));
   await page.locator('.ws-shopcard').filter({hasText:'Shop B'}).click();
   await page.locator('.ws-pref-nudge__no').click();await catalogueLoaded;
   await page.locator('.ws-modal__close').waitFor({state:'hidden'});
   const shopConfig=page.waitForResponse(response=>response.url().endsWith('/webshop/config'));
   await account.click();await shopConfig;await page.getByText('beata@example.invalid',{exact:true}).waitFor();
   await page.screenshot({path:`/tmp/fidelity-shop-switch-${width}.png`});
   await fidelity.click();
   await page.getByText('Karta sklepu B',{exact:true}).waitFor();
   assert.equal(await page.getByText('Karta Beaty',{exact:true}).count(),0);
   assert.equal(new URL(loyaltyRequests.filter(url=>new URL(url).pathname.endsWith('/cards')).at(-1)).searchParams.get('shopId'),'3');
   // Header visibility uses the shop configuration loaded when entering the shop.
   for(const nextFlag of [false,null]) {
    flag=nextFlag;
    await Promise.all([page.waitForResponse(response=>response.url().endsWith('/webshop/config')),page.reload()]);
    await page.locator('.ws-nav__avatar').waitFor({state:'attached'});
    assert.equal(await page.locator('.ws-nav__loyalty').count(),0,'Disabled or absent shop flag hides desktop shortcut');
    assert.equal(await page.locator('.ws-tabbar__btn--loyalty').count(),0,'Disabled or absent shop flag hides mobile shortcut');
   }
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   await context.close();
  }
  console.log('PASS: unknown/absent/disabled flag; cards/debt/pending; pagination; voucher wallet link; unavailable vs empty; late response after logout; new customer and shop; desktop/mobile; no live API or JS errors.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
