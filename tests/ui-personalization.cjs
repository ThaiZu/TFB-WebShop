/* Static build + intercepted API only. No application database writes. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const build=process.env.PERSONALIZATION_BUILD||'/tmp/tfbuddy-personalization-build';
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
for(const width of [1440,390]){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
 await context.addInitScript(()=>sessionStorage.setItem('ws.session.v1:' + 'ws.lang', ((createdAt)=>JSON.stringify({value:'pl', createdAt, expiresAt:createdAt+43200000}))(Date.now())));
 const errors=[],quotes=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(!url.pathname.includes('/api/v1/')) {
   const relative=url.pathname.replace(/^\/WebShop\/?/,'').replace(/^\//,'');
   const file=path.resolve(build,relative||'index.html');
   if(!file.startsWith(build+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
   const ext=path.extname(file);return route.fulfill({path:file,contentType:({'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[ext]});
  }
  let body=[];
  if(url.pathname.endsWith('/shops'))body=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1,delivery_enabled:1}];
  else if(url.pathname.endsWith('/products/available'))body=[{id:10,name:'Sandwich test',id_category:3,is_active:1,webshop_active:1,click_and_collect:1,office_delivery:1,is_divisible:0,is_piece_based:1,has_personalization:true,category:{id:3,name:'Food',groups:[]},webshop:{price_gross:'5.00',allergen_codes:[]},portions:[],availability_periods:[],webshop_availability:{status:'not_enforced',inventory_enforced:false,quantity_available:null}}];
  else if(url.pathname.endsWith('/personalization'))body={version:3,groups:[{id:1,name:'Dodatki',min_select:1,max_select:1,required:true,options:[{id:11,name:'Bekon',operation:'ADD',price_delta:'1.50'},{id:12,name:'Ser',operation:'ADD',price_delta:'1.00'}]}]};
  else if(url.pathname.endsWith('/cart/quote')){const p=req.postDataJSON();quotes.push(p);body={items:p.products.map(l=>({...l,unit_gross_price:l.personalization_selection?'6.50':'5.00',total_gross_value_after_discount:l.personalization_selection?'6.50':'5.00'})),totals:{gross_before_discount:'6.50',gross_after_discount:'6.50',discount:'0.00'},applied_promotions:[],promotion_suggestions:[]};}
  else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand'))body={};
  else if(url.pathname.endsWith('/availability/slots'))body=[{id:1,label:'12:00 – 14:00',start:'12:00',end:'14:00',available:true}];
  return route.fulfill({json:body});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://webshop.tfbuddy.local/?shop=2');
 await page.locator('.ws-card .ws-add').first().click();
 await page.locator('.pdm-personalization').waitFor({state:'visible'});
 assert.equal(await page.locator('.pdm-cta').isDisabled(),true);
 await page.getByLabel('Bekon',{exact:false}).check();
 assert.equal(await page.locator('.pdm-cta').isEnabled(),true);
 assert.equal(await page.getByLabel('Ser',{exact:false}).isDisabled(),true);
 assert.match(await page.locator('.pdm-cta').innerText(),/6[,.]50/);
 await page.locator('.pdm-cta').click();
 await page.waitForTimeout(500);
 const selected=quotes.find(q=>q.products.some(p=>p.personalization_selection));
 assert.ok(selected,'selection reached quote');assert.deepEqual(selected.products[0].personalization_selection,{version:3,option_ids:[11]});
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await context.close();console.log('PASS personalization selection + quote, width '+width);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
