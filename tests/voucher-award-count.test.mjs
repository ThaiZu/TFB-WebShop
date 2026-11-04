import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voucherAwardCount} from '../webshop-voucher-notifications.js';

test('corrected order counts the retained award and excludes disabled excess codes',()=>{
 const order={payment:{status:'paid'},rewardVouchers:[{status:'ACTIVE'},...Array.from({length:4},()=>({status:'DISABLED'}))]};
 assert.equal(voucherAwardCount(order),1);
 assert.equal(voucherAwardCount({...order,payment:{status:'pending'}}),0);
 assert.equal(voucherAwardCount({...order,rewardVouchers:[{status:'DISABLED'},{status:'REVOKED'}]}),0);
 assert.equal(voucherAwardCount({...order,rewardVouchers:[{status:'ACTIVE'},{status:'USED'}]}),2);
});
