// Built WebShop and image loading; all HTTP is intercepted, no live shop or API.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.SHOP_PHOTO_BUILD||path.resolve(__dirname,'../dist');
const shops=[
 {id:1,name:'By Berlo',city:'Corbais',street:'Grand Route',street_num:'20',zip:'1435',collect_enabled:1,default_lang:'fr',languages:'fr,pl,nl',webshop_image:{url:'https://images.example/shop.webp'}},
 {id:2,name:'By Max & Sandra',city:'Gosselies',collect_enabled:1,default_lang:'fr',languages:'fr,pl,nl',webshop_image:null},
 {id:3,name:'By Halle',city:'Halle',collect_enabled:1,default_lang:'fr',languages:'fr,pl,nl',webshop_image:{url:'https://images.example/missing.webp'}}
];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});
  const errors=[];let photos=0;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='images.example'){
    if(url.pathname.includes('missing'))return route.fulfill({status:404,body:''});
    photos++;return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#fcf6ef"/><g fill="none" stroke="#8d1d2c" stroke-width="4"><path d="M100 800V350L800 100l700 250v450zM100 350h1400M250 800V480h350v320M850 800V480h400v320M100 350l700-250 700 250"/><path d="M220 430h1080"/></g><text x="800" y="310" text-anchor="middle" fill="#8d1d2c" font-size="62">L’ATELIER BY BERLO</text></svg>'});
   }
   if(url.hostname==='webshop.test'&&!url.pathname.startsWith('/api/v1/'))return serveBuild(route,build);
   if(!['webshop.test','api.example.invalid'].includes(url.hostname))return route.abort();
   let data=[];
   if(url.pathname.endsWith('/shops'))data=shops;
   else if(url.pathname.endsWith('/privacy-config'))data={schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'ready',policies:{},integrations:{}};
   else if(url.pathname.endsWith('/locale'))data={language:'fr'};
   else if(url.pathname.endsWith('/config'))data={fidelityTabEnabled:false};
   else if(url.pathname.endsWith('/clients/auth/refresh')||url.pathname.endsWith('/clients/auth/me'))return route.fulfill({status:401,json:{}});
   return route.fulfill({json:data});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://webshop.test/');
  const cards=page.locator('.ws-shopselect__card');await cards.first().waitFor();assert.equal(await cards.count(),3);
  if(await page.locator('.ws-cookie-panel').count())await page.locator('.ws-cookie-actions button').last().click();
  async function frames(list){
   for(let i=0;i<3;i++){
    const card=list.nth(i);await card.scrollIntoViewIfNeeded();
    if(i===0)await card.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0?true:new Promise(resolve=>img.addEventListener('load',resolve,{once:true})));
    else await card.locator('.ws-shop-photo__placeholder').waitFor();
    const box=await card.locator('.ws-shop-photo').boundingBox();assert.ok(Math.abs(box.width/box.height-1.6)<.03,'Stable landscape frame');
    assert.ok(box.x>=-1&&box.x+box.width<=width+1,'Photo fits the viewport');
   }
   assert.equal(await list.locator('.ws-shop-photo img').count(),1,'Missing and broken photos use placeholders');
   assert.equal(await list.first().locator('img').evaluate(img=>getComputedStyle(img).objectFit),'cover');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
  }
  await frames(cards);await cards.first().scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/shop-photo-first-${width}.png`,fullPage:true});
  await cards.first().click();await page.locator('.ws-shopselect').waitFor({state:'detached'});
  await page.locator('.ws-nav__shopchip:visible,.ws-nav__shopplate:visible,.ws-shopbar__switch:visible').first().click();
  const switcher=page.locator('.ws-modal--switcher');await switcher.waitFor();const choices=switcher.locator('.ws-shopcard');
  await frames(choices);await choices.first().scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/shop-photo-switch-${width}.png`,fullPage:true});
  await choices.nth(1).click();await switcher.waitFor({state:'detached'});
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('shop')==='2');
  assert.ok(photos>=1);assert.deepEqual(errors,[]);await context.close();console.log(`PASS: both shop pickers, photos, fallback, selection without photo, image proportions and overflow at ${width}px`);
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
