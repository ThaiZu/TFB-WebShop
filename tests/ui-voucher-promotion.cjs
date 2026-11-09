/* Built storefront with intercepted API; no real orders or payments. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.FIDELITY_BUILD||'/tmp/fidelity-voucher-promotion-build';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  await context.addInitScript(()=>{const now=Date.now()-3600000;sessionStorage.setItem('ws.session.v1:ws.lang',JSON.stringify({value:'pl',createdAt:now,expiresAt:now+43200000}));});
  const errors=[],quotes=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname==='webshop.test')return serveBuild(route,build);
   if(url.hostname!=='api.example.invalid')return route.abort();
   let data=[];
   if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/clients/auth/me'))return route.fulfill({status:401,json:{}});
   else if(url.pathname.endsWith('/locale'))data={language:'pl'};
   else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/products/available'))data=[{id:101,name:'Tarta Ø28',id_category:70,is_active:1,webshop_active:1,click_and_collect:1,is_divisible:0,is_piece_based:1,category:{id:70,name:'Tarty',groups:[]},webshop:{price_gross:'20.00',allergen_codes:[]},portions:[{id:2,portion_type:'ONE_HALF',is_active:1,is_ready_for_sale:1,shop_price_gross:'10.00'},{id:3,portion_type:'ONE_QUARTER',is_active:1,is_ready_for_sale:1,shop_price_gross:'6.00'}],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}];
   else if(url.pathname.endsWith('/cart/quote')){
    const payload=request.postDataJSON();quotes.push(payload);
    const preview=payload.products.at(-1),portion=preview.id_product_portion??null;
    const required=portion===3?4:portion===2?2:1,price=portion===3?6:portion===2?10:20;
    const offer={id_promotion:2,name:'4 Quarts + 1 Gratuit',promotion_type:'BUY_X_GET_Y',is_available:true,minimum_receipt_gross:null,discount_total:'0.00',promotion_total_gross_after_discount:(required*price).toFixed(2),total_gross_after_discount:(required*price).toFixed(2),trigger:{quantity:1,quantity_unit:'PIECE_FRACTION',any_portion:true},reward:{type:'FREE',quantity:1,delivery_mode:'VOUCHER'},items:[{id_product:101,id_product_portion:portion,product_name:'Tarta Ø28',product_portion_type:portion===3?'ONE_QUARTER':portion===2?'ONE_HALF':null,quantity:String(required),role:'trigger'}]};
    const items=payload.products.map(line=>({...line,unit_gross_price:String(price),total_gross_value_after_discount:(price*line.quantity).toFixed(2)}));
    const total=items.reduce((sum,item)=>sum+Number(item.total_gross_value_after_discount),0).toFixed(2);
    data={items,totals:{gross_before_discount:total,gross_after_discount:total,discount:'0.00'},applied_promotions:[],promotion_suggestions:[offer],earned_vouchers:payload.products[0].promotion_group?[{id_promotion:2,applications_count:1}]:[]};
   }
   await route.fulfill({json:data});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://webshop.test/?shop=2&category=category%3A70');
  await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);
  if(await page.locator('.ws-cookie-panel').count())await page.locator('.ws-cookie-actions button').last().click();
  await page.locator('.ws-card .ws-add').first().click();
  const card=page.locator('.pdm-promotion__card');
  for(const [name,quantity,fraction] of [['Całość',1,''],['1/2',2,'1/2'],['1/4',4,'1/4']]){
   await page.locator('.pdm-seg--portions').getByRole('radio',{name,exact:false}).click();
   await card.locator('.pdm-promotion__composition').filter({hasText:`Kup ${quantity} × ${fraction?fraction+' ':''}Tarta Ø28`}).waitFor();
   assert.match(await card.innerText(),/Gratis otrzymasz jako voucher po opłaceniu zamówienia/);
  }
  await card.click();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
  const selected=quotes.find(payload=>payload.products.some(line=>line.promotion_group));
  assert.ok(selected,'The selected voucher promotion reaches the quote');
  assert.equal(selected.products.length,1,'No immediate reward is added');
  assert.equal(selected.products[0].quantity,4,'Exactly four paid quarters');
  assert.equal(selected.products[0].id_product_portion,3);
  assert.equal(selected.selected_automatic_promotion_id,2);
  assert.deepEqual(errors,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await context.close();console.log(`PASS voucher promotion ${width}px: whole/half/quarter discovery, deferred reward wording, paid-only selection`);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
