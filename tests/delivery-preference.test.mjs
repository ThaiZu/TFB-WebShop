import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDeliveryPreference, saveDeliveryPreference } from '../webshop-delivery-preference.js';

test('delivery preference is scoped to the customer and shop and can be replaced', () => {
  const values = new Map();
  globalThis.window = {};
  globalThis.window.WSSessionStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  assert.equal(readDeliveryPreference(7, 2), null);
  saveDeliveryPreference(7, 2, 18, 4);
  assert.deepEqual(readDeliveryPreference(7, 2), {officeId: 18, siteId: 4});
  assert.equal(readDeliveryPreference(8, 2), null);
  assert.equal(readDeliveryPreference(7, 3), null);
  saveDeliveryPreference(7, 2, 18, 8);
  assert.deepEqual(readDeliveryPreference(7, 2), {officeId: 18, siteId: 8});
  values.set('ws.deliveryPreference:7:2', '{broken');
  assert.equal(readDeliveryPreference(7, 2), null);
  values.set('ws.deliveryPreference:7:2', '{"officeId":18,"siteId":-1}');
  assert.equal(readDeliveryPreference(7, 2), null);
});

test('anonymous users and unavailable browser storage do not block ordering', () => {
  globalThis.window = {};
  globalThis.window.WSSessionStorage = {getItem() {throw Error('Blocked');}, setItem() {throw Error('Blocked');}};
  assert.equal(readDeliveryPreference(null, 2), null);
  assert.equal(readDeliveryPreference(7, 2), null);
  assert.doesNotThrow(() => saveDeliveryPreference(7, 2, 18, 4));
  assert.doesNotThrow(() => saveDeliveryPreference(null, 2, 18, 4));
});
