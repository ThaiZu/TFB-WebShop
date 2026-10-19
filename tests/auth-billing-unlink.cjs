const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const pl=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/locales/pl.json')));
let response;
const context={window:{WSI18n:{t:key=>pl[key]}},localStorage:{getItem:()=> 'test'},fetch:async(url,options)=>{
 assert.equal(url,'/clients/auth/billing-company/unlink');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer test');return response;
}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../webshop-auth-api.jsx'),'utf8'),context);context.window.WSAuth.endpoint='/clients/auth';
(async()=>{
 response={ok:true,json:async()=>({ok:true,user:{isBusiness:false,company:'',companyClientId:null,invoice:{vat:'',viesVerified:false}}})};
 let result=await context.window.WSAuth.unlinkCompany();assert.equal(result.ok,true);assert.equal(result.user.isBusiness,false);assert.equal(result.user.company,'');
 response={ok:false,status:500,json:async()=>({description:'BILLING_UNLINK_FAILED'})};result=await context.window.WSAuth.unlinkCompany();assert.equal(result.ok,false);assert.equal(result.error,pl['error.billingUnlink']);assert.equal(result.user,undefined);
 response={ok:false,status:401,json:async()=>({})};assert.equal((await context.window.WSAuth.unlinkCompany()).error,pl['error.viesAuth']);
 response={ok:true,json:async()=>{throw new Error('HTML response')}};assert.equal((await context.window.WSAuth.unlinkCompany()).ok,false);
 console.log('PASS: unlink returns cleared profile; write, authentication and malformed-response errors remain visible');
})().catch(e=>{console.error(e);process.exitCode=1});
