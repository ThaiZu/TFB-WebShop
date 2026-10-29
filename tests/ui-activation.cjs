const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try {
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  let emailSent=true,registerFails=false,confirmationCount=0,resends=0,loginFails=false,logins=0;const pageErrors=[];
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(u.hostname))return route.abort();
   if(!u.pathname.includes('/api/v1/'))return route.continue();
   let body=[],status=200;
   if(u.pathname.endsWith('/shops'))body=[{id:2,name:'Test shop',default_lang:'pl'}];
   else if(u.pathname.endsWith('/config')||u.pathname.endsWith('/brand'))body={};
   else if(u.pathname.endsWith('/register')) {
    status=registerFails?409:201;body=registerFails?{description:'An account or a previous webshop order already uses this email or phone. Use password reset to access it.'}:{ok:true,activation_required:true,activation_email_sent:emailSent};
   } else if(u.pathname.endsWith('/login')) {
    logins++; assert.equal(req.postDataJSON().login,'client@example.invalid');
    assert.equal(req.postDataJSON().password,'test-password');
    status=loginFails?503:200;body=loginFails?{description:'CLIENT_ACTIVATION_UNAVAILABLE'}:{access_token:'test-access',refresh_token:'test-refresh'};
   } else if(u.pathname.endsWith('/me')) {
    body={user:{id:7,email:'client@example.invalid',firstName:'Test',lastName:'Client',postalCode:'00-001',needsPostcode:false,activationRequired:true}};
   } else if(u.pathname.endsWith('/activation/confirm')) {
    assert.equal(req.method(),'POST');assert.equal(req.postDataJSON().token,'a'.repeat(64));
    confirmationCount++;status=confirmationCount===1?200:400;body=status===200?{ok:true}:{description:'CLIENT_ACTIVATION_INVALID'};
   } else if(u.pathname.endsWith('/activation/resend')) {resends++;status=202;body={ok:true};}
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
  async function register() {
   if(page.url().startsWith('https://webshop.tfbuddy.local')) await page.evaluate(()=>{window.WSSessionStorage.removeItem('ws_auth_token');window.WSSessionStorage.removeItem('ws_auth_refresh_token');});
   await page.goto('https://webshop.tfbuddy.local/?shop=2');await page.waitForSelector('.ws-langchip__btn');
   await page.evaluate(()=>window.WSI18n.setLang('pl'));
   await page.getByRole('button',{name:'Konto',exact:true}).first().click();
   await page.locator('.ws-tab').filter({hasText:'Utwórz konto'}).click();
   await page.locator('input[autocomplete="given-name"]').fill('Test');await page.locator('input[autocomplete="family-name"]').fill('Client');
   await page.locator('input[autocomplete="email"]').fill('client@example.invalid');
   await page.locator('input[autocomplete="new-password"]').fill('test-password');
   await page.locator('input[autocomplete="tel-national"]').fill('+48 501234567');
   await page.locator('input[autocomplete="postal-code"]').fill('00-001');
   await page.locator('.ws-form').evaluate(el=>el.requestSubmit());
  }
  await register();
  await page.getByText('Konto zostało utworzone',{exact:true}).waitFor();
  assert.ok((await page.locator('.ws-modal__lede').textContent()).includes('client@example.invalid'));
  assert.equal(await page.evaluate(()=>window.WSSessionStorage?.getItem('ws_auth_token')),null);
  assert.equal(await page.locator('input[type="email"]').count(),0);
  assert.equal(await page.getByRole('button',{name:'Prześlij ponownie link aktywacyjny',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Wróć do logowania',exact:true}).count(),0);
  await page.getByText('Twoje konto nie jest aktywowane. Niektóre funkcje mogą być ograniczone.',{exact:true}).waitFor();
  loginFails=true;
  await page.getByRole('button',{name:'Przejdź do konta',exact:true}).click();
  await page.locator('.ws-form__err').waitFor();
  await page.getByText('Konto zostało utworzone',{exact:true}).waitFor();
  loginFails=false;
  await page.getByRole('button',{name:'Przejdź do konta',exact:true}).click();
  await page.getByRole('button',{name:'Wyloguj się',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.WSSessionStorage?.getItem('ws_auth_token')),'test-access');
  assert.equal(logins,2);assert.equal(resends,0);
  await page.getByRole('button',{name:'Prześlij ponownie link aktywacyjny',exact:true}).click();
  await page.getByText(/Jeśli konto oczekuje na aktywację/).waitFor();assert.equal(resends,1);
  emailSent=false;await register();await page.getByText(/Konto powstało, ale nie udało się wysłać/).waitFor();
  await page.getByRole('button',{name:'Przejdź do konta',exact:true}).click();
  await page.getByRole('button',{name:'Wyloguj się',exact:true}).waitFor();
  registerFails=true;await register();await page.locator('.ws-form__err').waitFor();
  assert.equal(await page.getByText('Konto zostało utworzone',{exact:true}).count(),0);
  await page.goto('https://webshop.tfbuddy.local/activate-account.html?lang=pl#token='+'a'.repeat(64));
  await page.waitForFunction(()=>!document.querySelector('#confirmActivation')?.disabled);
  assert.equal(confirmationCount,0,'GET/email scanner must not activate an account');
  assert.equal(new URL(page.url()).hash,'');
  await page.locator('body > select').selectOption('nl');
  await page.locator('#confirmActivation').click();
  await page.getByText('Uw account is actief. U kunt nu inloggen in de webshop.',{exact:true}).waitFor();
  assert.equal(confirmationCount,1);assert.equal(await page.locator('#confirmActivation').isDisabled(),true);
  await page.goto('https://webshop.tfbuddy.local/activate-account.html#token='+'a'.repeat(64));
  await page.locator('#confirmActivation').click();await page.getByText(/Deze link is ongeldig/).waitFor();
  assert.deepEqual(pageErrors,[]);
  console.log('PASS: registration success, removed resend form, automatic login/account opening, login retry, mail failure, duplicate failure, resend from settings; explicit activation, language switch preserves token, used-token error. All API calls stubbed.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
