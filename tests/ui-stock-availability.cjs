/* Local React smoke with controlled API responses. No database mutations. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const product=(id,name,status,amount,initialized=true)=>({
 id,name,id_category:3,is_active:1,webshop_active:1,click_and_collect:1,office_delivery:1,is_divisible:0,
 inventory_initialized_at:initialized?'2026-09-10 00:00:00':null,
 category:{id:3,name:'Test',groups:[]},webshop:{price_gross:'10.00',allergen_codes:[],ingredients:''},
 portions:[{id:101,portion_type:'ONE_HALF',is_active:1,is_ready_for_sale:true,shop_price_gross:'6.00'}],availability_periods:[],
 webshop_availability:{status,quantity_available:amount,date:'2026-09-10',shop_date:'2026-09-10',production_planning_enabled:true}
});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try {
 for(const loggedIn of [false,true]) {
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  if(loggedIn) await context.addInitScript(()=>{sessionStorage.setItem('ws.session.v1:' + 'ws_auth_token', ((createdAt)=>JSON.stringify({value:'test-access', createdAt, expiresAt:createdAt+43200000}))(Date.now()));sessionStorage.setItem('ws.session.v1:' + 'ws_auth_refresh_token', ((createdAt)=>JSON.stringify({value:'test-refresh', createdAt, expiresAt:createdAt+43200000}))(Date.now()));});
  const requests=[],errors=[];let refreshStatus='available';
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname)) return route.abort();
   if(!url.pathname.includes('/api/v1/')) return route.continue();
   requests.push({path:url.pathname,method:request.method(),query:url.search});
   let body=[];
   if(url.pathname.endsWith('/shops')) body=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(url.pathname.endsWith('/products/available')) {
    assert.ok(url.searchParams.get('include').includes('webshop_availability'));
    body=[product(11,'Portion cake',refreshStatus,refreshStatus==='production'?null:'0.5000'),product(12,'Not initialized','uninitialized',null,false),product(13,'Sold out','out_of_stock','0.0000'),product(14,'Unknown stock','unknown',null),product(15,'Future production','production',null)];
   } else if(url.pathname.endsWith('/me')) body={user:{id:7,email:'client@example.invalid',firstName:'Test',lastName:'Client',postalCode:'00-001',needsPostcode:false,activationRequired:false}};
   else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand')) body={};
   else if(url.pathname.endsWith('/cart/quote')) body={items:request.postDataJSON().products.map(p=>({...p,total_gross_value_after_discount:'6.00'})),totals:{gross_after_discount:'6.00'}};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://webshop.tfbuddy.local/?shop=2');
  await page.waitForSelector('.ws-card');
  await page.evaluate(()=>window.WSI18n.setLang('pl'));
  const cake=page.locator('.ws-card').filter({hasText:'Portion cake'});
  assert.equal(await page.locator('.ws-card').count(),5);
  assert.equal(await cake.locator('.ws-add').isEnabled(),true,'half a product remains purchasable');
  assert.equal(await page.locator('.ws-card').filter({hasText:'Not initialized'}).locator('.ws-add').isDisabled(),true);
  assert.equal(await page.locator('.ws-card').filter({hasText:'Sold out'}).locator('.ws-add').isDisabled(),true);
  assert.equal(await page.locator('.ws-card').filter({hasText:'Unknown stock'}).locator('.ws-add').isEnabled(),true,'unknown is not an unapproved automatic block');
  await cake.locator('.ws-add').click();
  await page.locator('.pdm-cta').waitFor();
  assert.equal(await page.locator('.pdm-cta').isDisabled(),true,'whole product unavailable');
  await page.locator('.pdm-seg--portions button').nth(1).click();
  assert.equal(await page.locator('.pdm-cta').isEnabled(),true);
  assert.equal(await page.locator('.pdm-qty button').last().isDisabled(),true,'one half only');
  await page.locator('.pdm-cta').click();
  await page.locator('.pdm-cta').waitFor({state:'detached'});
  assert.equal(await cake.locator('.ws-add').isDisabled(),true,'basket half consumes full available equivalent');
  await page.locator('.ws-line__remove').first().click();
  assert.equal(await cake.locator('.ws-add').isEnabled(),true,'removal is local and restores basket capacity');
  refreshStatus='production';
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.locator('.ws-catalogue-loading').waitFor({state:'detached'});
  await cake.locator('.ws-add').click();
  await page.locator('.pdm-cta').waitFor();
  assert.equal(await page.locator('.pdm-cta').isEnabled(),true,'future production is not limited by today\'s half');
  assert.equal(await page.locator('.pdm-qty button').last().isEnabled(),true);
  assert.equal(requests.some(r=>/\/stock(?:\/|$)/.test(r.path)),false,'no legacy stock or cart reservation endpoints');
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${loggedIn?'account':'guest'} visibility, uninitialized/zero/unknown, whole vs portion, cart aggregate, remove, refresh, future production, no legacy stock calls.`);
  await context.close();
 }
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
