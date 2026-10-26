/* Real storefront UI, controlled API. Does not create orders or payments. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});try{
for(const width of [1440,390]){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
 await context.addInitScript(()=>localStorage.setItem('ws.lang','pl'));
 const errors=[],quotes=[]; let rejectPromotion=false;await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname))return route.abort();
  if(url.pathname==='/promotion-product-fixture.svg')return route.fulfill({contentType:'image/svg+xml',headers:{'Cache-Control':'public, max-age=3600'},body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#f5ce92"/></svg>'});
  if(!url.pathname.includes('/api/v1/'))return route.continue();let body=[];
  if(url.pathname.endsWith('/shops'))body=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1,delivery_enabled:1}];
  else if(url.pathname.endsWith('/products/available'))body=[{id:1410018,name:'Tarte abricot',id_category:14100,is_active:1,webshop_active:1,click_and_collect:1,office_delivery:1,is_divisible:0,is_piece_based:1,category:{id:14100,name:'Tarte abricot',groups:[]},webshop_image:{url:'/promotion-product-fixture.svg'},webshop:{price_gross:'22.50',allergen_codes:[]},portions:[{id:2,portion_type:'ONE_HALF',is_active:1,is_ready_for_sale:1,shop_price_gross:'10.00'},{id:'3',portion_type:'ONE_QUARTER',is_active:1,is_ready_for_sale:1,shop_price_gross:'6.90'}],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false,quantity_available:null}}].flatMap(product=>[product,{...product,id:1410001,name:'Tarte fraise',portions:[{id:'4',portion_type:'ONE_QUARTER',is_active:1,is_ready_for_sale:1,shop_price_gross:'8.90'}]}]);
  else if(url.pathname.endsWith('/products/10/menus'))body=[{id:2,base_portion_id:60,menu_id:1,version:3,menu_name:'Lunch',name:'Food and drink',base_total:9,price_modifier:1,slots:[{id:3,label:'Drink',required:true,kind:'single',min_select:1,max_select:1,choices:[{id:4,product_id:20,label:'Cola',delta:0,img:null}]}]}];
  else if(url.pathname.endsWith('/cart/quote')){
   const p=req.postDataJSON();quotes.push(p);
   const grouped=p.products.some(l=>l.promotion_group);
   if(grouped&&rejectPromotion)return route.fulfill({status:422,json:{error:{code:'WEBSHOP_PROMOTION_GROUP_NOT_APPLICABLE'}}});
   const existing=p.products.filter(l=>l.line_key!==p.promotion_preview_line_key);
   const existingGross=existing.reduce((sum,l)=>sum+Number(l.quantity)*(Number(l.id_product_portion)===3?6.90:22.50),0);
   const missing=Math.max(0,50-existingGross);
   const previewQuarter=p.products.some(l=>l.line_key===p.promotion_preview_line_key&&Number(l.id_product_portion)===3);
   const offer={id_promotion:2,name:'4 quarts + 1 Gratuit',promotion_type:'BUY_X_GET_Y',
     minimum_receipt_gross:'50.00',is_available:missing===0,minimum_receipt_missing:missing.toFixed(2),
     promotion_total_gross_after_discount:'22.50',trigger:{quantity:1,quantity_unit:'PIECE_FRACTION',any_portion:true},
     reward:{type:'FREE',quantity:1},items:[
       {id_product:1410018,id_product_portion:previewQuarter?3:null,quantity:previewQuarter?4:1,product_name:'Tarte abricot',product_portion_type:previewQuarter?'ONE_QUARTER':null,role:'trigger'},
       {id_product:1410018,id_product_portion:3,quantity:1,product_name:'Tarte abricot',product_portion_type:'ONE_QUARTER',role:'reward'}]};
   const strawberry={id_product:1410001,id_product_portion:4,quantity:1,product_name:'Tarte fraise',product_portion_type:'ONE_QUARTER',role:'reward'};
   const originalChoice={...offer};
   const strawberryChoice={...offer,items:[offer.items[0],strawberry],promotion_total_gross_after_discount:'24.50'};
   offer.reward_options=[{...offer.items[1],additional_cost_gross:'0.00',suggestion:originalChoice},{...strawberry,additional_cost_gross:'2.00',suggestion:strawberryChoice}];
   const gross=p.products.reduce((sum,l)=>sum+Number(l.quantity)*(Number(l.id_product_portion)===3?6.90:22.50),0);
   body={items:p.products.map(l=>({...l,unit_gross_price:String(Number(l.id_product_portion)===3?6.90:22.50),
     total_gross_value_after_discount:String(Number(l.quantity)*(Number(l.id_product_portion)===3?6.90:22.50)-(grouped&&l.promotion_group&&Number(l.id_product_portion)===3?6.90:0))})),
     totals:{gross_before_discount:String(gross),gross_after_discount:(gross-(grouped?6.90:0)).toFixed(2),discount:grouped?'6.90':'0.00'},
     applied_promotions:grouped?[{id_promotion:2,display_name:offer.name}]:[],promotion_suggestions:[offer],
     unlocked_promotions:existingGross>=50?[{id_promotion:2,name:offer.name,minimum_receipt_gross:'50.00',status:grouped?'APPLIED':'UNLOCKED',
       options:[{id_product:1410018,id_product_portion:null,product_name:'Tarte abricot',quantity:1},
         {id_product:1410018,id_product_portion:3,product_name:'Tarte abricot',product_portion_type:'ONE_QUARTER',quantity:1}]}]:[]};
  }
  else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand'))body={};
  else if(url.pathname.endsWith('/availability/slots'))body=[{id:1,label:'12:00 – 14:00',start:'12:00',end:'14:00',available:true}];
  else if(url.pathname.endsWith('/payment-methods'))body=[{method:'stripe',family:'stripe',label:'Online'}];
  return route.fulfill({json:body});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://webshop.tfbuddy.local/?shop=2&category=category%3A14100');
 await page.locator('.ws-card .ws-add').first().click();
 const card=page.locator('.pdm-promotion__card');
 await page.locator('.pdm-qty__btn').last().click();
 await page.waitForFunction(()=>document.querySelector('.pdm-qty__val')?.textContent==='2');
 await page.waitForTimeout(300);
 assert.equal(await card.count(),1,'threshold offer stays visible before real purchases reach 50');
 assert.equal(await card.isDisabled(),true);
 assert.equal(await card.locator('.pdm-promotion__rule').count(),0,'blocked card omits the long rules');
 assert.equal(await card.locator('.pdm-promotion__period').count(),0,'missing amount replaces a duplicate threshold sentence');
 assert.match(await card.innerText(),/Brakuje Ci jeszcze.*50[,.]00/);
 assert.equal(await card.locator('progress').getAttribute('value'),'0');
 await page.locator('.pdm-qty__btn').last().click();
 await page.waitForTimeout(300);
 assert.equal(await card.count(),1,'pending quantities do not hide the offer');
 assert.equal(await card.isDisabled(),true,'pending quantities cannot unlock the offer');
 await page.locator('.pdm-qty__btn').first().click();
 await page.locator('.pdm-cta').click();
 await page.waitForFunction(()=>!document.querySelector('.pdm-cta'));
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.ws-cart-unlocked .ws-cart-reward').count(),0,'45 is below the level');
 await page.locator('.ws-card .ws-add').first().click();
 await page.waitForFunction(()=>document.querySelector('.pdm-promotion__card progress')?.value===45);
 assert.match(await card.innerText(),/Brakuje Ci jeszcze.*5[,.]00/);
 await page.locator('.pdm-cta').click();
 await page.waitForFunction(()=>!document.querySelector('.pdm-cta'));
 if(width<600)await page.locator('.ws-tabbar__btn--cart').click();
 const basket=width<600?page.locator('.ws-drawer .ws-basket'):page.locator('.ws-basket').first();
 const unlocked=basket.locator('.ws-cart-unlocked .ws-cart-reward');
 await unlocked.getByText('Odblokowane promocje',{exact:true}).waitFor();
 assert.match(await unlocked.innerText(),/Próg .*50[,.]00.*osiągnięty/);
 assert.doesNotMatch(await unlocked.innerText(),/Rabat wymaga|Zasady promocji|przed rabatami|bez dostawy/);
 assert.equal(await unlocked.locator('details').count(),0);
 assert.equal(await page.locator('.ws-promotion-product__image').count(),0,'picker images are mounted only after opening');
 const quotesBeforeOpening=quotes.length;
 await unlocked.getByRole('button',{name:'Zobacz produkty',exact:true}).click();
 const chooser=page.getByRole('dialog',{name:'Zobacz produkty',exact:true});
 await chooser.waitFor();
 assert.equal(quotes.length,quotesBeforeOpening,'opening product choices does not issue another quote request');
 assert.equal(await chooser.locator('.ws-cart-reward__options button').count(),2);
 const images=chooser.locator('.ws-promotion-product__image');
 assert.equal(await images.count(),2);
 const sources=await images.evaluateAll(elements=>elements.map(image=>image.getAttribute('src')));
 assert.deepEqual(sources,['/promotion-product-fixture.svg','/promotion-product-fixture.svg']);
 assert.equal(await images.first().getAttribute('loading'),'lazy');
 assert.equal(await images.first().getAttribute('decoding'),'async');
 const presentation=await chooser.locator('.ws-cart-reward__options button').first().evaluate(element=>{
   const styles=getComputedStyle(element);
   const gridCard=document.querySelector('.ws-card');
   return {background:styles.backgroundColor,surface:getComputedStyle(gridCard).backgroundColor,radius:parseFloat(styles.borderRadius)};
 });
 assert.equal(presentation.background,presentation.surface,'picker matches the light catalogue card surface');
 assert.ok(presentation.radius>=14);
 const deliveryBackground=await chooser.locator('.ws-cart-reward__options button').first().evaluate(element=>{
   const previouslyDelivery=document.body.classList.contains('ws-mode-delivery');
   document.body.classList.add('ws-mode-delivery');
   const background=getComputedStyle(element).backgroundColor;
   if(!previouslyDelivery)document.body.classList.remove('ws-mode-delivery');
   return background;
 });
 assert.equal(deliveryBackground,presentation.surface,'product choices also keep the light surface in mobile delivery mode');

 const productPictureRequests=()=>page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>entry.name.endsWith('/promotion-product-fixture.svg')).length);
 assert.ok(await productPictureRequests()<=1,'one cached picture is shared by the grid and both portion choices');
 // A missing photograph switches to the existing placeholder without retrying the failed URL.
 await images.first().evaluate(image=>image.dispatchEvent(new Event('error')));
 assert.notEqual(await images.first().getAttribute('src'),'/promotion-product-fixture.svg');

 assert.doesNotMatch(await chooser.innerText(),/Bez dopłaty/);
 await page.keyboard.press('Escape');
 // Removing the additional ordinary tart relocks the offer without leaving a stale modal.
 await basket.locator('.ws-line__remove').last().click();
 await page.waitForFunction(()=>!document.querySelector('.ws-cart-unlocked .ws-cart-reward'));
 if(width<600)await page.locator('.ws-drawer__close').click();
 await page.locator('.ws-card .ws-add').first().click();
 await page.locator('.pdm-cta').click();
 await page.waitForFunction(()=>!document.querySelector('.pdm-cta'));
 if(width<600)await page.locator('.ws-tabbar__btn--cart').click();
 await unlocked.getByRole('button',{name:'Zobacz produkty',exact:true}).click();
 await chooser.locator('.ws-cart-reward__options button').filter({hasText:'1/4'}).click();
 await page.locator('.pdm-seg--portions').getByRole('radio',{name:/1\/4/}).waitFor();
 assert.equal(await page.locator('.pdm-seg--portions').getByRole('radio',{name:/1\/4/}).getAttribute('aria-checked'),'true');
 await card.waitFor();
 await page.waitForFunction(()=>document.querySelector('.pdm-promotion__card')?.disabled===false);
 await page.waitForFunction(()=>document.querySelector('.pdm-promotion__card')?.getAttribute('aria-pressed')==='true');
 await page.locator('.pdm-gift-summary').waitFor();
 assert.equal(await page.locator('.pdm-qty').isVisible(),false,'fixed offer is explicitly one set');
 const rewardChooser=page.getByRole('radiogroup',{name:'Wybierz produkt w promocji',exact:true});
 await rewardChooser.waitFor();
 assert.equal(await page.locator('.ws-reward-modal').count(),0,'reward choices stay inside the product sheet');
 assert.equal(await rewardChooser.locator('img').count(),2);
 assert.equal(await rewardChooser.getByRole('radio').first().getAttribute('aria-checked'),'true','the displayed default matches the reward already in the set');
 assert.match(await rewardChooser.innerText(),/1\/4 Tarte fraise/);
 assert.match(await rewardChooser.innerText(),/Gratis/);
 assert.equal(await rewardChooser.locator('del').count(),2,'regular catalogue prices are crossed out');
 const quotesBeforeReward=quotes.length;
 await rewardChooser.getByRole('radio').first().focus();
 await page.keyboard.press('End');
 await rewardChooser.locator('[role=radio][aria-checked=true]').filter({hasText:'Tarte fraise'}).waitFor();
 assert.equal(await rewardChooser.getByRole('radio').last().getAttribute('aria-checked'),'true');
 await page.keyboard.press('Home');
 await rewardChooser.locator('[role=radio][aria-checked=true]').filter({hasText:'Tarte abricot'}).waitFor();
 assert.equal(await rewardChooser.getByRole('radio').first().getAttribute('aria-checked'),'true');
 await rewardChooser.getByRole('radio').filter({hasText:'Tarte fraise'}).click();
 assert.match(await page.locator('.pdm-gift-summary').innerText(),/1\/4 Tarte fraise/);
 assert.match(await page.locator('.pdm-gift-summary').innerText(),/2[,.]00/);
 assert.equal(quotes.length,quotesBeforeReward,'choosing a reward uses the existing server-priced options');
 await page.locator('.pdm').screenshot({path:'/tmp/tfbuddy-inline-gift-'+width+'.png'});
 rejectPromotion=true;
 await page.locator('.pdm-cta').click();
 await page.locator('.pdm-foot [role=alert]').waitFor();
 assert.match(await page.locator('.pdm-foot [role=alert]').innerText(),/Koszyk nie został zmieniony/);
 assert.equal(await page.locator('.pdm-cta').isVisible(),true,'failed validation leaves product sheet open');
 rejectPromotion=false;
 await page.locator('.pdm-cta').click();
 await page.waitForFunction(()=>!document.querySelector('.pdm-cta'));
 if(width<600)await page.locator('.ws-tabbar__btn--cart').click();
 const composition=basket.locator('.ws-line--promotion .ws-line__opt');
 assert.match(await composition.first().innerText(),/1\/4/);
 assert.match(await composition.last().innerText(),/1\/4 Tarte fraise/);
 assert.equal(await basket.locator('.ws-cart-unlocked .ws-cart-reward').count(),0,'selected promotion no longer announces unlocking');
 const actual=quotes.filter(q=>!q.promotion_preview_line_key&&q.products.some(l=>l.promotion_group));
 assert.ok(actual.length>=2);
 for(const q of actual){
  assert.equal(q.products.filter(l=>!l.promotion_group).length,2,'failed attempt left no duplicate promotional lines');
  assert.equal(q.products.filter(l=>l.promotion_group).length,2,'exactly one complete offer is added');
  assert.ok(q.products.some(l=>l.promotion_group&&l.id_product===1410001&&l.id_product_portion===4),'chosen reward stays in the validated set');
 }
 assert.deepEqual(errors,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 await context.close();console.log('PASS exclusive unlock, hide, relock, modal product choice and atomic retry at width '+width);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
