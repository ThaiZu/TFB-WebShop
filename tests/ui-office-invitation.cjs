const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1']});
 try { for(const mode of ['login','register','existing-session','no-invite','invalid']) {
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  await context.addInitScript(mode=>{localStorage.setItem('ws.lang','pl');if(['existing-session','no-invite'].includes(mode)){localStorage.setItem('ws_auth_token','access');localStorage.setItem('ws_auth_refresh_token','refresh');}},mode);
  let accepted=0,registered=0;const errors=[];
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(!['webshop.tfbuddy.local','tfb.tfbuddy.local'].includes(u.hostname))return route.abort();
   if(!u.pathname.includes('/api/v1/'))return route.continue();
   let data={};
   if(mode==='invalid' && u.pathname.endsWith('/office-invites/resolve'))return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({description:'OFFICE_INVITE_INVALID'})});
   if(u.pathname.endsWith('/shops'))data=[{id:2,name:'Test shop',default_lang:'pl',languages:'pl,fr,nl',collect_enabled:1}];
   else if(u.pathname.endsWith('/office-invites/resolve'))data={shop_id:2,office:{id:14,name:'Invitation office'}};
   else if(u.pathname.endsWith('/office-invites/accept')){accepted++;assert.equal(req.headers().authorization,'Bearer access');data={shop_id:2,office:{id:14,name:'Invitation office'},joined:true};}
   else if(u.pathname.endsWith('/auth/register')){registered++;data={registered:true,activation_required:false,activation_email_sent:false};}
   else if(u.pathname.endsWith('/auth/login'))data={access_token:'access',refresh_token:'refresh'};
   else if(u.pathname.endsWith('/auth/me'))data={user:{id:500,name:'Test',firstName:'Test',email:'test@example.test'}};
   else if(u.pathname.includes('/offices'))data={offices:accepted?[{id:14,name:'Invitation office',offers:[]}]:[]};
   else if(u.pathname.endsWith('/products/available')||u.pathname.includes('postal'))data=[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://webshop.tfbuddy.local/?shop=2'+(mode==='no-invite'?'':'&office_invite='+'a'.repeat(43)));
  if(mode==='invalid'){
   await page.locator('.ws-office-modal [role=alert]').waitFor();assert.equal(accepted,0);assert.equal(await page.locator('.ws-office-confirm-actions .ws-cta').count(),0);
  }else if(mode==='no-invite'){
   await page.locator('.ws-nav').waitFor();assert.equal(await page.locator('#ws-invitation-title').count(),0);
  }else{
   await page.locator('#ws-invitation-title').waitFor();
   if(mode==='existing-session'){
    await page.locator('.ws-office-confirm-actions .ws-cta').click();
   }else if(mode==='register'){
    await page.getByRole('button',{name:'Załóż konto i powiąż',exact:true}).click();
    for(const [autocomplete,value] of [['given-name','Test'],['family-name','User'],['email','test@example.test'],['new-password','test-password'],['tel-national','470000002'],['postal-code','1000']])await page.locator(`input[autocomplete="${autocomplete}"]`).fill(value);
   }else{
    await page.locator('.ws-office-confirm-actions .ws-cta').click();
    await page.locator('input[autocomplete="username"]').fill('test@example.test');
    await page.locator('input[autocomplete="current-password"]').fill('test-password');
   }
   if(mode!=='existing-session')await page.locator('.ws-form button[type="submit"]').click();
   await page.locator('.ws-toast__sub').filter({hasText:'Invitation office'}).waitFor();
   assert.equal(accepted,1);assert.equal(registered,mode==='register'?1:0);
   assert.equal(new URL(page.url()).searchParams.has('office_invite'),false);
   if(mode==='register')await page.locator('.ws-acc__section').first().waitFor();
  }
  assert.deepEqual(errors,[]);console.log('PASS invitation flow:',mode);await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
