import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const availabilityApi = readFileSync(new URL('../webshop-availability-api.jsx', import.meta.url), 'utf8');
const pickupDates = readFileSync(new URL('../webshop-pickup-dates.jsx', import.meta.url), 'utf8');
const checkout = readFileSync(new URL('../webshop-full-bundle.jsx', import.meta.url), 'utf8');

assert.match(availabilityApi, /function productIdsFromBasket\(basket\)/);
assert.match(availabilityApi, /listAvailableDays\(\{ shopId, mode, from, to, basket = \[\]/);
assert.match(availabilityApi, /productIds=\$\{encodeURIComponent\(productIds\.join\(','\)\)\}/);
assert.match(availabilityApi, /listSlots\(\{ shopId, mode, date, basket = \[\]/);
assert.match(pickupDates, /listAvailableDays\(\{shopId,mode,basket,strict:true/);
assert.match(pickupDates, /listSlots\(\{shopId,mode,date:iso,basket\}\)/);
assert.match(checkout, /<CheckoutStep2[\s\S]{0,700}basket=\{basket\}/);
assert.match(checkout, /listSlots\(\{ shopId: shop\?\.id, mode, date: isoDate, basket \}\)/);
assert.match(checkout, /co\.slot\.cartRestriction/);

console.log('PASS: pickup cutoff availability requests carry the current basket and re-evaluate checkout slots.');
