const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});try{
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
await context.addInitScript(()=>{sessionStorage.setItem('ws.session.v1:' + 'ws.lang', ((createdAt)=>JSON.stringify({value:'pl', createdAt, expiresAt:createdAt+43200000}))(Date.now()));});
let orderWrites=0,checkoutCalls=0,statusCalls=0,paymentStatus='not_started',statusError=false;const errors=[];
await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(u.hostname))return route.abort();if(!u.pathname.includes('/api/v1/'))return route.continue();let data=[];
if(u.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
else if(u.pathname.endsWith('/clients/auth/me'))return route.fulfill({status:401,contentType:'application/json',body:'{}'});
else if(u.pathname.endsWith('/products/available'))data=[{id:11,name:'Test baguette',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'10.00',allergen_codes:[],ingredients:''},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}];
else if(u.pathname.endsWith('/webshop/offices'))data={offices:[]};
else if(u.pathname.endsWith('/cart/quote')){const b=req.postDataJSON();data={items:b.products.map(p=>({...p,total_gross_value_after_discount:'10.00',unit_gross_price:'10.00'})),shopping_context:b.shopping_context,billing:{mode:'person'},totals:{gross_before_discount:'10.00',discount:'0.00',gross_after_discount:'10.00'}};}
else if(u.pathname.endsWith('/availability/slots'))data=[{id:1,label:'15:00 – 15:30',capacity:30,current_orders:0,available:true}];
else if(u.pathname.endsWith('/payment-methods'))data=[{method:'shop',family:'shop',label:'Shop'},{method:'stripe',family:'card',label:'Card'}];
else if(u.pathname.endsWith('/webshop/orders')&&req.method()==='POST'){orderWrites++;data={orderId:44,orderRef:'WEB-2-20260914-ABCDEF',total:10,paymentType:'stripe',guestAccessToken:'guest-test-token'};assert.equal(req.postDataJSON().payment.method,'stripe');}
else if(u.pathname.endsWith('/stripe-status')){statusCalls++;if(statusError)return route.fulfill({status:502,contentType:'application/json',body:'{}'});data={status:paymentStatus,orderRef:'WEB-2-20260914-ABCDEF',amountMinor:1000,currency:'eur'};}
else if(u.pathname.endsWith('/stripe-checkout')){checkoutCalls++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({description:'WEBSHOP_STRIPE_NOT_CONFIGURED'})});}
else if(u.pathname.endsWith('/webshop/orders/WEB-2-20260914-ABCDEF'))data={orderRef:'WEB-2-20260914-ABCDEF',payment:{method:'stripe',status:paymentStatus==='paid'?'paid':'pending'},items:[],status:'new'};
else if(u.pathname.endsWith('/config')||u.pathname.endsWith('/brand'))data={};
return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://webshop.tfbuddy.local/?shop=2');
await page.locator('.ws-card .ws-add').click();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
await page.locator('.ws-basket:visible .ws-cta').click();
await page.getByText('Zaloguj się, aby kontynuować',{exact:true}).waitFor();
assert.equal(await page.locator('.ws-co-guest__banner').count(),0);
assert.equal(await page.locator('.ws-checkout__foot-actions .ws-cta').isEnabled(),true);
assert.equal(orderWrites,0);assert.equal(checkoutCalls,0);
await page.locator('.ws-checkout__foot-actions .ws-cta').click();
await page.locator('input[type="password"]').first().waitFor();
assert.equal(orderWrites,0);assert.deepEqual(errors,[]);
console.log('PASS: guest checkout requires authentication, opens login, no order or payment writes');
await context.close();}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
