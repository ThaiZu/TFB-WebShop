import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),file=new URL('docs/privacy-drafts/manifest-dowodow.json',root);
const manifest=JSON.parse(readFileSync(file,'utf8'));
const additions={
 'TFB-WebShop/webshop-policy-links.jsx':['export function PolicyLinks'],
 'TFB-WebShop/public/policy-links.js':['function render'],
 'TFB-WebShop/webshop-policy-links.js':['export function policyLinks'],
 'TFB-Api/app/Services/Privacy/WebshopAccountReview.php':['public function batch','review_candidate'],
 'TFB-Api/scripts/review-webshop-accounts.php':['--output=/private/new-file.json'],
 'TFB-Api/app/Services/Panel/ShopInsightService.php':['private const METRICS','rankingList[]'],
 'TFB-Api/app/Services/Privacy/WebshopAuthRetention.php':['public function run','INTERVAL 15 MINUTE'],
 'TFB-Api/scripts/cleanup-webshop-auth-data.php':['$execute = false','--execute'],
 'TFB-Api/database/2026_10_28_webshop_auth_retention_indexes.sql':['ALTER TABLE client_password_reset_token'],
 'TFB-WebShop/public/session-storage.js':['const MAX_AGE','function sweep','function clearCustomer'],
 'TFB-WebShop/scripts/privacy-pages.mjs':['export function policyPages','export function privacyPagesPlugin'],
 'TFB-WebShop/privacy-policies.json':['"version"','"status"']
};
for(const [path,anchors]of Object.entries(additions))if(!manifest.files.some(f=>f.path===path))manifest.files.push({path,anchors:anchors.map(anchor=>({anchor}))});
for(const entry of manifest.files){
 const path=new URL('../'+entry.path,root);const contents=readFileSync(path);const lines=contents.toString().split('\n');
 entry.sha256=createHash('sha256').update(contents).digest('hex');
 for(const item of entry.anchors){
  if(item.anchor==='localStorage.setItem')item.anchor='window.WSSessionStorage.setItem';
  if(entry.path.includes('webshop-landing-b2b.js'))item.anchor=item.anchor.replace('localStorage.getItem','sessionStorage.getItem').replace('localStorage.setItem','sessionStorage.setItem');
  const index=lines.findIndex(line=>line.includes(item.anchor));
  if(index<0)throw Error('Anchor no longer present: '+entry.path+' '+item.anchor);
  item.line=index+1;
 }
}
manifest.version='atelierby-2026-10-28';manifest.date='2026-10-28';
writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
const docFile=new URL('docs/privacy-drafts/03-dowody-z-kodu-PL.md',root);
let doc=readFileSync(docFile,'utf8');
const start=doc.indexOf('| Plik i linia |'),end=doc.indexOf('\n## Braki',start);
const table='| Plik i linia | Kotwica |\n| --- | --- |\n'+manifest.files.flatMap(f=>f.anchors.map(a=>'| `'+f.path+':'+a.line+'` | `'+a.anchor+'` |')).join('\n')+'\n';
if(start<0||end<0)throw Error('Evidence table boundaries missing');
doc=doc.slice(0,start)+table+doc.slice(end);writeFileSync(docFile,doc);
console.log('Refreshed '+manifest.files.length+' file hashes and code anchors');
