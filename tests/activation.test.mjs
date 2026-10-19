import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('pending registration reports mail outcome without writing a session or loading a profile', async () => {
 for (const sent of [true,false]) {
  let calls=0;
  const context={window:{setInterval:()=>0,addEventListener:()=>{}},document:{addEventListener:()=>{}},navigator:{language:'pl'},localStorage:{getItem:()=>null,setItem:()=>assert.fail('Pending account must not receive a session')},
    fetch:async()=>{calls++;return {ok:true,json:async()=>({ok:true,activation_required:true,activation_email_sent:sent})};}};
  vm.runInNewContext(fs.readFileSync(new URL('../webshop-auth-api.jsx',import.meta.url),'utf8'),context);
  context.window.WSAuth.endpoint='/clients/auth';
  const result=await context.window.WSAuth.register({email:'client@example.invalid',phone:'501234567',phonePrefix:'+48',shopId:2});
  assert.equal(result.ok,true);assert.equal(result.activationRequired,true);assert.equal(result.emailSent,sent);assert.equal(calls,1);
 }
});
test('registration errors remain errors and allow a retry without a fabricated session',async()=>{
 const context={window:{setInterval:()=>0,addEventListener:()=>{}},document:{addEventListener:()=>{}},navigator:{language:'pl'},localStorage:{getItem:()=>null},fetch:async()=>({ok:false,status:409,json:async()=>({description:'Already used'})})};
 vm.runInNewContext(fs.readFileSync(new URL('../webshop-auth-api.jsx',import.meta.url),'utf8'),context);
 context.window.WSAuth.endpoint='/clients/auth';
 const result=await context.window.WSAuth.register({shopId:2});
 assert.equal(result.ok,false);assert.equal(result.exists,true);assert.equal(result.error,'Already used');
});
