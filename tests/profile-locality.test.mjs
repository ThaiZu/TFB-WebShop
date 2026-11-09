import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../webshop-auth-api.jsx',import.meta.url),'utf8');
test('profile PATCH omits absent optional locality while preserving supplied locality and other fields',async()=>{
 const requests=[];
 const storage={getItem:()=>null,removeItem(){}};
 const context={window:{setInterval(){},addEventListener(){},WSSessionStorage:storage,localStorage:storage},document:{addEventListener(){}},fetch:async(url,options)=>{
  requests.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({user:{id:1,postalCode:'00-001'}})};
 }};
 vm.runInNewContext(source,context);context.window.WSAuth.endpoint='/clients/auth';
 context.window.WSAuth.ensureFreshSession=async()=>true;
 for(const value of ['', '  ',null,undefined]){
  const patch={postalCode:'00-001',locality:value};assert.equal((await context.window.WSAuth.updateMe(patch)).ok,true);
  assert.deepEqual(requests.at(-1),{postalCode:'00-001'});assert.equal(patch.locality,value);
 }
 await context.window.WSAuth.updateMe({postalCode:'00-001',locality:'Warszawa',firstName:'Test'});
 assert.deepEqual(requests.at(-1),{postalCode:'00-001',locality:'Warszawa',firstName:'Test'});
});
