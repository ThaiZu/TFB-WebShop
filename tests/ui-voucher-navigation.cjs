/* Built storefront, intercepted API only. No real purchases or voucher consumption. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD||'/tmp/fidelity-voucher-navigation-build';
const product=(id,name,categoryId,categoryName,portions=[])=>({id,name,id_category:categoryId,is_active:1,webshop_active:1,click_and_collect:1,is_divisible:0,is_piece_based:1,category:{id:categoryId,name:categoryName,groups:categoryId===70?[{id:7,name:'Tarty'}]:[]},webshop:{price_gross:'20.00',allergen_codes:[]},portions,availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}});
const portions=[{id:2,portion_type:'ONE_HALF',is_active:1,is_ready_for_sale:1,shop_price_gross:'10.00'},{id:3,portion_type:'ONE_QUARTER',is_active:1,is_ready_for_sale:1,shop_price_gross:'6.00'}];
const vouchers=[{id:1,code:'TART-1',name:'Ćwiartka tarty',targets:{products:[],categories:[{id:70,name:'Tarty 28',portion:'ONE_QUARTER'}]}},{id:2,code:'BREAD-2',name:'Bagietka',targets:{products:[{id:201,name:'Bagietka',portionId:null,portion:'WHOLE'}],categories:[]}}].map(v=>({...v,source:'PROMOTION',status:'READY',canUse:true,validFrom:null,validTo:null}));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  await context.addInitScript(()=>{const now=Date.now()-3600000;for(const[key,value]of[['ws.lang','pl'],['ws_auth_token','navigation-A'],['ws_auth_refresh_token','refresh-A']])sessionStorage.setItem('ws.session.v1:'+key,JSON.stringify({value,createdAt:now,expiresAt:now+43200000}));});
  const errors=[],quotes=[];
  const loyaltyApi=require('./helpers/loyalty-api-fixture.cjs')({accessToken:'navigation-A',findVoucher:code=>vouchers.find(item=>item.code===code)});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname==='webshop.test')return serveBuild(route,build);
   if(url.hostname!=='api.example.invalid')return route.abort();
   const fixture=loyaltyApi(route.request());if(fixture)return route.fulfill(fixture);
   let data=[];
   if(url.pathname.endsWith('/clients/auth/me'))data={user:{id:42,firstName:'Anna',lastName:'Test',email:'anna@example.invalid',phone:'123456789',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,invoice:{}}};
   else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:true};
   else if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/locale'))data={language:'pl'};
   else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/webshop/loyalty/identity'))data={status:'available',code:'FID1-16-'+'A'.repeat(32)};
   else if(url.pathname.endsWith('/webshop/loyalty/cards'))data={status:'available',asOf:new Date().toISOString(),items:[],nextCursor:null};
   else if(url.pathname.endsWith('/products/available'))data=[product(101,'Tarta A',70,'Tarty 28',portions),product(102,'Tarta B',70,'Tarty 28',portions),product(201,'Bagietka',80,'Pieczywo')];
   else if(url.pathname.endsWith('/webshop/vouchers/prepare'))data={prepared:0,hasMore:false};
   else if(url.pathname.endsWith('/webshop/vouchers'))data={status:'available',asOf:new Date().toISOString(),items:vouchers,nextCursor:null};
   else if(url.pathname.endsWith('/cart/quote')){
    const payload=request.postDataJSON();quotes.push(payload);let discounted=false;
    const items=payload.products.map(line=>{
     const price=line.id_product_portion===3?6:line.id_product_portion===2?10:20;
     const matches=payload.voucher_code==='TART-1'?line.id_product_portion===3&&line.id_product===101:payload.voucher_code==='BREAD-2'&&line.id_product===201;
     const discount=matches&&!discounted?price:0;if(discount)discounted=true;
     return {...line,unit_gross_price:String(price),item_discount_value:discount.toFixed(2),total_gross_value_after_discount:(price*line.quantity-discount).toFixed(2)};
    });
    const total=items.reduce((sum,line)=>sum+Number(line.total_gross_value_after_discount),0),discount=items.reduce((sum,line)=>sum+Number(line.item_discount_value),0);
    data={items,totals:{gross_before_discount:(total+discount).toFixed(2),gross_after_discount:total.toFixed(2),discount:discount.toFixed(2)},promotion_suggestions:[],applied_promotions:[],voucher:payload.voucher_code?{valid:true,matches_cart:discounted,code:payload.voucher_code}:null};
   }
   await route.fulfill({json:data});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://webshop.test/?shop=2');await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);
  if(await page.locator('.ws-cookie-panel').count())await page.locator('.ws-cookie-actions button').last().click();
  const shortcut=page.locator(width<1024?'.ws-tabbar__btn--loyalty':'.ws-nav__loyalty');
  const wallet=page.locator('.ws-loyalty-wallet:modal');
  async function openWallet(){await shortcut.click();await wallet.getByRole('button',{name:'Vouchery',exact:true}).click();await wallet.locator('.ws-vouchers__item').first().waitFor();}
  await openWallet();
  await wallet.locator('.ws-vouchers__item').first().getByRole('button',{name:'Wykorzystaj',exact:true}).click();
  await wallet.getByRole('button',{name:'Zobacz produkty',exact:true}).click();await wallet.waitFor({state:'detached'});
  assert.equal(new URL(page.url()).searchParams.get('category'),'group:7');
  assert.equal(new URL(page.url()).searchParams.get('sub'),'category:70');
  assert.equal(await page.locator('.ws-card').count(),2);
  await page.locator('.ws-card').filter({hasText:'Tarta A'}).locator('.ws-add').click();
  const notice=page.locator('.pdm-voucher');await notice.getByText('Voucher aktywny · 1/4',{exact:true}).waitFor();
  await page.locator('.pdm-seg--portions').getByRole('radio',{name:/1\/2/}).click();
  assert.equal(await notice.getByText('Voucher aktywny · 1/4',{exact:true}).isVisible(),true);
  await notice.getByRole('button',{name:'Wybierz 1/4',exact:true}).click();
  assert.equal(await page.locator('.pdm-seg--portions').getByRole('radio',{name:/1\/4/}).getAttribute('aria-checked'),'true');
  await page.screenshot({path:`/tmp/voucher-product-${width}.png`});
  await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
  assert.ok(quotes.some(q=>q.voucher_code==='TART-1'&&q.products.some(line=>line.id_product===101&&line.id_product_portion===3)));
  await openWallet();await wallet.getByRole('button',{name:'Zobacz produkt',exact:true}).click();
  await wallet.waitFor({state:'detached'});await page.locator('.pdm-cta').waitFor();
  assert.equal(await page.locator('.pdm-voucher').count(),0,'The category voucher never labels an unrelated product');
  await page.keyboard.press('Escape');await page.locator('.pdm-cta').waitFor({state:'detached'});
  await openWallet();await wallet.getByRole('button',{name:'Usuń wybór',exact:true}).click();
  await wallet.locator('.ws-vouchers__item').last().getByRole('button',{name:'Wykorzystaj',exact:true}).click();
  await wallet.getByRole('button',{name:'Zobacz produkt',exact:true}).click();await wallet.waitFor({state:'detached'});
  await page.locator('.pdm-voucher').getByText('Voucher aktywny · 1/1',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS voucher navigation ${width}px: category/product links, portion-independent notice, quarter selection, canonical voucher quote, unrelated-product isolation`);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
