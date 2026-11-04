import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateVoucherPage,readVouchers,prepareVouchers} from '../webshop-vouchers-api.js';

const voucher=()=>({id:1,code:'PERSONAL-1',name:'Bagietka',source:'LOYALTY',status:'READY',validFrom:null,validTo:null,canUse:true});
const page=()=>({status:'available',asOf:'2026-11-02T10:00:00Z',items:[voucher()],nextCursor:null});
test('wallet validates owners projection, lifecycle states, duplicates and dates',()=>{
  assert.equal(validateVoucherPage(page()).items[0].code,'PERSONAL-1');
  for(const status of ['READY','RESERVED','USED','EXPIRED','REVOKED','DISABLED','UPCOMING']){
    const data=page();data.items[0].status=status;assert.equal(validateVoucherPage(data),data);
  }
  for(const mutate of [data=>data.items.push(voucher()),data=>data.items[0].id=-1,data=>data.items[0].code='',
    data=>data.items[0].validTo='bad',data=>data.items[0].canUse='yes',data=>data.items[0].status='PROCESSING',data=>data.asOf=null]){
    const data=page();mutate(data);assert.throws(()=>validateVoucherPage(data),/VOUCHER_INVALID_RESPONSE/);
  }
});
test('wallet transport uses authenticated requests without accepting a customer identifier',async()=>{
  global.__WS_API_BASE_URL__='https://api.example.invalid/api/v1';
  const calls=[];
  global.window={WSAuth:{authenticatedJson:async(url,options)=>{
    calls.push({url,options});return {response:{ok:true},data:url.endsWith('/prepare')?{prepared:1,hasMore:false}:page()};
  }}};
  await prepareVouchers();await readVouchers(2,'30');
  assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.body,'{}');
  assert.equal(calls[1].options.cache,'no-store');
  const query=new URL(calls[1].url).searchParams;
  assert.equal(query.get('shopId'),'2');assert.equal(query.get('cursor'),'30');assert.equal(query.has('clientId'),false);
  window.WSAuth.authenticatedJson=async()=>({response:{ok:false,status:503},data:{}});
  await assert.rejects(()=>readVouchers(2),error=>error.status===503);
});
