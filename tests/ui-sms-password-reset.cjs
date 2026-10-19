/* Browser flow: all API requests are intercepted, no SMS or database writes. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try {
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:360,height:780}});
  const errors=[]; let sends=0, confirms=0;
  await context.addInitScript(()=>localStorage.setItem('ws.lang','pl'));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname)) return route.abort();
   if(!url.pathname.includes('/api/v1/')) return route.continue();
   let body=[], status=200;
   if(url.pathname.endsWith('/shops')) body=[{id:2,name:'Test shop',default_lang:'pl'}];
   else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand')) body={};
   else if(url.pathname.endsWith('/password/reset/sms/request')) {
    sends++; assert.equal(req.postDataJSON().phone,'+32470123456');
    body={request_token:'a'.repeat(64),expires_in:180,retry_after:60};status=202;
   } else if(url.pathname.endsWith('/password/reset/sms/confirm')) {
    confirms++; const data=req.postDataJSON(); assert.equal(data.request_token,'a'.repeat(64));
    assert.equal(data.new_password_confirm,'abcd');
    status=data.code==='123456'?200:400;body=status===200?{ok:true}:{description:'SMS_RESET_INVALID'};
   }
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://webshop.tfbuddy.local/?shop=2');
  await page.waitForSelector('.ws-langchip__btn');
  await page.evaluate(()=>window.WSI18n.setLang('pl'));
  await page.getByRole('button',{name:'Zaloguj się',exact:true}).first().click();
  await page.getByRole('button',{name:'Nie pamiętasz hasła?',exact:true}).click();
  await page.getByRole('button',{name:'SMS',exact:true}).click();
  await page.locator('input[autocomplete="tel-national"]').fill('0470 123456');
  await page.getByRole('button',{name:'Wyślij kod SMS',exact:true}).click();
  await page.locator('input[autocomplete="one-time-code"]').waitFor();
  assert.equal(await page.getByRole('button',{name:'Wyślij kod ponownie',exact:true}).isDisabled(),true);
  await page.locator('input[autocomplete="one-time-code"]').fill('000000');
  const passwords=page.locator('input[autocomplete="new-password"]');
  await passwords.nth(0).fill('abcd');await passwords.nth(1).fill('xxxx');
  await page.getByRole('button',{name:'Zapisz nowe hasło',exact:true}).click();
  assert.equal(confirms,0);
  await passwords.nth(1).fill('abcd');
  await page.getByRole('button',{name:'Zapisz nowe hasło',exact:true}).click();
  await page.getByText(/Kod jest nieprawidłowy/).waitFor();
  await page.locator('input[autocomplete="one-time-code"]').fill('123456');
  await page.getByRole('button',{name:'Zapisz nowe hasło',exact:true}).click();
  await page.getByText(/Hasło zostało zmienione/).waitFor();
  assert.equal(sends,1);assert.equal(confirms,2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:/logowania/i}).click();
  await page.locator('input[autocomplete="username"]').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: SMS UI, validation, retry cooldown, success, mobile layout, no console errors');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
