import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseAvailability, availablePortions, basketProductUnits, stockMessageKey } from '../webshop-stock.js';
test('explicit server rollout policy bypasses missing stock, not implicit missing data', () => {
  const state=normaliseAvailability({status:'not_enforced',inventory_enforced:false},null);
  assert.equal(availablePortions(state,'entier',999),null);
  assert.equal(stockMessageKey(state),null);
  assert.equal(normaliseAvailability({status:'not_enforced'},null).status,'uninitialized');
});

test('whole product stock is shared between all portions and basket lines', () => {
  const stock = normaliseAvailability({status: 'available', quantity_available: '1.750'}, '2026-09-10');
  const basket = [{productId: 11, portion: 'demi', qty: 2}, {productId: '11', portion: 'quart', qty: 1}, {productId: 22, qty: 9}];
  const units = basketProductUnits(basket, 11);
  assert.equal(units, 1.25);
  assert.equal(availablePortions(stock, 'entier', units), 0);
  assert.equal(availablePortions(stock, 'demi', units), 1);
  assert.equal(availablePortions(stock, 'quart', units), 2);
  assert.equal(availablePortions(stock, 'huitieme', units), 4);
  assert.equal(availablePortions(stock, 'entier', 4), 0);
});

test('future production does not inherit a limit from current physical stock', () => {
  const stock = normaliseAvailability({status: 'production', quantity_available: null}, '2026-09-10');
  assert.equal(availablePortions(stock, 'entier', 250), null);
  assert.equal(stockMessageKey(stock), null);
});

test('unknown quantities and undecided future direct-sale rules are not sold out or guaranteed', () => {
  for (const input of [null, {status:'available',quantity_available:null}, {status:'available',quantity_available:'invalid'}, {status:'available',quantity_available:-1}, {status:'unknown'}]) {
    const stock=normaliseAvailability(input, '2026-09-10');
    assert.equal(stock.status,'unknown');
    assert.equal(availablePortions(stock,'entier'),null);
    assert.equal(stockMessageKey(stock),'stock.unavailable');
  }
  const pending=normaliseAvailability({status:'unconfirmed'}, '2026-09-10');
  assert.equal(availablePortions(pending,'entier'),null);
  assert.equal(stockMessageKey(pending),'stock.futureUnconfirmed');
});

test('uninitialized stock is blocked without interpreting a legacy 999 as usable stock', () => {
  const stock=normaliseAvailability({status:'available',quantity_available:999}, null);
  assert.equal(availablePortions(stock,'huitieme'),0);
  assert.equal(stockMessageKey(stock),'stock.uninitialized');
  const empty=normaliseAvailability({status:'out_of_stock',quantity_available:'0.000'}, '2026-09-10');
  assert.equal(availablePortions(empty,'demi'),0);
  assert.equal(stockMessageKey(empty),null);
});
