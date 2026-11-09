// HTTP fixture only: match the current cookie-session and server voucher contracts.
const assert=require('node:assert/strict');
module.exports=({accessToken,findVoucher=()=>null})=>{
 let state={revision:0,code:null,reserved:false};
 return request=>{
  const path=new URL(request.url()).pathname;
  if(path.endsWith('/clients/auth/refresh'))return {json:{access_token:accessToken,session_transport:'cookie'}};
  if(!path.endsWith('/webshop/vouchers/activation'))return null;
  if(request.method()==='POST'){
   const body=request.postDataJSON();
   assert.equal(body.revision,state.revision,'Activation writes must use the latest server revision');
   const voucher=body.code===null?null:findVoucher(body.code);
   assert.ok(body.code===null||voucher,'Only a known fixture voucher can be selected');
   state={revision:state.revision+1,code:body.code,reserved:false,name:voucher?.name??null};
  }
  return {json:state};
 };
};
