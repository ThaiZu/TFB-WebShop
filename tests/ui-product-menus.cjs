/* Real storefront UI, controlled API. Does not create orders or payments. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});try{
for(const width of [1440,390]){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
 await context.addInitScript(()=>localStorage.setItem('ws.lang','pl'));
 const errors=[],quotes=[];await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname))return route.abort();
  if(!url.pathname.includes('/api/v1/'))return route.continue();let body=[];
  if(url.pathname.endsWith('/shops'))body=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1,delivery_enabled:1}];
  else if(url.pathname.endsWith('/products/available'))body=[{id:10,name:'Menu food',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,office_delivery:1,is_divisible:0,is_piece_based:1,has_menu_options:true,category:{id:3,name:'Food',groups:[]},webshop:{price_gross:'8.00',allergen_codes:[]},portions:[{id:60,portion_type:'ONE_HALF',is_active:1,is_ready_for_sale:1,shop_price_gross:'4.00'}],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false,quantity_available:null}}];
  else if(url.pathname.endsWith('/products/10/menus'))body=[{id:2,base_portion_id:60,menu_id:1,version:3,menu_name:'Lunch',name:'Food and drink',base_total:9,price_modifier:1,slots:[{id:3,label:'Drink',required:true,kind:'single',min_select:1,max_select:1,choices:[{id:4,product_id:20,label:'Cola',delta:0,img:null}]}]}];
  else if(url.pathname.endsWith('/cart/quote')){const p=req.postDataJSON();quotes.push(p);body={items:p.products.map(l=>({...l,unit_gross_price:'9.00',total_gross_value_after_discount:'9.00'})),totals:{gross_before_discount:'9.00',gross_after_discount:'9.00',discount:'0.00'},applied_promotions:[],promotion_suggestions:[]};}
  else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand'))body={};
  else if(url.pathname.endsWith('/availability/slots'))body=[{id:1,label:'12:00 – 14:00',start:'12:00',end:'14:00',available:true}];
  else if(url.pathname.endsWith('/payment-methods'))body=[{method:'stripe',family:'stripe',label:'Online'}];
  return route.fulfill({json:body});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://webshop.tfbuddy.local/?shop=2');
 await page.locator('.ws-card .ws-add').first().click();await page.getByRole('radio',{name:/1\/2/}).last().click();const menu=page.locator('.pdm-bcard').filter({hasText:'Food and drink'});await menu.click();
 await page.waitForTimeout(400);assert.equal(await page.locator('.pdm-cta').isDisabled(),true);
 await menu.getByRole('button',{name:'Cola',exact:true}).click();assert.equal(await page.locator('.pdm-cta').isEnabled(),true);
 assert.match(await page.locator('.pdm-cta').innerText(),/9[,.]00/);await page.locator('.pdm-cta').click();
 await page.waitForTimeout(700);const selected=quotes.find(q=>q.products.some(p=>p.menu_selection));assert.ok(selected,'menu selection reached cart quote');assert.equal(selected.products[0].id_product_portion,60,'base portion must survive selection and quote');assert.deepEqual(selected.products[0].menu_selection.steps,[{step_id:3,choice_ids:[4]}]);
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 await context.close();console.log('PASS menu selection and quote at width '+width);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
