/* Actual wallet, SVG and QR renderer; isolated HTTP-free React fixture. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const {transformSync}=require('esbuild');
const root=path.join(__dirname,'..');
const wallet=fs.readFileSync(path.join(root,'webshop-loyalty-wallet.jsx'),'utf8').replace(/^import[^\r\n]*\r?\n/gm,'').replace(/^export /gm,'');
const barcode=fs.readFileSync(path.join(root,'webshop-loyalty-barcode.js'),'utf8').replace(/^export /gm,'');
const qr=fs.readFileSync(path.join(root,'qr.jsx'),'utf8');
const code='FID1-ZZZZZZ-0123456789ABCDEF0123456789ABCDEF';
const source=transformSync(`${barcode}\nconst useLoyaltyPage=()=>({items:[],busy:false,error:null,nextCursor:null});
function LoyaltyProgram(){return null;}function AccountVouchers(){return null;}
${wallet}
ReactDOM.createRoot(document.getElementById('root')).render(<LoyaltyWallet identity={{status:'ready',code:window.cardCode}} shopId={2} user={{id:1,firstName:'Test'}} onClose={()=>window.walletClosed=true}/>);`,{loader:'jsx',format:'iife'}).code;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{
  for(const code of ['FID1-ZZZZZZ-0123456789ABCDEF0123456789ABCDEF','9800000000000001'])for(const language of ['pl','fr','nl'])for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:3});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<style>*{box-sizing:border-box}body{margin:0}</style><div id="root"></div>');
   await page.addStyleTag({path:path.join(root,'webshop-loyalty-wallet.css')});
   await page.addScriptTag({path:path.join(path.dirname(require.resolve('react')),'umd/react.development.js')});
   await page.addScriptTag({path:path.join(path.dirname(require.resolve('react-dom')),'umd/react-dom.development.js')});
   await page.evaluate(({strings,code})=>{window.cardCode=code;window.useT=()=>({t:key=>strings[key]||key});window.walletClosed=false;}, {strings:JSON.parse(fs.readFileSync(path.join(root,`public/locales/${language}.json`))),code});
   await page.addScriptTag({content:qr});
   await page.evaluate(()=>{window.qrInputs=[];const original=window.QR.render;window.QR.render=(value,opts)=>{qrInputs.push(value);return original(value,opts);};});
   await page.addScriptTag({content:source});
   const dialog=page.locator('.ws-loyalty-wallet:modal');await dialog.locator('.ws-loyalty-wallet__barcode svg').waitFor();
   const choices=dialog.locator('.ws-loyalty-wallet__formats button');assert.equal(await choices.count(),2);assert.equal(await choices.nth(0).getAttribute('aria-pressed'),'true');
   const before=await dialog.locator('.ws-loyalty-wallet__barcode').innerHTML();
   const bounds=await dialog.boundingBox(),bars=await dialog.locator('.ws-loyalty-wallet__barcode svg').boundingBox();
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert.ok(bars.x>=bounds.x&&bars.x+bars.width<=bounds.x+bounds.width);assert.ok(bars.height>=96);
   assert.equal(await dialog.evaluate(node=>node.scrollWidth>node.clientWidth),false,'Card must not clip horizontally');
   assert.equal(await dialog.locator('code').count(),0);assert.equal(await dialog.innerText().then(text=>text.includes(code)),false);
   await choices.nth(1).click();await dialog.locator('.ws-loyalty-wallet__qr svg').waitFor();assert.deepEqual(await page.evaluate(()=>qrInputs),[code]);assert.equal(await choices.nth(1).getAttribute('aria-pressed'),'true');
   await choices.nth(0).click();await dialog.locator('.ws-loyalty-wallet__barcode svg').waitFor();assert.equal(await dialog.locator('.ws-loyalty-wallet__barcode').innerHTML(),before);
   const expand=dialog.locator('.ws-loyalty-wallet__expand');
   if(code.startsWith('98')){
    assert.equal(await expand.count(),0);assert.equal(await dialog.locator('.ws-loyalty-wallet__scan-hint').count(),0);
    assert.equal(await dialog.locator('.ws-loyalty-wallet__barcode svg').getAttribute('viewBox'),'0 0 143 112');
    assert.ok(bars.width/143>1.5,'Short code modules must stay wide on a small phone');
    if(language==='fr'&&width===320)await page.screenshot({path:'/tmp/short-loyalty-card-mobile.png'});
   }else{
   await expand.click();
   const scan=dialog.locator('.ws-loyalty-wallet__scan-code svg');await scan.waitFor();
   const enlarged=await scan.boundingBox();
   assert.ok(enlarged.x>=-1&&enlarged.y>=-1&&enlarged.x+enlarged.width<=width+1&&enlarged.y+enlarged.height<=height+1,'Whole enlarged code including quiet zones must fit');
   assert.ok(Math.max(enlarged.width,enlarged.height)>bars.width*1.15,'Enlarged code must have wider modules');
   assert.equal(await dialog.locator('.ws-loyalty-wallet__scan-code').innerHTML(),before,'Enlarging must preserve every bar and quiet zone');
   assert.equal(await page.evaluate(()=>document.activeElement.className),'ws-loyalty-wallet__scan-back');
   if(language==='fr'&&width===390)await page.screenshot({path:'/tmp/loyalty-barcode-scan-expanded.png'});
   if(width===390){
    await page.setViewportSize({width:844,height:390});const rotated=await scan.boundingBox();
    assert.ok(rotated.width>rotated.height&&rotated.x>=0&&rotated.y>=0&&rotated.x+rotated.width<=845&&rotated.y+rotated.height<=391);
    assert.equal(await dialog.locator('.ws-loyalty-wallet__scan-code').innerHTML(),before);
    await page.setViewportSize({width,height});
   }
   await page.keyboard.press('Escape');await dialog.locator('.ws-loyalty-wallet__barcode svg').waitFor();
   assert.equal(await page.evaluate(()=>walletClosed),false,'Escape returns to the card first');
   assert.equal(await expand.evaluate(node=>node===document.activeElement),true);
   assert.equal(await dialog.locator('.ws-loyalty-wallet__barcode').innerHTML(),before);
   await expand.click();await dialog.locator('.ws-loyalty-wallet__scan-back').click();await dialog.locator('.ws-loyalty-wallet__barcode svg').waitFor();

   }
   assert.deepEqual(errors,[]);await page.keyboard.press('Escape');await page.waitForFunction(()=>walletClosed);assert.equal(await page.evaluate(()=>walletClosed),true);await page.close();
  }
  console.log('PASS: barcode default, QR toggle uses same card identity (legacy and short), stable barcode after switching, no raw card text, 3 languages x portrait/landscape/desktop, enlarged modules, preserved SVG, no clipping, back/Escape/focus and no JS errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
