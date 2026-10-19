/* Local browser flow; every API request is stubbed, no mail or DB writes. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try {
  const context = await browser.newContext({ignoreHTTPSErrors:true});
  let active=false, fail=false, resends=0, logouts=0;
  const errors=[];
  await context.route('**/*', async route => {
   const req=route.request(), url=new URL(req.url());
   if (!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(url.hostname)) return route.abort();
   if (!url.pathname.includes('/api/v1/')) return route.continue();
   let body=[], status=200;
   if(url.pathname.endsWith('/shops')) body=[{id:2,name:'Test shop',default_lang:'pl'}];
   else if(url.pathname.endsWith('/config')||url.pathname.endsWith('/brand')) body={};
   else if(url.pathname.endsWith('/login')) body={access_token:'test-access',refresh_token:'test-refresh'};
   else if(url.pathname.endsWith('/logout')) {
    assert.equal(req.postDataJSON().refresh_token,'test-refresh'); logouts++; body={ok:true};
   }
   else if(url.pathname.endsWith('/me')) body={user:{id:7,email:'client@example.invalid',firstName:'Test',lastName:'Client',postalCode:'00-001',needsPostcode:false,activationRequired:!active}};
   else if(url.pathname.endsWith('/activation/resend')) {
    assert.equal(req.postDataJSON().email,'client@example.invalid');resends++;
    status=fail?503:202;body=fail?{description:'CLIENT_ACTIVATION_MAIL_FAILED'}:{ok:true};
   }
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://webshop.tfbuddy.local/?shop=2');
  await page.waitForSelector('.ws-langchip__btn');
  assert.equal(await page.locator('.ws-activation-banner').count(),0);
  await page.evaluate(()=>window.WSI18n.setLang('pl'));
  await page.getByRole('button',{name:'Konto',exact:true}).first().click();
  await page.locator('input[autocomplete="username"]').fill('client@example.invalid');
  await page.locator('input[autocomplete="current-password"]').fill('test-password');
  await page.locator('.ws-form').evaluate(el=>el.requestSubmit());
  await page.locator('.ws-activation-banner').waitFor();
  for (const lang of ['fr','nl','pl']) {
   await page.evaluate(l=>window.WSI18n.setLang(l),lang);
   const expected=await page.evaluate(()=>window.WSI18n.t('activation.accountWarning'));
   assert.ok((await page.locator('.ws-activation-banner').textContent()).includes(expected));
  }
  await page.locator('.ws-activation-banner button').click();
  await page.getByRole('button',{name:'Prześlij ponownie link aktywacyjny',exact:true}).click();
  await page.getByText(/Jeśli konto oczekuje na aktywację/).waitFor();
  assert.equal(resends,1);
  fail=true;
  await page.getByRole('button',{name:'Prześlij ponownie link aktywacyjny',exact:true}).click();
  await page.locator('.ws-acc__section [role="alert"]').waitFor();
  await page.locator('.ws-modal__close').click();
  await page.reload();await page.locator('.ws-activation-banner').waitFor();
  active=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.locator('.ws-activation-banner').waitFor({state:'detached'});
  await page.getByRole('button',{name:'Konto',exact:true}).first().click();
  assert.equal(await page.getByRole('button',{name:'Prześlij ponownie link aktywacyjny',exact:true}).count(),0);
  await page.getByRole('button',{name:'Wyloguj się',exact:true}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('ws_auth_token')),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ws_auth_refresh_token')),null);
  await page.reload();await page.waitForSelector('.ws-langchip__btn');
  await page.getByRole('button',{name:'Konto',exact:true}).first().click();
  await page.locator('input[autocomplete="username"]').waitFor();
  assert.equal(logouts,1);
  assert.deepEqual(errors,[]);
  console.log('PASS: pending login, FR/NL/PL banner, resend to profile email, delivery error, restored session activated state refresh, logout and reload without a session. API stubbed.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
