/* Run with Playwright available on NODE_PATH. Uses local UI and stub API only. */
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try {
 const dictionaries=Object.fromEntries(['fr','nl','pl'].map(l=>[l,JSON.parse(fs.readFileSync(path.join(__dirname,'../public/locales/'+l+'.json')))]));
 const context=await browser.newContext({ignoreHTTPSErrors:true});let mutations=0;const errors=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname))return route.abort();
  if(!url.pathname.includes('/api/v1/'))return route.continue();
  if(route.request().method()!=='GET')mutations++;
  let body=[];
  if(url.pathname.endsWith('/shops'))body=[{id:2,name:'Test shop',default_lang:'fr',languages:'fr,nl',collect_enabled:1}];
  else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand'))body={};
  else if(url.pathname.endsWith('/login'))return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({description:'Invalid credentials'})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://webshop.tfbuddy.local/?shop=2');
 await page.waitForSelector('.ws-langchip__btn');
 for(const lang of ['pl','nl','fr']) {
  await page.evaluate(async lang=>{await window.WSI18n.setLang(lang)},lang);
  const d=dictionaries[lang];
  await page.getByRole('button',{name:d['nav.account'],exact:true}).first().click();
  await page.locator('.ws-tab').filter({hasText:d['auth.createAccount']}).click();
  await page.locator('.ws-form').evaluate(el=>el.requestSubmit());
  await page.waitForFunction(text=>document.querySelector('.ws-form__err')?.textContent===text,d['error.nameRequired']);
  assert.ok((await page.locator('.ws-modal__panel').textContent()).includes(d['ui.postal']), await page.locator('.ws-modal__panel').textContent());
  assert.ok((await page.locator('.ws-phone__pfx').innerText()).includes(new Intl.DisplayNames([lang],{type:'region'}).of('PL')));
  await page.locator('.ws-tab').filter({hasText:d['auth.login']}).click();
  await page.locator('.ws-linkbtn').filter({hasText:d['ui.forgotLink']}).click();
  assert.ok((await page.locator('.ws-modal__panel').textContent()).includes(d['ui.resetHint']));
  await page.locator('.ws-linkbtn').filter({hasText:d['ui.backLogin']}).click();
  await page.locator('.ws-modal__close').click();
 }
 await page.evaluate(()=>window.WSI18n.setLang('fr'));
 await page.getByRole('button',{name:dictionaries.fr['nav.account'],exact:true}).first().click();
 await page.locator('input[autocomplete="username"]').fill('test@example.invalid');
 await page.locator('input[autocomplete="current-password"]').fill('wrong-password');
 await page.locator('.ws-form').evaluate(el=>el.requestSubmit());
 await page.waitForFunction(text=>document.querySelector('.ws-form__err')?.textContent===text,dictionaries.fr['error.credentials']);
 await page.evaluate(()=>window.WSI18n.setLang('pl'));
 assert.equal(await page.locator('.ws-form__err').innerText(),dictionaries.pl['error.credentials']);
 for(const route of ['reset-password.html?token=local-test-token','inscription.html']) {
  await page.goto('https://webshop.tfbuddy.local/'+route);
  await page.waitForSelector('body > select');
  if(route.startsWith('reset')) await page.locator('#mdp').fill('typed-password');
  for(const lang of ['nl','fr','pl']) {
   await page.locator('body > select').selectOption(lang);
   await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);
   assert.equal(await page.locator('#titre').innerText(),dictionaries[lang][route.startsWith('reset')?'page.resetTitle':'page.inviteTitle']);
   if(route.startsWith('reset')) {
    assert.equal(await page.locator('#mdp').inputValue(),'typed-password');
    assert.equal(await page.locator('#form').isVisible(),true);
   }
  }
 }
 assert.equal(mutations,1,'Only the stubbed login should be submitted');
 assert.deepEqual(errors,[]);
 console.log('PASS: FR/NL/PL registration, validation, phone countries, password recovery, live API-error translation, standalone pages, reset token and input preserved. No real API writes.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
