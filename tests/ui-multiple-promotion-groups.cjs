/* Built UI, intercepted APIs; no external requests, orders or payments. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const serve=require('./helpers/static-build.cjs');
const build=process.env.WS_PROMOTION_BUILD||'/tmp/tfbuddy-multiple-promotions-build';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});try{
for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
 await context.addInitScript(()=>{const now=Date.now();sessionStorage.setItem('ws.session.v1:ws.lang',JSON.stringify({value:'pl',createdAt:now,expiresAt:now+43200000}));});
 const quotes=[],errors=[],orders=[];let reject=false;
 const auth=require('./helpers/loyalty-api-fixture.cjs')({accessToken:'test-A'});
 const offer=id=>({id_promotion:id,name:id===56?'Cookies 2 + 1':'Cougnou 4+1',promotion_type:'BUY_X_GET_Y',is_available:true,is_exclusive:false,promotion_total_gross_after_discount:id===56?'9.00':'12.00',trigger:{quantity:id===56?3:4,product_ids:[id===56?101:102]},reward:{type:'FREE',quantity:1},items:[{id_product:id===56?101:102,quantity:id===56?4:5,product_name:id===56?'Cookies':'Cougnou',role:'trigger'}]});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.hostname==='webshop.test')return serve(route,build);if(url.hostname!=='api.example.invalid')return route.abort();const fixture=auth(req);if(fixture)return route.fulfill(fixture);let data=[];
  if(url.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
  else if(url.pathname.endsWith('/clients/auth/me'))data={user:{id:1,firstName:'Anna',lastName:'Test',email:'anna@example.invalid',phone:'+32470123456',postalCode:'1000',locality:'Bruxelles',preferredShopId:2,needsPostcode:false,activationRequired:false,invoice:{}}};
  else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:false};
  else if(url.pathname.endsWith('/availability/slots'))data=[{id:1,label:'15:00 – 15:30',capacity:30,current_orders:0,available:true}];
  else if(url.pathname.endsWith('/payment-methods'))data=[{method:'stripe',family:'stripe',label:'Karta'}];
  else if(url.pathname.endsWith('/webshop/orders')&&req.method()==='POST'){orders.push(req.postDataJSON());data={orderId:44,orderRef:'WEB-MULTIPLE-TEST',total:21,paymentType:'stripe'};}
  else if(url.pathname.endsWith('/stripe-checkout'))data={status:'paid'};
  else if(url.pathname.endsWith('/locale'))data={language:'pl'};
  else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
  else if(url.pathname.endsWith('/products/available'))data=[101,102].map(id=>({id,name:id===101?'Cookies':'Cougnou',id_category:70,is_active:1,webshop_active:1,click_and_collect:1,is_divisible:0,is_piece_based:1,category:{id:70,name:'Test',groups:[]},webshop:{price_gross:'3.00',allergen_codes:[]},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}));
  else if(url.pathname.endsWith('/cart/quote')){
   const p=req.postDataJSON();quotes.push(p);const groups=[...new Set(p.products.filter(l=>l.promotion_group).map(l=>l.promotion_group))];
   if(reject&&groups.length>1&&!p.promotion_preview_line_key)return route.fulfill({status:422,json:{error:{code:'WEBSHOP_PROMOTION_GROUP_NOT_APPLICABLE'}}});
   const gross=p.products.reduce((s,l)=>s+3*l.quantity,0),discount=3*groups.length;
   data={items:p.products.map(l=>({...l,unit_gross_price:'3.00',item_discount_value:l.promotion_group?'3.00':'0.00',total_gross_value_after_discount:(3*l.quantity-(l.promotion_group?3:0)).toFixed(2)})),totals:{gross_before_discount:gross.toFixed(2),gross_after_discount:(gross-discount).toFixed(2),discount:discount.toFixed(2)},promotion_suggestions:[offer(56),offer(57)],applied_promotions:groups.map(g=>{const l=p.products.find(l=>l.promotion_group===g);return {source:'AUTOMATIC',id_promotion:l.promotion_id,display_name:offer(l.promotion_id).name,items:[{line_key:l.line_key}]};})};
  }return route.fulfill({json:data});
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.goto('https://webshop.test/?shop=2&category=category%3A70');
 await page.waitForFunction(()=>window.WSConsent?.configuration()!==null);if(await page.locator('.ws-cookie-panel').count())await page.locator('.ws-cookie-actions button').last().click();
 const basket=width<600?page.locator('.ws-drawer .ws-basket'):page.locator('.ws-basket').first();
 const show=async()=>{if(width<600)await page.locator('.ws-tabbar__btn--cart').click();};
 const hide=async()=>{if(width<600)await page.locator('.ws-drawer__close').click();};
 const choose=async index=>{await page.locator('.ws-card .ws-add').nth(index).click();const card=page.locator('.pdm-promotion__card').first();await card.waitFor();assert.equal(await card.isDisabled(),false);await card.click();};
 await choose(0);await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
 reject=true;await choose(1);await page.locator('.pdm-cta').click();await page.locator('.pdm-foot [role=alert]').waitFor();assert.match(await page.locator('.pdm-foot [role=alert]').innerText(),/Koszyk nie został zmieniony/);
 reject=false;await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
 await show();await basket.locator('.ws-line--promotion').nth(1).waitFor();assert.match(await basket.innerText(),/Cookies 2 \+ 1/);assert.match(await basket.innerText(),/Cougnou 4\+1/);
 await basket.getByText(/Rabat zestawu/).first().waitFor();assert.equal(await basket.getByText(/Rabat zestawu/).count(),2);
 const accepted=quotes.filter(q=>!q.promotion_preview_line_key&&q.products.length===2).at(-1);assert.equal(accepted.selected_automatic_promotion_id,undefined);const keys=accepted.products.map(l=>l.line_key);
 await hide();await page.reload();await show();await basket.locator('.ws-line--promotion').nth(1).waitFor();const refreshed=quotes.filter(q=>!q.promotion_preview_line_key).at(-1);assert.deepEqual(refreshed.products.map(l=>l.line_key),keys);
 await basket.locator('.ws-line--promotion .ws-line__remove').first().click();await basket.locator('.ws-line--promotion').nth(1).waitFor({state:'detached'});assert.match(await basket.innerText(),/Cougnou 4\+1/);
 await hide();await choose(0);await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
 await show();await basket.locator('.ws-cta').click();
 const next=page.locator('.ws-checkout__foot-actions .ws-cta');
 await next.click();await page.getByText('15:00 – 15:30',{exact:true}).click();await next.click();
 await page.locator('input[name=payment]:checked').waitFor({state:'attached'});await next.click();
 await page.locator('.ws-checkout').waitFor({state:'detached'});
 assert.equal(orders.length,1);assert.deepEqual(orders[0].basket.map(l=>l.promotion_id),[57,56]);
 assert.equal(new Set(orders[0].basket.map(l=>l.promotion_group)).size,2);assert.ok(orders[0].basket.every(l=>l.line_key));
 assert.equal(orders[0].expected_total,'21.00');assert.equal(orders[0].selected_automatic_promotion_id,null);
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();console.log(`PASS ${width}px: two promotions, atomic rejection/retry, discounts, reload, independent removal and checkout`);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
