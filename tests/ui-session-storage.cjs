const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const assert=require('node:assert/strict');
(async()=>{
 const port=await new Promise(resolve=>{const probe=net.createServer();probe.listen(0,'127.0.0.1',()=>{const port=probe.address().port;probe.close(()=>resolve(port));});});
 const base='http://localhost:'+port;
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ws-session-test-'));
 const server=spawn('php',['-S','localhost:'+port,__dirname+'/fixtures/persistent-session-api.php'],{env:{...process.env,TFB_BROWSER_SESSION_FIXTURE_FILE:path.join(temp,'sessions.json')},stdio:['ignore','pipe','pipe']});
 let log='';server.stderr.on('data',d=>log+=d);
 let browser;
 try {
  for(let i=0;i<100;i++){try{await fetch(base+'/');break;}catch{await new Promise(r=>setTimeout(r,30));}}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();
  const page=await context.newPage();await page.goto(base+'/');
  const result=await page.evaluate(()=>WSAuth.login({email:'a@example.test',password:'test'}));
  assert.equal(result.ok,true,JSON.stringify(result));
  const cookies=await context.cookies();const cookie=cookies.find(c=>c.name==='__Secure-ws_refresh');
  assert.ok(cookie);assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'Lax');
  assert.ok(Math.abs(cookie.expires-Date.now()/1000-5184000)<5);
  assert.equal(await page.evaluate(()=>document.cookie.includes('__Secure-ws_refresh')),false);
  assert.deepEqual(await page.evaluate(()=>[...Object.keys(localStorage),...Object.keys(sessionStorage)].filter(k=>/auth_token|refresh_token|ws.customer/.test(k))),[]);
  await page.evaluate(()=>WSShopRouter.setActive('4'));await page.close();
  const reopened=await context.newPage();await reopened.goto(base+'/');
  assert.deepEqual(await reopened.evaluate(async()=>[(await WSAuth.me())?.id,WSShopRouter.current()]),[1,'4']);
  const next=await context.newPage();await next.goto(base+'/');
  const identities=await Promise.all([reopened.evaluate(()=>WSAuth.refresh()),next.evaluate(async()=>(await WSAuth.me())?.id)]);
  assert.deepEqual(identities,[true,1]);
  const csrf=await context.request.post(base+'/api/v1/clients/auth/refresh',{headers:{Origin:'https://evil.example','X-Webshop-Session':'cookie'},data:{}});
  assert.equal(csrf.status(),403);assert.ok((await context.cookies()).some(c=>c.name==='__Secure-ws_refresh'));
  const legacy=await context.request.post(base+'/api/v1/clients/auth/login',{data:{login:'b@example.test',password:'test'}});
  assert.ok((await legacy.json()).refresh_token); // Original pair contract remains available to non-browser clients.
  // Re-establish the browser fixture because its single-session stub was replaced by the legacy request.
  assert.equal((await reopened.evaluate(()=>WSAuth.login({email:'a@example.test',password:'test'}))).ok,true);
  await next.waitForFunction(()=>!WSAuth.authHeaders().Authorization);
  await reopened.evaluate(()=>WSAuth.logout());
  await next.waitForFunction(()=>!WSAuth.authHeaders().Authorization);
  assert.equal((await context.cookies()).some(c=>c.name==='__Secure-ws_refresh'),false);
  await reopened.close();const afterLogout=await context.newPage();await afterLogout.goto(base+'/');
  assert.deepEqual(await afterLogout.evaluate(async()=>[await WSAuth.me(),WSShopRouter.current()]),[null,'4']);
  console.log('PASS: real PHP controller/Set-Cookie; 60 days; HttpOnly/Secure/Lax; close/reopen; remembered shop; concurrent tabs; CSRF; legacy contract; logout across tabs and reopen.');
 }catch(e){console.error(log);throw e;}finally{await browser?.close();server.kill();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
