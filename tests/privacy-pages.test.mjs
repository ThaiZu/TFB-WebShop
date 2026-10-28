import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {policyPages,inline,markdown,readPolicySources} from '../scripts/privacy-pages.mjs';
import {policyLinks} from '../webshop-policy-links.js';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('privacy-policies.json',root)));
const sources=readPolicySources(root,manifest);
test('approved release emits six clean published pages under root and subpath',()=>{
 for(const base of ['/','/WebShop/']){
  const pages=policyPages({manifest,sources,base});assert.equal(pages.length,6);
  for(const page of pages){assert.doesNotMatch(page.source,/DEC-\d|draft-\d|class="draft"|<script/);assert.match(page.source,/href="(?:\/|\/WebShop\/)"/);assert.match(page.fileName,/^privacy\/(pl|fr|nl)\/(privacy|cookies)\.html$/);}
 }
});
test('draft builds cannot publish; opt-in preview is visibly marked',()=>{
 const draft={...manifest,status:'draft',approvedBy:null,approvedAt:null};
 assert.deepEqual(policyPages({manifest:draft,sources}),[]);
 for(const page of policyPages({manifest:draft,sources,preview:true})){
  assert.match(page.source,/noindex,nofollow/);assert.match(page.source,/class="draft"/);assert.match(page.fileName,/^privacy-preview/);
 }
});
test('approval cannot bypass absent signoff or unresolved placeholders',()=>{
 assert.throws(()=>policyPages({manifest:{...manifest,approvedBy:null},sources}),/approval evidence/);
 const bad={...sources,[manifest.documents.pl.privacy]:'# Notice\n\nDEC-04 unresolved'};
 assert.throws(()=>policyPages({manifest,sources:bad}),/Unresolved/);
 assert.throws(()=>readPolicySources(root,{...manifest,sourceDirectory:'../../'}),/Invalid/);
});
test('published links survive config failure, respect base and do not expose unapproved drafts',()=>{
 assert.deepEqual(policyLinks('pl',null,'/WebShop/',false,true),{privacyUrl:'/WebShop/privacy/pl/privacy.html',cookiesUrl:'/WebShop/privacy/pl/cookies.html'});
 assert.equal(policyLinks('pl',null,'/',false,false).privacyUrl,undefined);
 assert.equal(policyLinks('nl',{policies:{nl:{privacyUrl:'https://example.test/notice'}}},'/',false,true).privacyUrl,'https://example.test/notice');
});
test('source cannot inject executable markup or links',()=>{
 assert.doesNotMatch(inline('<script>alert(1)</script> [run](javascript:alert)'),/<script|href=/);
 assert.match(inline('[source](https://example.test/?a=1&b=2)'),/a=1&amp;b=2/);
 assert.doesNotMatch(markdown('<img src=x onerror=alert(1)>'),/<img/);
});
