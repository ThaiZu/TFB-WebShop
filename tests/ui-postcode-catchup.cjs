/* Isolated real React components + mocked profile API: no server or customer writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {transformSync}=require('esbuild');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'webshop-full-bundle.jsx'),'utf8');
const fields=source.slice(source.indexOf('const CP_RE ='),source.indexOf('function SmsPasswordReset('));
const modal=source.slice(source.indexOf('function PostcodeCatchupModal('),source.indexOf('// Pulse apricot'));
const directory={};for(const {zip,city} of JSON.parse(fs.readFileSync(path.join(root,'php-api/data/zipcodes_be.json')))){
 const list=directory[zip]??=[];if(!list.includes(city.trim()))list.push(city.trim());
}
const unique=Object.entries(directory).find(([,cities])=>cities.length===1);
const multiple=Object.entries(directory).find(([,cities])=>cities.length>1);
const compiled=transformSync(`const {useState,useEffect}=React;
const wsUseT=()=>({t:k=>k});const wsText=k=>k;const wsMessage=k=>k;const tRich=(t,k)=>t(k);
function ModalShell({children}){return <section role="dialog">{children}</section>;}
${fields}\n${modal}
function TestApp(){const [user,setUser]=useState({id:1,postalCode:null,needsPostcode:true});return <PostcodeCatchupModal user={user} onUpdateUser={setUser}/>;}
ReactDOM.createRoot(document.getElementById('root')).render(<TestApp/>);`,{loader:'jsx',format:'iife'}).code;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 try{
  async function pageFor(map=directory){
   const page=await browser.newPage({viewport:{width:390,height:844}});
   await page.setContent('<main id="root"></main>');
   await page.addScriptTag({path:path.join(path.dirname(require.resolve('react')),'umd/react.development.js')});
   await page.addScriptTag({path:path.join(path.dirname(require.resolve('react-dom')),'umd/react-dom.development.js')});
   await page.evaluate(map=>{
    window.__WS_POSTCODE_LOCALITIES__=map;window.patches=[];
    window.WSAuth={updateMe:async patch=>{
     window.patches.push(patch);
     if(patch.locality==='')return {ok:false,error:'locality is invalid'};
     return {ok:true,user:{id:1,postalCode:patch.postalCode,locality:patch.locality??null,needsPostcode:false}};
    }};
   },map);
   await page.addScriptTag({content:compiled});await page.locator('input[autocomplete="postal-code"]').waitFor();return page;
  }
  let page=await pageFor();
  await page.locator('input[autocomplete="postal-code"]').fill(unique[0]);
  await page.getByRole('button',{name:'ui.validate',exact:true}).click();
  await page.locator('[role="dialog"]').waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(()=>patches),[{postalCode:unique[0],locality:unique[1][0]}]);await page.close();

  page=await pageFor();await page.locator('input[autocomplete="postal-code"]').fill(unique[0]);
  await page.getByText(unique[1][0],{exact:false}).waitFor();
  await page.locator('input[autocomplete="postal-code"]').fill(multiple[0]);
  await page.locator('select').waitFor();
  await page.getByRole('button',{name:'ui.validate',exact:true}).click();
  await page.getByText('error.locality',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>patches.length),0);
  await page.locator('select').selectOption(multiple[1][0]);await page.getByRole('button',{name:'ui.validate',exact:true}).click();
  await page.locator('[role="dialog"]').waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(()=>patches),[{postalCode:multiple[0],locality:multiple[1][0]}]);await page.close();

  for(const manual of ['', 'Warszawa']){
   page=await pageFor();await page.locator('input[autocomplete="postal-code"]').fill('00-001');
   await page.locator('input[autocomplete="address-level2"]').fill(manual);
   await page.getByRole('button',{name:'ui.validate',exact:true}).click();await page.locator('[role="dialog"]').waitFor({state:'detached'});
   assert.deepEqual(await page.evaluate(()=>patches),[manual?{postalCode:'00-001',locality:manual}:{postalCode:'00-001'}]);await page.close();
  }
  console.log('PASS: empty account postcode catchup; automatic city, ambiguous choice, clearing stale city, optional/manual international locality; no empty locality requests');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
