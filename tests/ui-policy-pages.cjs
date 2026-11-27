/* Local preview build and API fixtures only. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const serveBuild=require('./helpers/static-build.cjs');
const build=process.env.POLICY_BUILD||path.resolve(__dirname,'../dist');
const preview=process.env.POLICY_PREVIEW==='1';
const prefix=process.env.POLICY_BASE||'/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='webshop.test')return serveBuild(route,build);
   if(url.hostname!=='api.tfbuddy.local')throw Error('Unexpected external '+url);
   const json=url.pathname.endsWith('/privacy-config')?{schemaVersion:1,scope:'atelierby',policyVersion:'test',consentMode:'basic',choiceLifetimeMonths:6,status:'draft',policies:{},integrations:{}}:url.pathname.endsWith('/locale')?{language:'pl'}:[];
   return route.fulfill({json});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://webshop.test'+prefix);
  const panel=page.locator('.ws-cookie-panel');await panel.waitFor();
  if(process.env.POLICY_SCREENSHOT_DIR){require('node:fs').mkdirSync(process.env.POLICY_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.POLICY_SCREENSHOT_DIR,'privacy-release-'+width+'.png')});}
  assert.equal(await panel.getByText('Podgląd roboczych dokumentów — treści niezatwierdzone.').count(),preview?1:0);
  assert.equal(await panel.getByRole('button',{name:'Akceptuj wszystkie',exact:true}).count(),0);
  await panel.getByRole('button',{name:'Rozumiem',exact:true}).waitFor();
  // The withdrawal sentence is part of the details, opened with « Ustawienia ».
  await panel.getByRole('button',{name:'Ustawienia',exact:true}).click();
  assert.equal(await panel.getByText(/Zgodę możesz w każdej chwili/).count(),1);
  const link=panel.getByRole('link',{name:'Polityka prywatności — otwiera nową kartę'});
  const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState();
  assert.equal(await popup.evaluate(()=>window.opener),null);assert.equal(await page.locator('.ws-cookie-panel').count(),1);await popup.close();
  for(const lang of ['pl','fr','nl'])for(const kind of ['privacy','cookies']){
   const doc=await context.newPage();await doc.goto('https://webshop.test'+prefix+`${preview?'privacy-preview':'privacy'}/${lang}/${kind}.html`);
   assert.equal(await doc.locator('html').getAttribute('lang'),lang);assert.equal(await doc.locator('h1').count(),1);assert.equal(await doc.locator('.draft').count(),preview?1:0);
   if(preview)assert.equal(await doc.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
   assert.equal(await doc.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await doc.locator('script').count(),0);if(kind==='cookies')assert.ok(await doc.locator('table').count()>0);
   if(kind==='cookies')assert.ok((await doc.locator('body').innerText()).includes('ws.session.v1:'));
   await doc.locator('nav a').nth(1).click();assert.ok(doc.url().endsWith((kind==='privacy'?'cookies':'privacy')+'.html'));
   await doc.close();
  }
  await page.getByRole('button',{name:'Rozumiem',exact:true}).click();
  assert.equal(await page.locator('.ws-policy-footer a').count(),2);
  const standalone=await context.newPage();
  await standalone.goto('https://webshop.test'+prefix+'inscription.html');
  await standalone.locator('[data-ws-policy-links] a').first().waitFor();
  const accountLink=standalone.locator('[data-ws-policy-links] a').first();
  assert.ok((await accountLink.getAttribute('href')).includes('/'+(preview?'privacy-preview':'privacy')+'/'));
  const accountPopupPromise=standalone.waitForEvent('popup');
  await accountLink.click();const accountPopup=await accountPopupPromise;await accountPopup.waitForLoadState();
  assert.equal(await accountPopup.locator('h1').count(),1);
  await accountPopup.close();
  await standalone.selectOption('body > select','nl');
  await standalone.waitForFunction(()=>document.querySelector('[data-ws-policy-links] a')?.href.includes('/nl/privacy.html'));
  await standalone.close();
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS policy previews ${width}px: six pages, translations, tables, no overflow, safe new tab and banner withdrawal notice`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
