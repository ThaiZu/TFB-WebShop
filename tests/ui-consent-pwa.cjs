/* Real service worker + localhost fixture only. No production or third-party requests. */
const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const build = process.env.PWA_BUILD || path.resolve(__dirname,'../work/consent-pwa-build');
let current = false, releaseWorker = false;
const oldWorker = `self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(caches.open('ws-html').then(c=>c.match(e.request)).then(r=>r||fetch(e.request)));});`;
const config = {schemaVersion:1,scope:'atelierby',policyVersion:'atelierby-2026-01',consentMode:'basic',choiceLifetimeMonths:6,status:'draft',policies:{},integrations:{}};
const server = http.createServer((req,res) => {
 const url = new URL(req.url,'http://localhost');
 res.setHeader('Cache-Control','no-store');
 if(!releaseWorker && url.pathname === '/sw.js'){res.setHeader('Content-Type','application/javascript');return res.end(oldWorker);}
 if(!current && url.pathname === '/'){res.setHeader('Content-Type','text/html');return res.end('<html><body>legacy-webshop</body></html>');}
 if(url.pathname.startsWith('/api/v1/')) {
  res.setHeader('Content-Type','application/json');
  return res.end(JSON.stringify(url.pathname.endsWith('/privacy-config')?config:url.pathname.endsWith('/locale')?{language:'pl'}:url.pathname.endsWith('/synthetic')?{private:'fixture'}:[]));
 }
 const file=path.resolve(build,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(path.resolve(build)+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({serviceWorkers:'allow'}),external=[];
 context.on('request',req=>{if(!req.url().startsWith(origin+'/'))external.push(req.url());});
 await context.addInitScript(()=>sessionStorage.setItem('ws.session.v1:' + 'ws.lang', ((createdAt)=>JSON.stringify({value:'pl', createdAt, expiresAt:createdAt+43200000}))(Date.now())));
 const page=await context.newPage();await page.goto(origin+'/');
 await page.evaluate(async()=>{
  await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
  const old=await caches.open('ws-html');await old.put('/',new Response('<html><body>legacy-webshop cached shell</body></html>',{headers:{'Content-Type':'text/html'}}));await old.put('/?audit_token=old',new Response('legacy'));
  const other=await caches.open('unrelated-app');await other.put('/unrelated',new Response('keep'));
 });
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 current=true;
 await page.reload();assert.match(await page.locator('body').innerText(),/legacy-webshop cached shell/);
 releaseWorker=true;
 await page.evaluate(async()=>{
  const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
  await (await navigator.serviceWorker.getRegistration()).update();await changed;
 });
 await page.waitForFunction(async()=>!(await caches.keys()).includes('ws-html'));
 assert.equal(await page.evaluate(async()=>!!(await (await caches.open('unrelated-app')).match('/unrelated'))),true);
 await page.reload();await page.locator('.ws-cookie-panel').waitFor();
 assert.equal(await page.locator('body').innerText().then(s=>s.includes('legacy-webshop')),false);
 await page.getByRole('button',{name:'Rozumiem',exact:true}).click();
 await page.evaluate(()=>sessionStorage.setItem('ws.pendingPay','keep-fixture'));
 // Sensitive-looking navigation and API responses must not enter any cache.
 await page.goto(origin+'/api/v1/synthetic?audit_token=private');
 await page.goto(origin+'/?audit_token=current');await page.locator('.ws-cookie-settings').waitFor({state:'attached'});
 const keys=await page.evaluate(async()=>{const all=[];for(const name of await caches.keys())for(const req of await (await caches.open(name)).keys())all.push(req.url);return all;});
 assert.equal(keys.some(k=>k.includes('audit_token=')),false);assert.equal(keys.some(k=>k.includes('/api/v1/')),false);
 await page.goto(origin+'/');await page.locator('.ws-cookie-settings').waitFor({state:'attached'});
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.ws-cookie-settings').waitFor({state:'attached'});
 assert.deepEqual(await page.evaluate(()=>[window.WSConsent.get().analytics,window.WSConsent.integrationAllowed('ga4'),sessionStorage.getItem('ws.pendingPay')]),[false,false,'keep-fixture']);
 assert.deepEqual(external,[]);
 console.log('PASS PWA: old worker upgraded, legacy cache removed, unrelated cache preserved, no API/token caching, offline consent retained and analytics disabled');
 await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
