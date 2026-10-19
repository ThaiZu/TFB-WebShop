import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {orderStatusName,paymentStatusName} from '../webshop-order-status.js';
test('preparation completion is ready for pickup, issued orders are closed',()=>{
 assert.equal(orderStatusName('completed'),'ready');assert.equal(orderStatusName('picked_up'),'completed');
 assert.equal(orderStatusName('in_production'),'inProduction');assert.equal(orderStatusName('unpicked'),'notCollected');
 assert.equal(orderStatusName('other'),'unknown');
});
test('failed and refunded payments cannot be shown as pending; all keys translated',()=>{
 assert.equal(paymentStatusName('failed'),'failed');assert.equal(paymentStatusName('refunded'),'refunded');assert.equal(paymentStatusName('other'),'unknown');
 for(const lang of ['pl','fr','nl']){
  const d=JSON.parse(fs.readFileSync(new URL('../public/locales/'+lang+'.json',import.meta.url)));
  for(const status of ['new','in_production','completed','ready','picked_up','unpicked','cancelled','other'])assert.ok(d['acc.orders.status.'+orderStatusName(status)]);
  for(const status of ['pending','paid','failed','refunded','other'])assert.ok(d['acc.orders.payment.'+paymentStatusName(status)]);
 }
});
