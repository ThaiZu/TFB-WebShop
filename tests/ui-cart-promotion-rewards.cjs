/* Real storefront UI, controlled API. Does not create orders or payments. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const suggestions={"WHOLE":{"id_promotion":17,"name":"Kup całość i odbierz ćwiartkę","description":null,"promotion_type":"BUY_X_GET_Y","bundle_price":null,"total_gross_after_discount":"13.90","promotion_total_gross_after_discount":"13.90","discount_total":"12.00","trigger":{"quantity":"1.000","quantity_unit":"PIECE_FRACTION","any_portion":true},"reward":{"type":"FREE","quantity":1,"value":null},"items":[{"id_product":1410018,"id_product_portion":null,"product_name":"Quiche","product_portion_label":null,"product_portion_type":null,"quantity":"1","role":"trigger","missing_quantity":"0"},{"id_product":1410018,"id_product_portion":3,"product_name":"Quiche","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"1","role":"reward","missing_quantity":"1.00000000"}]},"ONE_HALF":{"id_promotion":17,"name":"Kup całość i odbierz ćwiartkę","description":null,"promotion_type":"BUY_X_GET_Y","bundle_price":null,"total_gross_after_discount":"20.00","promotion_total_gross_after_discount":"20.00","discount_total":"12.00","trigger":{"quantity":"1.000","quantity_unit":"PIECE_FRACTION","any_portion":true},"reward":{"type":"FREE","quantity":1,"value":null},"items":[{"id_product":1410018,"id_product_portion":2,"product_name":"Quiche","product_portion_label":null,"product_portion_type":"ONE_HALF","quantity":"2","role":"trigger","missing_quantity":"1.00000000"},{"id_product":1410018,"id_product_portion":3,"product_name":"Quiche","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"1","role":"reward","missing_quantity":"1.00000000"}]},"ONE_QUARTER":{"id_promotion":17,"name":"Kup całość i odbierz ćwiartkę","description":null,"promotion_type":"BUY_X_GET_Y","bundle_price":null,"total_gross_after_discount":"48.00","promotion_total_gross_after_discount":"48.00","discount_total":"12.00","trigger":{"quantity":"1.000","quantity_unit":"PIECE_FRACTION","any_portion":true},"reward":{"type":"FREE","quantity":1,"value":null},"items":[{"id_product":1410018,"id_product_portion":3,"product_name":"Quiche","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"5.00000000","role":"trigger_and_reward","trigger_quantity":"4","reward_quantity":"1","missing_quantity":"4.00000000"}]}};
const cartRewards={"3":{"milliseconds":0,"rewards":[]},"4":{"milliseconds":62,"rewards":[{"id_promotion":17,"name":"Quiche offer","status":"AVAILABLE","trigger":{"quantity":"1.000","quantity_unit":"PIECE_FRACTION"},"trigger_items":[{"id_product":1410002,"id_product_portion":18,"product_name":"Quiche 1410002","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"4.00000000","role":"trigger"}],"reward_quantity":1,"is_repeatable":true,"max_applications_per_transaction":null,"options":[{"id_product":1410018,"id_product_portion":3,"product_name":"Quiche 1410018","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"1","role":"reward","additional_cost_gross":"9.00","additional_discount_gross":"3.00"},{"id_product":1410001,"id_product_portion":14,"product_name":"Quiche 1410001","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"1","role":"reward","additional_cost_gross":"1.00","additional_discount_gross":"3.00"},{"id_product":1410014,"id_product_portion":16,"product_name":"Quiche 1410014","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"1","role":"reward","additional_cost_gross":"1.00","additional_discount_gross":"3.00"},{"id_product":1410002,"id_product_portion":18,"product_name":"Quiche 1410002","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"1","role":"reward","additional_cost_gross":"0.00","additional_discount_gross":"3.00"},{"id_product":1410019,"id_product_portion":20,"product_name":"Quiche 1410019","product_portion_label":null,"product_portion_type":"ONE_QUARTER","quantity":"1","role":"reward","additional_cost_gross":"1.00","additional_discount_gross":"3.00"}]}]},"5":{"milliseconds":0,"rewards":[{"id_promotion":17,"name":"Quiche offer","status":"APPLIED","trigger":{"quantity":"1.000","quantity_unit":"PIECE_FRACTION"},"trigger_items":[],"reward_quantity":1,"is_repeatable":true,"max_applications_per_transaction":null,"options":[]}]}};
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});try{
for(const width of [1440,390]){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
 await context.addInitScript(()=>localStorage.setItem('ws.lang','pl'));
 const errors=[],quotes=[];await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname))return route.abort();
  if(!url.pathname.includes('/api/v1/'))return route.continue();let body=[];
  if(url.pathname.endsWith('/shops'))body=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1,delivery_enabled:1}];
  else if(url.pathname.endsWith('/products/available'))body=[{"id":1410002,"name":"Quiche 1410002","id_category":14100,"is_active":1,"webshop_active":1,"click_and_collect":1,"office_delivery":1,"is_divisible":0,"is_piece_based":1,"category":{"id":14100,"name":"Quiche","groups":[]},"webshop":{"price_gross":"13.90","allergen_codes":[]},"portions":[{"id":18,"portion_type":"ONE_QUARTER","is_active":1,"is_ready_for_sale":1,"shop_price_gross":"3"}],"availability_periods":[],"webshop_availability":{"status":"not_enforced","inventory_enforced":false,"quantity_available":null}},{"id":1410018,"name":"Quiche 1410018","id_category":14100,"is_active":1,"webshop_active":1,"click_and_collect":1,"office_delivery":1,"is_divisible":0,"is_piece_based":1,"category":{"id":14100,"name":"Quiche","groups":[]},"webshop":{"price_gross":"13.90","allergen_codes":[]},"portions":[{"id":3,"portion_type":"ONE_QUARTER","is_active":1,"is_ready_for_sale":1,"shop_price_gross":"12"}],"availability_periods":[],"webshop_availability":{"status":"not_enforced","inventory_enforced":false,"quantity_available":null}},{"id":1410001,"name":"Quiche 1410001","id_category":14100,"is_active":1,"webshop_active":1,"click_and_collect":1,"office_delivery":1,"is_divisible":0,"is_piece_based":1,"category":{"id":14100,"name":"Quiche","groups":[]},"webshop":{"price_gross":"13.90","allergen_codes":[]},"portions":[{"id":14,"portion_type":"ONE_QUARTER","is_active":1,"is_ready_for_sale":1,"shop_price_gross":"4"}],"availability_periods":[],"webshop_availability":{"status":"not_enforced","inventory_enforced":false,"quantity_available":null}},{"id":1410014,"name":"Quiche 1410014","id_category":14100,"is_active":1,"webshop_active":1,"click_and_collect":1,"office_delivery":1,"is_divisible":0,"is_piece_based":1,"category":{"id":14100,"name":"Quiche","groups":[]},"webshop":{"price_gross":"13.90","allergen_codes":[]},"portions":[{"id":16,"portion_type":"ONE_QUARTER","is_active":1,"is_ready_for_sale":1,"shop_price_gross":"4"}],"availability_periods":[],"webshop_availability":{"status":"not_enforced","inventory_enforced":false,"quantity_available":null}},{"id":1410019,"name":"Quiche 1410019","id_category":14100,"is_active":1,"webshop_active":1,"click_and_collect":1,"office_delivery":1,"is_divisible":0,"is_piece_based":1,"category":{"id":14100,"name":"Quiche","groups":[]},"webshop":{"price_gross":"13.90","allergen_codes":[]},"portions":[{"id":20,"portion_type":"ONE_QUARTER","is_active":1,"is_ready_for_sale":1,"shop_price_gross":"4"}],"availability_periods":[],"webshop_availability":{"status":"not_enforced","inventory_enforced":false,"quantity_available":null}}];
  else if(url.pathname.endsWith('/products/10/menus'))body=[{id:2,base_portion_id:60,menu_id:1,version:3,menu_name:'Lunch',name:'Food and drink',base_total:9,price_modifier:1,slots:[{id:3,label:'Drink',required:true,kind:'single',min_select:1,max_select:1,choices:[{id:4,product_id:20,label:'Cola',delta:0,img:null}]}]}];
  else if(url.pathname.endsWith('/cart/quote')){
   const p=req.postDataJSON();quotes.push(p);
   const quantity=p.products.reduce((sum,l)=>sum+Number(l.quantity),0);
   const applied=quantity>=5;
   const discount=applied?3:0;
   body={items:p.products.map((l,i)=>({...l,unit_gross_price:'12.00',total_gross_value_after_discount:String(Number(l.quantity)*(l.id_product===1410002?3:4)-(applied&&i===0?discount:0))})),totals:{gross_before_discount:String(p.products.reduce((sum,l)=>sum+Number(l.quantity)*(l.id_product===1410002?3:4),0)),gross_after_discount:String(p.products.reduce((sum,l)=>sum+Number(l.quantity)*(l.id_product===1410002?3:4),0)-discount),discount:String(discount)},applied_promotions:[],promotion_suggestions:[],promotion_rewards:cartRewards[applied?5:quantity===4?4:3].rewards};
  }
  else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand'))body={};
  else if(url.pathname.endsWith('/availability/slots'))body=[{id:1,label:'12:00 – 14:00',start:'12:00',end:'14:00',available:true}];
  else if(url.pathname.endsWith('/payment-methods'))body=[{method:'stripe',family:'stripe',label:'Online'}];
  return route.fulfill({json:body});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://webshop.tfbuddy.local/?shop=2');
 await page.locator('.ws-card .ws-add').first().click();
 await page.locator('.pdm-seg--portions').getByRole('radio',{name:/1\/4/}).click();
 for(let i=0;i<3;i++)await page.locator('.pdm-qty__btn').last().click();
 await page.locator('.pdm-cta').click();
 if(width<600)await page.locator('.ws-tabbar__btn--cart').click();
 const basket=width<600?page.locator('.ws-drawer .ws-basket'):page.locator('.ws-basket').first();
 await basket.getByText('Możesz dobrać gratis!',{exact:true}).waitFor();
 await basket.getByText('Zasady promocji',{exact:true}).click();
 assert.match(await basket.locator('.ws-cart-reward').innerText(),/Nagroda nie wlicza/);
 const choose=basket.getByRole('button',{name:'Wybierz gratis',exact:true});
 await choose.click();
 let modal=page.getByRole('dialog',{name:'Wybierz gratis',exact:true});
 await modal.waitFor();
 assert.equal(await modal.locator('.ws-cart-reward__options button').count(),5,'all five quarters are available');
 assert.equal(await modal.getByText('Bez dopłaty',{exact:true}).count(),1);
 assert.equal(await modal.getByText(/Dopłata do koszyka:/).count(),4);
 assert.match(await modal.innerText(),/najtańszy/);
 const bounds=await modal.boundingBox();assert.ok(bounds.width<=width&&bounds.x>=0,'modal fits the viewport');
 await page.keyboard.press('Shift+Tab');
 assert.equal(await modal.locator('.ws-cart-reward__options button').last().evaluate(el=>el===document.activeElement),true,'focus remains inside the modal');
 await page.keyboard.press('Tab');
 assert.equal(await modal.locator('header button').evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
 assert.equal(await choose.evaluate(el=>el===document.activeElement),true,'focus returns to the chooser');
 await choose.click();modal=page.getByRole('dialog',{name:'Wybierz gratis',exact:true});
 await modal.locator('header button').click();
 await choose.click();modal=page.getByRole('dialog',{name:'Wybierz gratis',exact:true});
 const alternative=modal.locator('.ws-cart-reward__options button').filter({hasText:'Quiche 1410001'});
 assert.match(await alternative.innerText(),/1[,.]00/);
 await alternative.click();
 await modal.waitFor({state:'hidden'});
 await basket.getByText('Gratis dodany',{exact:true}).waitFor();
 const added=quotes.find(q=>q.products.length===2&&Number(q.products[0].quantity)===4&&Number(q.products[1].quantity)===1&&q.products[1].id_product===1410001&&q.products[1].id_product_portion===14);
 assert.ok(added,'a different quarter was added; the four paid quarters were preserved');
 assert.equal(added.selected_automatic_promotion_id,undefined,'ordinary lines remain independently removable');
 await basket.locator('.ws-line__remove').first().click();
 await basket.getByText('Gratis dodany',{exact:true}).waitFor({state:'hidden'});
 assert.equal(await basket.locator('.ws-cart-reward').count(),0,'removing paid products revokes the reward status');
 assert.deepEqual(errors,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 await context.close();console.log('PASS cart reward eligibility, selection and revocation at width '+width);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
