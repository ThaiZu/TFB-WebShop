const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});try{
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
await context.addInitScript(()=>{sessionStorage.setItem('ws.session.v1:' + 'ws_auth_token', ((createdAt)=>JSON.stringify({value:'test', createdAt, expiresAt:createdAt+43200000}))(Date.now()));sessionStorage.setItem('ws.session.v1:' + 'ws.lang', ((createdAt)=>JSON.stringify({value:'pl', createdAt, expiresAt:createdAt+43200000}))(Date.now()));});
let orderWrites=0,checkoutCalls=0,statusCalls=0,paymentStatus='not_started',statusError=false,closedPickupDate=null;const errors=[];
await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(u.hostname))return route.abort();if(!u.pathname.includes('/api/v1/'))return route.continue();let data=[];
if(u.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
else if(u.pathname.endsWith('/clients/auth/me'))data={user:{id:7,email:'test@example.invalid',firstName:'Test',lastName:'Client',phone:'123456789',postalCode:'00-001',activationRequired:false}};
else if(u.pathname.endsWith('/products/available'))data=[{id:11,name:'Test baguette',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'10.00',allergen_codes:[],ingredients:''},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}];
else if(u.pathname.endsWith('/webshop/offices'))data={offices:[]};
else if(u.pathname.endsWith('/cart/quote')){const b=req.postDataJSON();data={items:b.products.map(p=>({...p,total_gross_value_after_discount:'10.00',unit_gross_price:'10.00'})),shopping_context:b.shopping_context,billing:{mode:'person'},totals:{gross_before_discount:'10.00',discount:'0.00',gross_after_discount:'10.00'}};}
else if(u.pathname.endsWith('/availability/days')){const start=new Date(u.searchParams.get('from')+'T12:00:00');data=Array.from({length:5},(_,index)=>{const d=new Date(start);d.setDate(d.getDate()+index);return {iso:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),available:index!==1};});}
else if(u.pathname.endsWith('/availability/slots')){if(!closedPickupDate)closedPickupDate=u.searchParams.get('date');data=u.searchParams.get('date')===closedPickupDate?[]:[{id:1,label:'15:00 – 15:30',capacity:30,current_orders:0,available:true}];}
else if(u.pathname.endsWith('/payment-methods'))data=[{method:'shop',family:'shop',label:'Shop'},{method:'stripe',family:'card',label:'Card'}];
else if(u.pathname.endsWith('/webshop/orders')&&req.method()==='POST'){orderWrites++;data={orderId:44,orderRef:'WEB-2-20260914-ABCDEF',total:10,paymentType:'stripe',guestAccessToken:'guest-test-token'};assert.equal(req.postDataJSON().payment.method,'stripe');}
else if(u.pathname.endsWith('/stripe-status')){statusCalls++;if(statusError)return route.fulfill({status:502,contentType:'application/json',body:'{}'});data={status:paymentStatus,orderRef:'WEB-2-20260914-ABCDEF',amountMinor:1000,currency:'eur'};}
else if(u.pathname.endsWith('/stripe-checkout')){checkoutCalls++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({description:'WEBSHOP_STRIPE_NOT_CONFIGURED'})});}
else if(u.pathname.endsWith('/webshop/orders/WEB-2-20260914-ABCDEF'))data={orderRef:'WEB-2-20260914-ABCDEF',payment:{method:'stripe',status:paymentStatus==='paid'?'paid':'pending'},items:[{id:1,name:'Saved baguette',quantity:2,unitGrossPrice:5,totalGross:10}],mode:'collect',slot:{dateTime:'2026-09-20 12:00:00',label:'12:00 – 12:30'},status:'new'};
else if(u.pathname.endsWith('/config')||u.pathname.endsWith('/brand'))data={};
return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://webshop.tfbuddy.local/?shop=2');
await page.locator('.ws-card .ws-add').click();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
await page.locator('.ws-basket:visible .ws-cta').click();await page.locator('.ws-checkout__foot-actions .ws-cta').click();await page.waitForFunction(()=>document.querySelectorAll('.ws-pickup-dates button').length===3);
const suggested=page.locator('.ws-pickup-dates button');assert.equal(await suggested.count(),3);
assert.equal(await page.getByRole('button',{name:'Odśwież terminy',exact:true}).count(),0);
const warning=page.getByText('Brak dostępnych godzin na ten dzień. Wybierz inny dzień.',{exact:true});
assert.ok((await page.locator('.ws-pickup-dates').boundingBox()).y>(await warning.boundingBox()).y);
await suggested.nth(1).click();
await page.locator('.ws-slot').first().waitFor();
assert.equal(await page.locator('.ws-pickup-dates').count(),0);

await page.locator('.ws-slot').first().click();await page.locator('.ws-checkout__foot-actions .ws-cta').click();await page.locator('.ws-pay input[value="stripe"]').waitFor();assert.equal(await page.locator('.ws-pay input[value="stripe"]').isChecked(),true,'online payment must be selected even if pickup is first');
await page.locator('.ws-checkout__foot-actions .ws-cta').click();
const modal=page.getByRole('dialog',{name:'Płatność',exact:true});await modal.waitFor();await modal.getByRole('button',{name:'Przejdź do płatności',exact:true}).waitFor();
await modal.getByText('Saved baguette',{exact:true}).waitFor();assert.equal(await modal.locator('.ws-order-result--paid').count(),0);
assert.equal(orderWrites,1);assert.equal(checkoutCalls,1);assert.equal(await page.locator('.ws-line').count(),0);
assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ws.pendingPay')).orderRef),'WEB-2-20260914-ABCDEF');
assert.equal(await page.evaluate(()=>sessionStorage.getItem('ws.order.token.WEB-2-20260914-ABCDEF')),'guest-test-token');
await page.reload();await page.locator('.ws-card').first().waitFor();assert.equal(await modal.count(),0,'pending payment must not interrupt reload');assert.equal(await page.locator('.ws-last-payment').count(),0);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ws:stripe-recovery',{detail:{orderRef:'WEB-2-20260914-ABCDEF'}})));await modal.waitFor();await modal.getByRole('button',{name:'Przejdź do płatności',exact:true}).click();await modal.getByText('Płatność online jest chwilowo niedostępna.',{exact:false}).waitFor();
assert.equal(orderWrites,1,'retry after reload must not create another order');assert.equal(checkoutCalls,2);assert.deepEqual(errors,[]);
// Only an explicit Stripe return opens recovery; its parameters are consumed once.
await page.goto('https://webshop.tfbuddy.local/?shop=2');await page.locator('.ws-card').first().waitFor();assert.equal(await modal.count(),0);
assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ws.pendingPay')).orderRef),'WEB-2-20260914-ABCDEF');
await page.goto('https://webshop.tfbuddy.local/?shop=2&stripe=cancel&orderRef=WEB-2-20260914-ABCDEF');await modal.waitFor();assert.equal(new URL(page.url()).searchParams.has('stripe'),false);assert.equal(orderWrites,1);
await page.reload();await page.locator('.ws-card').first().waitFor();assert.equal(await modal.count(),0,'return URL must only open once');
assert.equal(await page.locator('.ws-last-payment').count(),0);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ws:stripe-recovery',{detail:{orderRef:'WEB-2-20260914-ABCDEF'}})));await modal.waitFor();
paymentStatus='unpaid';await modal.getByRole('button',{name:'Odśwież',exact:true}).click();
await modal.getByText('Zamówienie zostanie potwierdzone dopiero po zarejestrowaniu płatności.',{exact:false}).waitFor();
for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});
 await modal.getByRole('button',{name:'Przejdź do płatności',exact:true}).waitFor();
 const pay=await modal.getByRole('button',{name:'Przejdź do płatności',exact:true}).boundingBox();
 const refresh=await modal.getByRole('button',{name:'Odśwież',exact:true}).boundingBox();
 assert.ok(Math.abs(pay.y-refresh.y)<2,'payment actions must share a row');
 assert.ok(refresh.x>=pay.x+pay.width,'refresh must be on the right');
 assert.ok(refresh.height>=44,'refresh must have a touch target');
}
statusError=true;await modal.getByRole('button',{name:'Odśwież',exact:true}).click();await modal.getByText('Nie udało się teraz potwierdzić statusu płatności.',{exact:false}).waitFor();assert.equal(await modal.getByRole('button',{name:'Przejdź do płatności',exact:true}).count(),0);
statusError=false;paymentStatus='processing';await modal.getByRole('button',{name:'Odśwież',exact:true}).click();await modal.getByText('Stripe przetwarza płatność.',{exact:false}).waitFor();assert.equal(await modal.getByRole('button',{name:'Przejdź do płatności',exact:true}).count(),0);
paymentStatus='paid';await modal.getByRole('button',{name:'Odśwież',exact:true}).click();await modal.getByText('Płatność potwierdzona.',{exact:false}).waitFor();assert.equal(await modal.locator('.ws-order-result--paid').count(),1);assert.equal(await page.evaluate(()=>sessionStorage.getItem('ws.pendingPay')),null);assert.equal(orderWrites,1);assert.equal(checkoutCalls,2);
await modal.getByRole('button',{name:'Zamknij',exact:true}).click();assert.equal(await page.locator('.ws-last-payment').count(),0);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ws:stripe-recovery',{detail:{orderRef:'WEB-2-20260914-ABCDEF'}})));await modal.getByText('Płatność potwierdzona.',{exact:false}).waitFor();
await page.evaluate(()=>window.WSAuth.logout());await modal.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>sessionStorage.getItem('ws.lastPay')),null);assert.equal(await page.evaluate(()=>sessionStorage.getItem('ws.order.token.WEB-2-20260914-ABCDEF')),null);assert.equal(await page.getByRole('button',{name:'Sprawdź ostatnią płatność',exact:true}).count(),0);assert.ok(statusCalls>=5);assert.deepEqual(errors,[]);
console.log('PASS unknown/processing never offer repay; refresh recovers paid; reopen last payment; logout clears references and guest credentials');
console.log('PASS saved order -> Stripe start fails -> consumed basket -> reload -> retry same reference, retained guest token, localized error');
await context.close();}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
