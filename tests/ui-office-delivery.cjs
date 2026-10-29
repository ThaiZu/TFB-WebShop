/* Controlled local browser test: no real membership, order or payment writes. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const raw=()=>({id:11,name:'Office test cake',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,office_delivery:1,is_divisible:0,
 category:{id:3,name:'Cakes',groups:[]},webshop:{price_gross:'10.00',allergen_codes:['gluten','eggs','fish','soy','milk','sesame'],ingredients:''},portions:[],availability_periods:[{id:6,name:"Autumn",is_active:1,webshop_active:1}],
 webshop_availability:{status:'not_enforced',inventory_enforced:false,quantity_available:null,date:'2026-09-17',shop_date:'2026-09-17'}});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try {for(const width of [1440,390,320]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
  await context.addInitScript(()=>{sessionStorage.setItem('ws.session.v1:' + 'ws_auth_token', ((createdAt)=>JSON.stringify({value:'test-office', createdAt, expiresAt:createdAt+43200000}))(Date.now()));sessionStorage.setItem('ws.session.v1:' + 'ws_auth_refresh_token', ((createdAt)=>JSON.stringify({value:'test-refresh', createdAt, expiresAt:createdAt+43200000}))(Date.now()));sessionStorage.setItem('ws.session.v1:' + 'ws.lang', ((createdAt)=>JSON.stringify({value:'pl', createdAt, expiresAt:createdAt+43200000}))(Date.now()));});
  const calls=[],errors=[];let failSites=true,emptySlots=true, preference=null;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='images.example.test')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30"><rect width="80" height="30" fill="red"/></svg>'});
   if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname))return route.abort();
   if(!url.pathname.includes('/api/v1/'))return route.continue();
   const input=req.postData()?req.postDataJSON():null;calls.push({path:url.pathname,search:url.search,method:req.method(),body:input,auth:req.headers().authorization});
   let body=[];
   if(url.pathname.endsWith('/shops'))body=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1,delivery_enabled:1}];
   else if(url.pathname.endsWith('/products/available'))body=[raw()];
   else if(url.pathname.endsWith('/clients/auth/me'))body={user:{id:7,email:'client@example.invalid',firstName:'Test',lastName:'Client',phone:'123456789',postalCode:'00-001',needsPostcode:false,activationRequired:false}}; // intentionally no officeId
   else if(url.pathname.endsWith('/webshop/offices'))body={offices:[{id:14,name:'Office A',logo_url:'https://images.example.test/office.webp',status:'active',offers:[{id:20,name:'Party offer'}]},{id:15,name:'Office B',status:'active',offers:[]}]};
   else if(url.pathname.endsWith('/delivery-preference')) {
    if(req.method()==='POST') preference={officeId:input.office_id,siteId:input.site_id};
    body={preference};
   }
   else if(/\/offices\/\d+\/delivery$/.test(url.pathname)){
    if(failSites){failSites=false;return route.fulfill({status:503,contentType:'application/json',body:'{}'});}
    const id=Number(url.pathname.match(/offices\/(\d+)/)[1]);
    body={office:{id,name:id===14?'Office A':'Office B',status:'active'},sites:[{id:id===14?8:9,name:'Main point',address:'Verified Street 1',routes:[{id:4,name:'Morning'}]},{id:id===14?18:19,name:'Second point',address:'Second Street 2',routes:[{id:4,name:'Morning'}]}]};
   }else if(url.pathname.endsWith('/delivery/slots')){body={slots:emptySlots?[]:[{id:1,label:'15:00 – 15:30',delivery_window_label:'09:00 – 18:00',capacity:30,current_orders:0,available:true,route_id:4}]};emptySlots=false;}
   else if(url.pathname.endsWith('/offices/14/catalog'))body={products:[raw()],office:{id:14,name:'Office A'},offer:{id:20,name:'Party offer'}};
   else if(url.pathname.endsWith('/cart/quote'))body={items:input.products.map(p=>({...p,total_gross_value_after_discount:'10.00',unit_gross_price:'10.00'})),shopping_context:input.shopping_context,
    billing:{mode:input.shopping_context.mode==='office_offer'?'company':'person',company:{name:'Business A'}},totals:{gross_before_discount:'10.00',discount:'0.00',gross_after_discount:'10.00'}};
   else if(url.pathname.endsWith('/webshop/orders'))body={orderId:44,orderRef:'WEB-TEST-44',total:10,paymentType:'company_invoice'};
   else if(url.pathname.endsWith('/webshop/orders/WEB-TEST-44'))body={orderRef:'WEB-TEST-44',mode:'delivery',slot:{dateTime:'2026-09-20 09:00:00',label:'09:00 – 18:00'},payment:{method:'company_invoice',status:'pending'},delivery:{office_name:'Office A',address:'Verified Street 1'},items:[{id:1,name:'Saved cake',quantity:1,unitGrossPrice:12,discountValue:2,totalGross:10}]};
   else if(url.pathname.endsWith('/availability/days')){const start=new Date(url.searchParams.get('from')+'T12:00:00');body=Array.from({length:4},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i+1);return {iso:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),available:true};});}
   else if(url.pathname.endsWith('/payment-methods'))body=[{method:'stripe',family:'stripe',label:'Online'}];
   else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand'))body={};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://webshop.tfbuddy.local/?shop=2');
  await page.locator('.ws-card').first().waitFor();
  assert.equal(await page.locator('.ws-main .ws-office-menus').count(),0);
  const allergenRow=page.locator('.ws-card .al-row').first();
  await allergenRow.waitFor();
  assert.equal(await allergenRow.locator('.al-icon:visible').count(),width<=767?3:5);
  assert.equal(await allergenRow.locator(width<=767?'.al-row__more-mobile':'.al-row__more').innerText(),width<=767?'+3':'+1');
  assert.equal(await page.locator('.ws-cat--season').count(),1);

  assert.equal(await page.locator('.ws-office-catalog-button').count(),0);
  assert.equal(await page.getByRole('button',{name:'Oferta: Party offer',exact:true}).count(),0);
  const menuBox=await page.locator('.ws-nav--A .ws-office-menus').boundingBox();
  const modesBox=await page.locator('.ws-nav--A .ws-modewrap').boundingBox();
  if(width>767){
    await page.locator('.ws-langchip__btn').click();
    const languageMenu=page.locator('.ws-langchip__menu');
    await languageMenu.waitFor();
    const languageMenuAbove=await languageMenu.evaluate(el=>{
      const rect=el.getBoundingClientRect();
      const node=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
      return {ok:node?.closest('.ws-langchip__menu')===el,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},node:node?.className,overflow:getComputedStyle(el.closest('.ws-nav')).overflow};
    });
    assert.ok(languageMenuAbove.ok,'Language menu is above the page content '+JSON.stringify(languageMenuAbove));
    await page.locator('.ws-langchip__btn').click();
  }
  if(width>767){
  for (const selector of ['.ws-nav__left','.ws-nav__right']) {
    const box=await page.locator('.ws-nav--A '+selector).boundingBox();
    assert.ok(Math.abs(box.y+box.height/2-modesBox.y-modesBox.height/2)<2,'All header controls share one row');
  }
  assert.ok(Math.abs(menuBox.y+menuBox.height/2-modesBox.y-modesBox.height/2)<2,'Catalogues and fulfilment share one row');
  const manageBox=await page.locator('.ws-nav--A .ws-office-manage').boundingBox();
  assert.ok(Math.abs(manageBox.x+manageBox.width-menuBox.x-menuBox.width)<2,'My offices is right aligned '+JSON.stringify({menuBox,manageBox}));
  }else{
    const topBox=await page.locator('.ws-nav--A .ws-nav__left').boundingBox();
    assert.ok(modesBox.y>=topBox.y+topBox.height,'Fulfilment below shop and date');
    assert.ok(menuBox.y>=modesBox.y+modesBox.height,'Catalogues below fulfilment');
    assert.equal(await page.locator('.ws-nav--A .ws-office-manage').isVisible(),false);
    assert.ok(await page.locator('.ws-nav--A').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Header has no horizontal overflow');
  }
  if (width >= 600) {
  const info=page.getByRole('button',{name:'Nie masz jeszcze biura?',exact:true});
  await info.hover();
  await page.getByRole('tooltip').waitFor();
  assert.ok(await page.getByRole('tooltip').evaluate(el=>el.parentElement===document.body && getComputedStyle(el).position==='fixed'),'Tooltip escapes header clipping');
  assert.ok(await page.getByRole('tooltip').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementsFromPoint(r.left+r.width/2,r.top+r.height/2).every(node=>!node.closest('.ws-nav'));}));
  }
  if(width>767){
    await page.locator('.ws-nav__date').click();
    const calendar=page.locator('.ws-date-desktop-layer .ws-datepop');
    await calendar.waitFor();
    assert.ok(await calendar.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),'Desktop calendar is above main');
    await page.keyboard.press('Escape');
  }
  if(width<=767){
    await page.locator('.ws-nav__date').click();
    const calendar=page.locator('.ws-datepop');
    await calendar.waitFor();
    const box=await calendar.boundingBox();
    assert.ok(Math.abs(box.x+box.width/2-width/2)<2);
    assert.ok(Math.abs(box.y+box.height/2-500)<2);
    assert.ok(await page.locator('.ws-date-backdrop').evaluate(el=>getComputedStyle(el).backdropFilter.includes('blur')));
    await calendar.locator('.ws-datepop__nav').last().click();
    assert.equal(await calendar.isVisible(),true,'Navigating months does not close portal');
    await calendar.locator('.ws-datepop__cell:not(:disabled):not(.ws-datepop__cell--empty)').first().click();
    await calendar.waitFor({state:'detached'});
    await page.locator('.ws-nav__date').click();
    await page.locator('.ws-date-backdrop').click({position:{x:5,y:5}});
    await calendar.waitFor({state:'detached'});
  }
  assert.equal(await page.getByRole('button',{name:'Katalog sklepu',exact:true}).count(),0);
  await page.locator('.ws-cat--season').waitFor();
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Dostawa do biura',exact:true});
  await modal.getByRole('alert').waitFor();await modal.getByRole('button',{name:'Odśwież terminy',exact:true}).click();
  await modal.locator('select').nth(1).waitFor();
  assert.equal(await modal.locator('select').first().locator('option').count(),2);
  await modal.locator('select').first().selectOption('15');
  await modal.locator('select').nth(1).selectOption('19');
  assert.equal(await modal.getByRole('switch').isChecked(),true,'Preference defaults to enabled');
  assert.equal(await modal.getByRole('switch').isChecked(),true);
  await modal.getByRole('button',{name:'Wybierz punkt dostawy',exact:true}).click();
  await page.locator('.ws[data-mode="delivery"]').waitFor();
  assert.match(await page.locator('.ws-basket__office').first().innerText(),/Office B/);
  assert.equal(await page.locator('.ws-office-billing').count(),0);
  assert.deepEqual(preference,{officeId:15,siteId:19});
  assert.equal(await page.locator('.ws-office-catalog-button').innerText(),'Office B');
  assert.equal(await page.locator('.ws-cat--season').count(),0,'Office catalogue has no period filters');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ws.deliveryPreference:7:2')),null);
  assert.equal(await page.getByRole('button',{name:'Katalog sklepu',exact:true}).count(),0);
  await page.reload();
  await page.locator('.ws-office-menus').waitFor({state:'attached'});
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await page.locator('.ws[data-mode="delivery"]').waitFor();
  assert.equal(await modal.count(),0,'Saved default bypasses selection modal');
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await modal.locator('select').nth(1).waitFor();
  assert.equal(await modal.locator('select').first().inputValue(),'15');
  assert.equal(await modal.locator('select').nth(1).inputValue(),'19');
  await modal.getByRole('button',{name:'Anuluj',exact:true}).click();
  await page.getByRole('tab',{name:'Odbiór w sklepie',exact:true}).click();
  // Offers only become available after selecting office delivery.
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await page.locator('.ws[data-mode="delivery"]').waitFor();
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await modal.locator('select').nth(1).waitFor();
  if(await modal.locator('select').first().inputValue() !== '14') await modal.locator('select').first().selectOption('14');
  await modal.locator('select').nth(1).locator('option[value="8"]').waitFor({state:'attached'});
  await modal.getByRole('button',{name:'Wybierz punkt dostawy',exact:true}).click();
  await page.getByRole('button',{name:'Oferta: Party offer',exact:true}).waitFor();
  const logo=page.locator('.ws-office-menu-links .ws-office-catalog-logo').first();
  await logo.waitFor();
  assert.equal(await logo.getAttribute('src'),'https://images.example.test/office.webp');
  assert.ok((await logo.locator('xpath=ancestor::button').getAttribute('aria-label')).includes('Office A'));
  assert.equal((await logo.locator('xpath=ancestor::button').innerText()).trim(),'');
  await page.waitForFunction(()=>document.querySelector('.ws-office-catalog-logo')?.naturalWidth>0);
  assert.equal(await page.getByRole('button',{name:'Katalog sklepu',exact:true}).count(),0);
  assert.equal(await page.locator('.ws-cat--season').count(),0);
  const controls=await page.locator('.ws-nav--A button:visible').evaluateAll(buttons=>buttons.map(button=>({name:button.getAttribute('aria-label')||button.textContent,height:button.getBoundingClientRect().height})));
  assert.ok(controls.every(button=>Math.abs(button.height-44)<1),JSON.stringify(controls));

  await page.locator('.ws-card .ws-add').click();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('.ws-line'));
  // Changing delivery to collection requires explicit consent to clear the cart.
  await page.getByRole('tab',{name:'Odbiór w sklepie',exact:true}).click();
  const switchDialog=page.getByRole('alertdialog');
  await switchDialog.waitFor();
  await switchDialog.getByRole('button',{name:'Anuluj',exact:true}).click();
  assert.equal(await page.locator('.ws[data-mode="delivery"]').count(),1);
  assert.equal(await page.locator('.ws-line').count(),1);
  await page.getByRole('tab',{name:'Odbiór w sklepie',exact:true}).click();
  await switchDialog.locator('.ws-cta').click();
  await page.locator('.ws[data-mode="collect"]').waitFor();
  assert.equal(await page.locator('.ws-line').count(),0);
  assert.equal(await page.locator('.ws-office-catalog-button').count(),0);
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await page.locator('.ws[data-mode="delivery"]').waitFor();
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await modal.locator('select').nth(1).waitFor();
  if(await modal.locator('select').first().inputValue() !== '14') await modal.locator('select').first().selectOption('14');
  await modal.locator('select').nth(1).locator('option[value="8"]').waitFor({state:'attached'});
  await modal.getByRole('button',{name:'Wybierz punkt dostawy',exact:true}).click();
  await page.getByRole('button',{name:'Oferta: Party offer',exact:true}).waitFor();
  await page.locator('.ws-card .ws-add').click();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('.ws-line'));
  // Cancel changing delivery preserves the basket.
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await modal.getByText('Zmiana sposobu lub miejsca realizacji wyczyści koszyk.',{exact:false}).waitFor();
  await modal.getByRole('button',{name:'Anuluj',exact:true}).click();assert.equal(await page.locator('.ws-line').count(),1);
  if(width<600)await page.locator('.ws-tabbar__btn--cart').click();
  await page.locator('.ws-basket:visible .ws-cta').click();
  await page.locator('.ws-checkout').waitFor();
  assert.equal(await page.locator('.ws-checkout__body>.ws-office-context').count(),0);
  assert.equal(await page.locator('.ws-checkout__body .ws-office-billing').count(),0);
  assert.match(await page.locator('.ws-checkout').innerText(),/Verified Street 1/);
  await page.locator('.ws-checkout__foot-actions .ws-cta').click();
  await page.getByText('Brak dostępnych godzin na ten dzień.',{exact:false}).waitFor();
  assert.equal(await page.locator('.ws-checkout__foot-actions .ws-cta').isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Odśwież terminy',exact:true}).count(),0);
  await page.waitForFunction(()=>document.querySelectorAll('.ws-pickup-dates button').length===3);
  assert.doesNotMatch(await page.locator('.ws-pickup-dates').innerText(),/\d{2}:\d{2}/);
  await page.locator('.ws-pickup-dates button').first().click();
  await page.locator('.ws-slot').first().waitFor();assert.equal(await page.locator('.ws-slot').count(),1);assert.equal(await page.locator('.ws-slot__lbl').innerText(),'09:00 – 18:00');await page.locator('.ws-checkout__foot-actions .ws-cta').click();
  assert.equal(await page.locator('.ws-pay input').inputValue(),'company_invoice');
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/webshop/orders')),page.getByRole('button',{name:'Potwierdź zamówienie',exact:true}).click()]);
  const order=calls.filter(c=>c.path.endsWith('/webshop/orders')).at(-1).body;
  assert.equal(order.mode,'delivery');assert.equal(order.delivery.office_client_id,14);assert.equal(order.delivery.office_delivery_site_id,8);
  assert.equal(order.payment.method,'company_invoice');assert.equal(order.expected_total,'10.00');assert.equal(order.delivery.delivery_fee_amount,0);
  assert.ok(calls.filter(c=>c.path.includes('/delivery')).every(c=>c.auth==='Bearer test-office'));
  assert.ok(!calls.some(c=>c.path.includes('/delivery-fees')||c.path.includes('/tours')));
  const confirmation=page.getByRole('dialog',{name:'Zamówienie potwierdzone',exact:true});
  await confirmation.getByText('Saved cake',{exact:true}).waitFor();
  assert.match(await confirmation.innerText(),/Verified Street 1/);
  assert.match(await confirmation.locator('.ws-order-summary__total').innerText(),/10,00/);
  assert.ok(await confirmation.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Confirmation fits mobile screen');
  await page.screenshot({path:'/tmp/webshop-confirmation-'+width+'.png',fullPage:false});
  await confirmation.getByRole('button',{name:'Wróć do sklepu',exact:true}).click();
  await confirmation.waitFor({state:'detached'});
  await page.getByRole('tab',{name:'Odbiór w sklepie',exact:true}).click();
  await page.locator('.ws[data-mode="collect"]').waitFor();
  assert.equal(await page.locator('.ws-office-catalog-button').count(),0);
  assert.equal(await page.getByRole('button',{name:'Oferta: Party offer',exact:true}).count(),0);

  await page.locator('.ws-card .ws-add').click();await page.locator('.pdm-cta').click();await page.locator('.pdm-cta').waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('.ws-line'));
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await switchDialog.waitFor();
  assert.equal(await modal.count(),0,'Saved address does not open selection with a full basket');
  await switchDialog.getByRole('button',{name:'Anuluj',exact:true}).click();
  assert.equal(await page.locator('.ws-line').count(),1);
  assert.equal(await page.locator('.ws[data-mode="collect"]').count(),1);
  await page.getByRole('tab',{name:'Dostawa do biura',exact:true}).click();
  await switchDialog.locator('.ws-cta').click();
  await page.locator('.ws[data-mode="delivery"]').waitFor();
  assert.equal(await page.locator('.ws-line').count(),0);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: M:N office selection without legacy officeId, retry, sites, offer context, cancel preserves basket, office slots, company billing, free delivery payload.`);
  await context.close();
 }} finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
