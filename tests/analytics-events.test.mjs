import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyticsItems,analyticsPurchase,analyticsEvent} from '../webshop-analytics.js';
test('saved order maps only numeric commerce fields; pending/cancelled orders cannot purchase',()=>{
 const calls=[];globalThis.window={WSConsent:{track:(...args)=>calls.push(args)}};
 const order={orderRef:'WEB-2-20261027-ABCDEF',status:'new',payment:{method:'stripe',status:'pending'},items:[{productId:11,quantity:2,unitGrossPrice:5,name:'private',note:'secret',options:['secret']}],contact:{email:'private@example.invalid'}};
 analyticsPurchase(order,10);assert.equal(calls.length,0);
 analyticsPurchase({...order,payment:{method:'stripe',status:'paid'}},'10.00');
 assert.deepEqual(calls[0],['analytics','purchase',{transaction_id:order.orderRef,value:10,items:[{item_id:'11',quantity:2,price:5}]}]);
 analyticsPurchase({...order,status:'cancelled',payment:{method:'shop'}},10);assert.equal(calls.length,1);
 analyticsPurchase({...order,orderRef:'WEB-2-20261027-ABCD00',payment:{method:'shop'}},10);assert.equal(calls.length,2);
 assert.equal(JSON.stringify(calls).includes('secret'),false);
});
test('unavailable analytics and malformed optional items never interrupt a purchase',()=>{
 globalThis.window={WSConsent:{track(){throw Error('analytics');}}};
 assert.doesNotThrow(()=>analyticsEvent('add_to_cart',[null]));
 assert.doesNotThrow(()=>analyticsPurchase({orderRef:'WEB-2-20261027-ABCDEF',items:[null]},10));
 assert.deepEqual(analyticsItems([null,{productId:11,qty:1,price:5,note:'secret'}]),[{item_id:'11',quantity:1,price:5}]);
 delete globalThis.window;
});

test('an already-observed paid order is not replayed after a later consent',()=>{
 const order={orderRef:'WEB-2-20261027-ABCD01',payment:{method:'stripe',status:'paid'},items:[]};
 globalThis.window={WSConsent:{track(){}}};analyticsPurchase(order,10);
 let sent=0;window.WSConsent.track=()=>sent++;analyticsPurchase(order,10);assert.equal(sent,0);
 delete globalThis.window;
});
