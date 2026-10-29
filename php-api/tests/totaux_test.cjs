/* The basket displays the authoritative /cart/quote amounts. The old local
 * wsTotaux/wsRemiseBoutique pricing functions were removed when pricing moved
 * to the server. Test the shipped quote adapter, not a second pricing engine.
 *
 * Run: node php-api/tests/totaux_test.cjs (no npm dependencies required).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../../webshop-full-bundle.jsx'), 'utf8');

function extraire(nom) {
  const start = src.indexOf('function ' + nom + '(');
  assert.notEqual(start, -1, 'Missing production function: ' + nom);
  let par = 0, k = src.indexOf('(', start);
  for (; k < src.length; k++) {
    if (src[k] === '(') par++;
    else if (src[k] === ')' && --par === 0) break;
  }
  let depth = 0;
  for (let j = src.indexOf('{', k); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error('Unterminated production function: ' + nom);
}
const context = vm.createContext({});
vm.runInContext(['wsArrondi', 'wsMoney', 'wsQuoteTotals'].map(extraire).join('\n'), context);
const totals = context.wsQuoteTotals;
let assertions = 0;
function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
  assertions++;
}
const quote = (voucher = null) => ({
  totals: { gross_before_discount: '50.00', discount: '12.55', gross_after_discount: '37.45' },
  voucher,
});

equal(totals(null, 0), null, 'No local price is invented while the server quote is missing');
equal(totals({}, 0), null, 'A response without totals is not a quote');
let result = totals(quote(), '2.55');
equal(result.total, 40, 'Delivery is added once to the already-discounted server amount');
equal(result.sousTotal, 50, 'Original gross amount is displayed');
equal(result.productsTotal, 37.45, 'Authoritative product total is retained');
equal(result.remise, 12.55, 'Automatic discount is displayed, not subtracted twice');
equal(result.bon, 0, 'No voucher discount is invented');
equal(result.frais, 2.55, 'String-valued delivery amount is accepted');
equal(result.croise, 0, 'Removed local cross-portion rules are not recalculated');

result = totals(quote({ code: 'SAVE', valid: true, matches_cart: true }), 0);
equal(result.bon, 12.55, 'A valid, matching voucher uses the server discount');
equal(result.remise, 0, 'Voucher is not also displayed as an automatic discount');
equal(result.total, 37.45, 'Voucher does not reduce the final quote again');
for (const voucher of [
  { code: 'SAVE', valid: false, matches_cart: true },
  { code: 'SAVE', valid: true, matches_cart: false },
  { valid: true, matches_cart: true },
]) {
  result = totals(quote(voucher), 0);
  equal(result.bon, 0, 'An invalid, mismatching or unidentified voucher is not applied');
  equal(result.remise, 12.55, 'Server discount remains visible');
  equal(result.total, 37.45, 'Voucher metadata cannot override the server total');
}

result = totals({ ...quote(), weekday_discount: { discount_total: '5.00', percent: '10', minimum_cart_gross: '40', amount_remaining: '0', threshold_met: true } }, 0);
equal(result.weekday, 5, 'Weekday discount is displayed separately');
equal(Math.round(result.remise * 100), 755, 'Remaining automatic discount is preserved in cents');
equal(result.weekdayPercent, 10, 'Weekday rate is passed through');
equal(result.weekdayMinimum, 40, 'Minimum basket amount is passed through');
equal(result.weekdayThresholdMet, true, 'Reached threshold is passed through');
equal(result.total, 37.45, 'Weekday discount is not subtracted twice');
result = totals({ ...quote(), weekday_discount: { percent: '10', minimum_cart_gross: '60', amount_remaining: '10', threshold_met: false } }, 0);
equal(result.weekday, 0, 'Below-threshold weekday discount is zero');
equal(result.weekdayRemaining, 10, 'Remaining amount is displayed');
equal(result.weekdayThresholdMet, false, 'Unmet threshold remains false');
equal(result.total, 37.45, 'Threshold metadata does not change the quoted total');

for (const fee of [undefined, null, '', 'not money', Infinity, NaN]) {
  equal(totals(quote(), fee).total, 37.45, 'Missing/invalid delivery fee does not make the total NaN');
}
equal(totals({ totals: { gross_before_discount: '0.30', discount: '0.20', gross_after_discount: '0.10' } }, '0.20').total, 0.30, 'Amounts are rounded to cents');
equal(totals({ totals: { gross_before_discount: '10.00', discount: '10.00', gross_after_discount: '0.00' } }, 0).total, 0, 'Fully discounted basket remains free');

// Deterministic, cent-based fixtures avoid duplicating production float logic.
// A quote is an input contract: subtotal - discount + delivery is the expected
// customer amount, irrespective of the server rules which produced the discount.
let seed = 20260813;
const rnd = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
const money = cents => (cents / 100).toFixed(2);
for (let i = 0; i < 400; i++) {
  const subtotal = 1 + rnd(100000);
  const discount = rnd(subtotal + 1);
  const delivery = rnd(1501);
  const voucher = i % 3 === 0;
  const weekday = voucher ? 0 : rnd(discount + 1);
  const actual = totals({
    totals: { gross_before_discount: money(subtotal), discount: money(discount), gross_after_discount: money(subtotal - discount) },
    voucher: voucher ? { code: 'SAVE', valid: true, matches_cart: true } : null,
    weekday_discount: { discount_total: money(weekday) },
  }, money(delivery));
  equal(Math.round(actual.total * 100), subtotal - discount + delivery, 'Quote amount + delivery, fixture ' + i);
  equal(Math.round(actual.productsTotal * 100), subtotal - discount, 'Quoted product amount, fixture ' + i);
  equal(Math.round((actual.remise + actual.bon + actual.weekday) * 100), discount, 'Discount displayed exactly once, fixture ' + i);
  equal(Math.round(actual.sousTotal * 100), subtotal, 'Subtotal, fixture ' + i);
}
console.log(`PASS: ${assertions} assertions, including 400 server-quote baskets.`);
