// Browser UI integration with mocked Stripe/API. No real payments or orders.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try {for(const width of [1440,390]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
  await context.addInitScript(()=>{localStorage.setItem('ws_auth_token','test');localStorage.setItem('ws.lang','pl');});
  const ref='WEB-2-20260918-ABCDEF';let orders=0,payments=0,statusCalls=0,status='unpaid';const errors=[];
  let releaseQuote;
  const quoteGate = new Promise(resolve => { releaseQuote = resolve; });
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==='js.stripe.com')return route.fulfill({contentType:'application/javascript',body:`window.Stripe=(key,options)=>{window.stripeInit={key,...options};return {createEmbeddedCheckoutPage:async config=>{window.checkoutSecret=await config.fetchClientSecret();let button;return {mount:target=>{button=document.createElement('button');button.textContent='Test Stripe completion';button.onclick=config.onComplete;target.appendChild(button);},destroy:()=>{window.stripeDestroyed=(window.stripeDestroyed||0)+1;button?.remove();}};}};};`});
   if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(u.hostname))return route.abort();
   if(!u.pathname.includes('/api/v1/'))return route.continue();
   let data=[];
   if(u.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(u.pathname.endsWith('/clients/auth/me'))data={user:{id:7,email:'test@example.invalid',firstName:'Test',lastName:'Client',phone:'123456789',postalCode:'00-001',activationRequired:false}};
   else if(u.pathname.endsWith('/products/available'))data=[{id:11,name:'Test baguette',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,category:{id:3,name:'Bread',groups:[]},webshop:{price_gross:'10.00',allergen_codes:[],ingredients:''},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false}}];
   else if(u.pathname.endsWith('/webshop/offices'))data={offices:[]};
   else if(u.pathname.endsWith('/cart/quote')){await quoteGate;const b=req.postDataJSON();data={items:b.products.map(p=>({...p,total_gross_value_after_discount:'10.00',unit_gross_price:'10.00'})),shopping_context:b.shopping_context,billing:{mode:'person'},totals:{gross_before_discount:'10.00',discount:'0.00',gross_after_discount:'10.00'}};}
   else if(u.pathname.endsWith('/availability/slots'))data=[{id:1,label:'15:00 – 15:30',capacity:30,current_orders:0,available:true}];
   else if(u.pathname.endsWith('/payment-methods'))data=[{method:'stripe',family:'stripe',label:'Online'}];
   else if(u.pathname.endsWith('/webshop/orders')&&req.method()==='POST'){orders++;data={orderId:44,orderRef:ref,total:10,paymentType:'stripe'};}
   else if(u.pathname.endsWith('/stripe-checkout')){
    payments++;assert.equal(req.postDataJSON().ui_mode,'embedded');
    data={status:'open',uiMode:'embedded',orderRef:ref,clientSecret:'cs_test_fixture_secret_fixture',publishableKey:'pk_test_fixture',stripeAccount:'acct_fixture'};
   }
   else if(u.pathname.endsWith('/stripe-status')){statusCalls++;data={status,orderRef:ref,amountMinor:1000,currency:'eur'};}
   else if(u.pathname.endsWith('/webshop/orders/'+ref))data={orderRef:ref,payment:{method:'stripe',status:status==='paid'?'paid':'pending'},items:[],status:'new'};
   else if(u.pathname.endsWith('/config')||u.pathname.endsWith('/brand'))data={};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://webshop.tfbuddy.local/?shop=2');
  await page.locator('.ws-card .ws-add').click();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
  if(width<600)await page.locator('.ws-tabbar__btn--cart').click();
  const checkoutButton=page.locator('.ws-basket:visible .ws-cta');
  assert.equal(await checkoutButton.isDisabled(),true,'checkout blocked while quote is pending');
  await checkoutButton.evaluate(button=>{
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:1,clientY:1}));
    button.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,clientX:1,clientY:1}));
    button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  });
  assert.equal(await page.locator('.ws-checkout').count(),0,'native tap must respect disabled');
  assert.deepEqual(errors,[]);assert.equal(orders,0);
  releaseQuote();
  await page.locator('.ws-basket:visible .ws-cta').click();
  await page.locator('.ws-checkout__foot-actions .ws-cta').click();await page.locator('.ws-slot').first().click();
  await page.locator('.ws-checkout__foot-actions .ws-cta').click();await page.locator('.ws-pay input[value="stripe"]').waitFor();
  await page.locator('.ws-checkout__foot-actions .ws-cta').click();
  const modal=page.getByRole('dialog',{name:'Płatność',exact:true});
  await modal.getByRole('button',{name:'Test Stripe completion'}).waitFor();
  assert.equal(orders,1);assert.equal(payments,1);assert.equal(await page.locator('.ws-line').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.stripeInit),{key:'pk_test_fixture',stripeAccount:'acct_fixture'});
  assert.equal(new URL(page.url()).hostname,'webshop.tfbuddy.local');
  await modal.getByRole('button',{name:'Zamknij',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.stripeDestroyed),1);
  await page.getByRole('button',{name:'Sprawdź ostatnią płatność',exact:true}).click();
  await modal.getByRole('button',{name:'Przejdź do płatności',exact:true}).click();
  await modal.getByRole('button',{name:'Test Stripe completion'}).waitFor();
  assert.equal(orders,1);assert.equal(payments,2);
  // Stripe UI completion is not proof of payment: API still says unpaid.
  await modal.getByRole('button',{name:'Test Stripe completion'}).click();
  await modal.getByRole('button',{name:'Test Stripe completion'}).waitFor({state:'detached'});
  assert.equal(await modal.getByText('Płatność potwierdzona.',{exact:false}).count(),0);
  await modal.getByRole('button',{name:'Przejdź do płatności',exact:true}).click();
  await modal.getByRole('button',{name:'Test Stripe completion'}).waitFor();
  status='paid';await modal.getByRole('button',{name:'Test Stripe completion'}).click();
  await modal.getByText('Płatność potwierdzona.',{exact:false}).first().waitFor();
  assert.equal(orders,1);assert.ok(statusCalls>=3);assert.deepEqual(errors,[]);
  assert.ok(!await page.evaluate(()=>Object.values(sessionStorage).some(v=>v.includes('_secret_'))));
  console.log('PASS embedded checkout '+width+'px: connected account, no navigation, close destroys form, retry same order, server verification required');
  await context.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
