/* Controlled API integration. No real orders, memberships or database writes. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const raw=(price='10.00')=>({id:11,name:'Office test cake',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,office_delivery:1,is_divisible:0,
 inventory_initialized_at:null,category:{id:3,name:'Cakes',groups:[]},webshop:{price_gross:price,allergen_codes:[],ingredients:''},portions:[],availability_periods:[],
 webshop_availability:{status:'not_enforced',inventory_enforced:false,quantity_available:null,date:'2026-09-11',shop_date:'2026-09-11'}});
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
try{
for(const width of [1440,390]){
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
await context.addInitScript(width=>{if(width===1440){sessionStorage.setItem('ws.session.v1:' + 'ws_auth_token', ((createdAt)=>JSON.stringify({value:'test-office', createdAt, expiresAt:createdAt+43200000}))(Date.now()));sessionStorage.setItem('ws.session.v1:' + 'ws_auth_refresh_token', ((createdAt)=>JSON.stringify({value:'test-refresh', createdAt, expiresAt:createdAt+43200000}))(Date.now()));}sessionStorage.setItem('ws.session.v1:' + 'ws.lang', ((createdAt)=>JSON.stringify({value:'pl', createdAt, expiresAt:createdAt+43200000}))(Date.now()));},width);
let joined=false,changedPrice=false,latestQuote=null,slotReads=0;const calls=[],errors=[];
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname))return route.abort();
 if(!url.pathname.includes('/api/v1/'))return route.continue();
 const bodyIn=req.postData()?req.postDataJSON():null;calls.push({path:url.pathname,method:req.method(),body:bodyIn});
 let body=[];
 if(url.pathname.endsWith('/shops'))body=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
 else if(url.pathname.endsWith('/products/available'))body=[raw()];
 else if(url.pathname.endsWith('/clients/auth/login'))body={access_token:'test-office',refresh_token:'test-refresh'};
 else if(url.pathname.endsWith('/clients/auth/me'))body={user:{id:7,email:'client@example.invalid',firstName:'Test',lastName:'Client',phone:'123456789',postalCode:'00-001',needsPostcode:false,activationRequired:false}};
 else if(url.pathname.endsWith('/webshop/office-invites/resolve'))body={shop_id:2,office:{id:11,name:'Office B'}};
 else if(url.pathname.endsWith('/webshop/office-invites/accept')){joined=true;body={shop_id:2,office:{id:11,name:'Office B'},joined:true};}
 else if(url.pathname.endsWith('/webshop/offices/search'))body={offices:[{id:10,name:'Office A'},{id:11,name:'Office B'}]};
 else if(url.pathname.endsWith('/webshop/offices/11/join')){joined=true;body={ok:true};}
 else if(url.pathname.endsWith('/webshop/offices'))body={offices:joined?[{id:11,name:'Office B',offers:[{id:20,name:'Party offer'}]}]:[]};
 else if(url.pathname.endsWith('/webshop/offices/11/catalog'))body={products:[raw(url.searchParams.has('offer_id')?'8.00':'10.00')],office:{id:11,name:'Office B'},offer:url.searchParams.has('offer_id')?{id:20,name:'Party offer'}:null};
 else if(url.pathname.endsWith('/cart/quote')){
  const isOffer=bodyIn.shopping_context?.mode==='office_offer';const price=isOffer?(changedPrice?'9.00':'8.00'):'10.00';
  body={items:bodyIn.products.map(p=>({...p,total_gross_value_after_discount:price,unit_gross_price:price})),shopping_context:bodyIn.shopping_context,
   billing:{mode:isOffer?'company':'person',company:isOffer?{name:'Business B'}:null},voucher:bodyIn.voucher_code?{code:bodyIn.voucher_code,valid:bodyIn.voucher_code==='GOOD',matches_cart:bodyIn.voucher_code==='GOOD'}:null,totals:{gross_before_discount:'10.00',discount:isOffer?(changedPrice?'1.00':'2.00'):'0.00',gross_after_discount:price}};latestQuote=body;
 }else if(url.pathname.endsWith('/availability/slots')){slotReads++;if(slotReads===1)return route.fulfill({status:503,contentType:'application/json',body:'{}'});body=slotReads===2?[]:[{id:1,label:'15:00 – 15:30',capacity:30,current_orders:0,available:true}];}
 else if(url.pathname.endsWith('/webshop/orders')){
  if(width===1440&&!changedPrice){changedPrice=true;const replacement=JSON.parse(JSON.stringify(latestQuote));replacement.items.forEach(item=>{item.total_gross_value_after_discount='9.00';item.unit_gross_price='9.00';});replacement.totals.discount='1.00';replacement.totals.gross_after_discount='9.00';
   return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({status:'error',description:'WEBSHOP_QUOTE_CHANGED',errors:{quote:replacement}})});
  }body={orderId:44,orderRef:'WEB-TEST-44',total:changedPrice?9:8,paymentType:'company_invoice'};
 }
 else if(url.pathname.endsWith('/payment-methods'))body=[{method:'shop',family:'shop',label:'Pay at pickup'}];
 else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand'))body={};
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto('https://webshop.tfbuddy.local/office-invite.html?token=test-invitation');
if(width===390){
 await page.getByRole('dialog',{name:'Zaproszenie do biura',exact:true}).getByRole('button',{name:'Zaloguj się',exact:true}).click();
 await page.locator('input[autocomplete="current-password"]').fill('test-password');
 await page.locator('input[autocomplete="username"]').fill('client@example.invalid');
 await page.locator('.ws-form button[type="submit"]').click();
}
await page.getByRole('button',{name:'Dołącz do biura',exact:true}).click();
await page.getByRole('button',{name:'Oferta: Party offer',exact:true}).waitFor();
assert.equal(calls.filter(c=>c.path.endsWith('/office-invites/accept')).length,1);
assert.equal(calls.find(c=>c.path.endsWith('/office-invites/accept')).body.token,'test-invitation');
await page.getByRole('button',{name:'Katalog sklepu',exact:true}).click();
await page.locator('.ws-catalogue-loading').waitFor({state:'detached'});
// Ordinary menu establishes ordinary price/context.
async function addProduct(){await page.locator('.ws-card .ws-add').click();await page.locator('.pdm-cta').waitFor();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});}
await addProduct();await page.waitForFunction(()=>document.querySelector('.ws-line'));
await page.getByRole('button',{name:'Oferta: Party offer',exact:true}).click();
await page.getByRole('alertdialog').waitFor();
await page.getByRole('button',{name:'Anuluj',exact:true}).click();
let quotes=calls.filter(c=>c.path.endsWith('/cart/quote'));
assert.equal(quotes.at(-1).body.shopping_context.mode,'standard');
await page.getByRole('button',{name:'Oferta: Party offer',exact:true}).click();
await page.getByRole('button',{name:'Wyczyść koszyk i kontynuuj',exact:true}).click();
await page.locator('.ws-catalogue-loading').waitFor({state:'detached'});
assert.equal(await page.locator('.ws-line').count(),0);
await Promise.all([page.waitForResponse(r=>r.url().endsWith('/cart/quote')),addProduct()]);
quotes=calls.filter(c=>c.path.endsWith('/cart/quote'));
assert.equal(quotes.at(-1).body.shopping_context.mode,'office_offer');
// Checkout still uses the offer basket although the standard menu is visible.
if(width < 600)await page.locator('.ws-tabbar__btn--cart').click();
await page.locator('.ws-basket:visible .ws-cta').click();
await page.locator('.ws-checkout').waitFor();
assert.match(await page.locator('.ws-office-billing').innerText(),/Business B/);
await page.locator('.ws-checkout__foot-actions .ws-cta').click();
await page.getByText('Nie udało się pobrać terminów. Spróbuj ponownie.',{exact:false}).waitFor();
await page.getByRole('button',{name:'Odśwież terminy',exact:true}).click();
await page.getByText('Brak dostępnych godzin na ten dzień.',{exact:false}).waitFor();
assert.equal(await page.locator('.ws-checkout__foot-actions .ws-cta').isDisabled(),true);
await page.getByRole('button',{name:'Odśwież terminy',exact:true}).click();
await page.locator('.ws-slot').first().click();await page.locator('.ws-checkout__foot-actions .ws-cta').click();
assert.equal(await page.locator('.ws-co-voucher').count(),0,'offer excludes voucher controls');
assert.equal(await page.locator('.ws-pay input').count(),1,'company payment is prescribed');
assert.equal(await page.locator('.ws-pay input').inputValue(),'company_invoice');
await Promise.all([page.waitForResponse(r=>r.url().endsWith('/webshop/orders')),page.getByRole('button',{name:'Potwierdź zamówienie',exact:true}).click()]);
if(width===1440){await page.locator('.ws-checkout__pay-err').waitFor();assert.match(await page.locator('.ws-checkout__pay-err').innerText(),/Cena uległa zmianie/);assert.equal(calls.filter(c=>c.path.endsWith('/webshop/orders')).length,1);
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/webshop/orders')),page.getByRole('button',{name:'Potwierdź zamówienie',exact:true}).click()]);}
const order=calls.filter(c=>c.path.endsWith('/webshop/orders')).at(-1).body;
assert.equal(order.shopping_context.mode,'office_offer');assert.equal(order.shopping_context.offer_id,20);
assert.equal(order.payment.method,'company_invoice');assert.equal(order.expected_total,width===1440?'9.00':'8.00');assert.equal(order.voucher,null);
assert.equal(order.basket[0].shopping_context.office_id,11);
// Office catalogue accepts only a server-valid voucher, including HTTP 200 rejection.
await page.getByRole('button',{name:'Katalog biura: Office B',exact:true}).click();await page.locator('.ws-catalogue-loading').waitFor({state:'detached'});await addProduct();
if(width<600)await page.locator('.ws-tabbar__btn--cart').click();
await page.locator('.ws-basket:visible .ws-cta').click();await page.locator('.ws-checkout__foot-actions .ws-cta').click();await page.locator('.ws-slot').first().click();await page.locator('.ws-checkout__foot-actions .ws-cta').click();
await page.locator('.ws-co-voucher__input').fill('BAD');await page.locator('.ws-co-voucher__apply').click();await page.locator('.ws-co-voucher__err').waitFor();
assert.equal(await page.locator('.ws-co-voucher__code').count(),0,'HTTP 200 with invalid voucher must not be accepted');
await page.locator('.ws-co-voucher__input').fill('GOOD');await page.locator('.ws-co-voucher__apply').click();await page.locator('.ws-co-voucher__code').waitFor();assert.equal(await page.locator('.ws-co-voucher__code').innerText(),'GOOD');
await page.locator('.ws-checkout__back').click();
await page.getByRole('button',{name:'Oferta: Party offer',exact:true}).click();
await page.getByRole('button',{name:'Wyczyść koszyk i kontynuuj',exact:true}).click();
await page.locator('.ws-catalogue-loading').waitFor({state:'detached'});await Promise.all([page.waitForResponse(r=>r.url().endsWith('/cart/quote')),addProduct()]);
assert.equal(calls.filter(c=>c.path.endsWith('/cart/quote')).at(-1).body.voucher_code,undefined,'switch to offer clears accepted office voucher');
assert.deepEqual(errors,[]);
console.log(`PASS ${width}px: invitation accepted; three menus; cancel preserves cart; menu confirm clears cart; line+quote+order carry offer; prescribed company billing; voucher blocked; slot failure/empty/retry; inventory bypass.`);
await context.close();
}
}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
