import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { basketShoppingContext, normaliseShoppingContext } from '../webshop-office-context.js';

const source = fs.readFileSync(new URL('../webshop-full-bundle.jsx', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const context = { React, useState: React.useState, useEffect: React.useEffect,
  wsUseT: () => ({ t: key => key }), wsText: key => key, wsMessage: value => value,
  wsNumber: value => Number(value).toFixed(2), Pict: () => null, LoyaltyBasketIcons: () => null,
  wsArrondi: value => Math.round(value * 100) / 100 };
vm.runInNewContext(transformSync(['wsMoney','wsCheckoutQuoteComparable','wsQuoteLineKey','wsQuoteTotals','wsBasketDisplayRows','wsPromotionDisplayTotal','wsHasPromotionSelection','wsSelectedAutomaticPromotionId','wsRemoveBasketLines','CheckoutStep3'].map(extract).join('\n'), { loader: 'jsx' }).code, context);
const quote = voucher => ({ items: [{ line_key: 'web-1', unit_gross_price: '10.00', total_gross_value_after_discount: '8.50' }],
  totals: { gross_before_discount: '10.00', discount: '1.50', gross_after_discount: '8.50' }, voucher });

test('server voucher amount is displayed once without requiring POS-only provided field', () => {
  const totals = context.wsQuoteTotals(quote({ code: 'SAVE', valid: true, matches_cart: true }), 0);
  assert.equal(totals.bon, 1.50);
  assert.equal(totals.remise, 0);
  assert.equal(totals.total, 8.50);
});
test('automatic promotion retains the server discount without local rules', () => {
  const totals = context.wsQuoteTotals(quote(null), 0);
  assert.equal(totals.bon, 0);
  assert.equal(totals.remise, 1.50);
  assert.equal(totals.total, 8.50);
});
test('weekday discount has a separate basket-summary total from automatic promotions', () => {
  const totals = context.wsQuoteTotals({
    ...quote(null),
    totals: { gross_before_discount: '20.00', discount: '4.50', gross_after_discount: '15.50' },
    weekday_discount: { percent: '10.00', discount_total: '2.00' },
  }, 0);
  assert.equal(totals.remise, 2.50);
  assert.equal(totals.weekday, 2.00);
  assert.equal(totals.weekdayPercent, 10.00);
  assert.equal(totals.total, 15.50);
});
test('weekday discount threshold is exposed without a discount when the cart drops below it', () => {
  const totals = context.wsQuoteTotals({
    ...quote(null),
    weekday_discount: {
      percent: '10.00', minimum_cart_gross: '20.00',
      cart_gross_before_weekday_discount: '15.00', amount_remaining: '5.00', threshold_met: false,
    },
  }, 0);
  assert.equal(totals.weekday, 0);
  assert.equal(totals.weekdayMinimum, 20);
  assert.equal(totals.weekdayRemaining, 5);
  assert.equal(totals.weekdayThresholdMet, false);
});
test('checkout ignores regenerated technical menu group IDs but detects a real menu price change', () => {
  const base = {
    totals: { gross_before_discount: '12.00', gross_after_discount: '12.00', discount: '0.00', tax_after_discount: '1.28' },
    billing: { mode: 'person' },
    items: [{ line_key: 'web-menu', id_product: 10, id_product_portion: null, quantity: 1, unit_gross_price: '12.00', item_tax_perc: 6,
      item_discount_value: '0.00', total_gross_value_before_discount: '12.00', total_gross_value_after_discount: '12.00', total_tax_value_after_discount: '1.28', total_net_value_after_discount: '10.72',
      menu_group_id: 'first-random-group', menu_snapshot: { group_id: 'first-random-group', components: [] } }],
  };
  const recalculated = structuredClone(base);
  recalculated.items[0].menu_group_id = 'next-random-group';
  recalculated.items[0].menu_snapshot.group_id = 'next-random-group';
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.wsCheckoutQuoteComparable(base))),
    JSON.parse(JSON.stringify(context.wsCheckoutQuoteComparable(recalculated))),
  );
  recalculated.items[0].total_gross_value_after_discount = '13.00';
  assert.notDeepEqual(
    JSON.parse(JSON.stringify(context.wsCheckoutQuoteComparable(base))),
    JSON.parse(JSON.stringify(context.wsCheckoutQuoteComparable(recalculated))),
  );
});
test('accepted automatic promotion is displayed as one customer-facing basket row', () => {
  const rows = context.wsBasketDisplayRows([
    { line: 'main', productId: 1300012, qty: 1, promotion_group: 'sandwich-13' },
    { line: 'added', productId: 1300012, qty: 24, promotion_group: 'sandwich-13' },
  ], {
    items: [
      { line_key: 'web-main', total_gross_value_after_discount: '0.90' },
      { line_key: 'web-added', total_gross_value_after_discount: '15.60' },
    ],
    applied_promotions: [{ source: 'AUTOMATIC', display_name: '10 pour 15', items: [{ line_key: 'web-added' }] }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 25);
  assert.equal(rows[0].price, 16.5);
  assert.equal(rows[0].promotion.display_name, '10 pour 15');
});
test('promotion lines with null and omitted portions are still one product row', () => {
  const rows = context.wsBasketDisplayRows([
    { line: 'main', productId: 1300012, qty: 1, promotion_group: 'sandwich-13' },
    { line: 'added', productId: 1300012, id_product_portion: null, qty: 24, promotion_group: 'sandwich-13' },
  ], { items: [] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 25);
});
test('selected promotion price takes precedence over the one-product CTA price', () => {
  assert.equal(context.wsPromotionDisplayTotal({ total_gross_after_discount: '15.00' }, 0.9), 15);
  assert.equal(context.wsPromotionDisplayTotal(null, 0.9), 0.9);
});
test('a selected promotion locks further promotion selection in the cart', () => {
  assert.equal(context.wsHasPromotionSelection([{ promotion_group: 'promotion-10-13' }]), true);
  assert.equal(context.wsHasPromotionSelection([{ productId: 10 }]), false);
});
test('a basket keeps its selected automatic promotion when ordinary products are added', () => {
  assert.equal(context.wsSelectedAutomaticPromotionId([
    { line: 'sandwich', promotion_id: 13, promotion_group: 'promotion-1-13' },
    { line: 'baguette', productId: 10 },
  ]), 13);
});
test('removing one component removes the complete customer-facing promotion', () => {
  const basket = [
    { line: 'baguette', productId: 10, promotion_group: 'bundle-1', promotion_display: { display_name: 'Baguette + Cola' } },
    { line: 'cola', productId: 11, promotion_group: 'bundle-1', promotion_display: { display_name: 'Baguette + Cola' } },
  ];
  const result = context.wsRemoveBasketLines(basket, 'baguette');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), []);
  assert.equal(context.wsHasPromotionSelection(result), false);
});
test('product sheet previews every automatic promotion type before the item is added', () => {
  assert.match(source, /onPromotionPreview=\{previewPromotionsForDetail\}/);
  assert.match(source, /className="pdm-promotion"/);
  assert.match(source, /promotion_suggestions \|\| quote\?\.bundle_suggestions/);
  assert.match(source, /promotion\.promotion_type/);
  assert.match(source, /disabled=\{blocked\}/);
  assert.match(source, /onAdd\(\{[\s\S]*?\}, selectedPromotion\)/);
  assert.match(source, /promotionAdditionLines\(selectedPromotion, lineId, promotionGroup, promotionDisplay\)/);
});
test('product sheet waits for promotions and menu options before exposing configurable controls', () => {
  assert.match(source, /detailOptionsState/);
  assert.match(source, /optionsLoading=\{Number\(detailOptionsState\.productId\)/);
  assert.match(source, /markDetailOptionReady\(productId, 'promotionsReady'\)/);
  assert.match(source, /markDetailOptionReady\(p\.id, 'menuReady'\)/);
  assert.match(source, /pdm-options-loading/);
});
function render(status, voucher) {
  return renderToStaticMarkup(React.createElement(context.CheckoutStep3, {
    basket: [{ line: 1, name: 'Fixture', qty: 1 }], subtotal: 10, totaux: {}, total: 8.5,
    payment: 'shop', setPayment() {}, shopId: 2, mode: 'collect', voucherInput: 'SAVE',
    setVoucherInput() {}, voucherApplied: { ok: true, voucher: { code: 'SAVE' } }, setVoucherApplied() {},
    voucherDiscount: 1.5, quoteState: { status, quote: quote(voucher), error: 'error.codeInvalid' },
    paymentMethods: [], shoppingContext: { mode: 'standard' }, profile: 'guest',
  }));
}
test('checkout shows applied voucher only after successful current quote', () => {
  assert.match(render('ready', { code: 'SAVE', valid: true, matches_cart: true }), /ws-co-voucher__badge/);
  for (const status of ['loading','error']) {
    const html = render(status, { code: 'SAVE', valid: false, matches_cart: false });
    assert.doesNotMatch(html, /ws-co-voucher__badge/);
    assert.match(html, /ws-co-voucher__remove/);
  }
});
function apiFixture(result) {
  const calls = [];
  const window = { WSAuth: { authHeaders: () => ({}), authenticatedFetch: async (url, request) => {
    calls.push({ url, request }); return { ok: true, json: async () => result };
  } } };
  vm.runInNewContext(fs.readFileSync(new URL('../webshop-quote-api.jsx', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, ''),
    { window, basketShoppingContext, normaliseShoppingContext });
  window.WSQuote.endpoint = '/webshop/cart/quote';
  return { api: window.WSQuote, calls };
}
test('voucher preview sends no client price and never redeems or reserves', async () => {
  const { api, calls } = apiFixture(quote({ code: 'SAVE', valid: true, matches_cart: true }));
  await api.quote({ shopId: 2, basket: [{ line: 1, productId: 10, qty: 1, price: 0.01, offerDiscount: 999 }], voucherCode: 'SAVE' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/webshop/cart/quote');
  const body = JSON.parse(calls[0].request.body);
  assert.equal(body.voucher_code, 'SAVE');
  assert.equal(body.products[0].price, undefined);
  assert.equal(body.products[0].offerDiscount, undefined);
});
test('quote pins the automatic promotion already selected in the basket', async () => {
  const { api, calls } = apiFixture({
    items: [{ line_key: 'web-sandwich', unit_gross_price: '10.00', total_gross_value_after_discount: '8.50' }],
    totals: { gross_before_discount: '10.00', discount: '1.50', gross_after_discount: '8.50' },
  });
  await api.quote({ shopId: 2, basket: [
    { line: 'sandwich', productId: 1300012, qty: 25, promotion_id: 13, promotion_group: 'promotion-1-13' },
  ] });
  const body = JSON.parse(calls[0].request.body);
  assert.equal(body.selected_automatic_promotion_id, 13);
  assert.equal(body.products[0].promotion_group, 'promotion-1-13');
  assert.equal(body.products[0].promotion_id, 13);
});
test('quote and order preserve the same weight without sending client prices', async () => {
  const basket = [{ line: 1, productId: 10, qty: 1, weight_grams: 375, price: 0.01 }];
  const { api, calls } = apiFixture(quote(null));
  await api.quote({ shopId: 2, basket });
  const quotedLine = JSON.parse(calls[0].request.body).products[0];
  const mapping = source.match(/basket: (basket\.map\(\(l\) => .*\)),/)[1];
  const [orderedLine] = vm.runInNewContext(mapping, { basket, normaliseShoppingContext });
  assert.equal(quotedLine.weight_grams, 375);
  assert.equal(orderedLine.weight_grams, quotedLine.weight_grams);
  assert.equal(orderedLine.price, undefined);
});
test('malformed or mismatched quote cannot enable checkout with a zero fallback', async () => {
  for (const response of [{}, { ...quote(null), totals: {} }, { ...quote(null), items: [] },
    { ...quote(null), totals: { ...quote(null).totals, gross_after_discount: null } }]) {
    const { api } = apiFixture(response);
    await assert.rejects(api.quote({ shopId: 2, basket: [{ line: 1, productId: 10, qty: 1 }] }), /error.quote/);
  }
});

test('removing legacy vouchers preserves navigation deep links without accepting the code', () => {
  const window = { location: { search: '?shop=2&mode=collect&voucher=save&category=bread&sub=roll&product=10&open=product' } };
  vm.runInNewContext(fs.readFileSync(new URL('../webshop-deep-link.js', import.meta.url),'utf8'), { window, URLSearchParams });
  assert.deepEqual(JSON.parse(JSON.stringify(window.parseDeepLink())), {
    shopId:'2',mode:'collect',voucher:'SAVE',cat:'bread',sub:'roll',productId:'10',openProduct:'10',
  });
  assert.equal(window.WSVouchers, undefined);
});

const promotionSummaryContext = {};
vm.runInNewContext(extract('wsPromotionItemsSummary'), promotionSummaryContext);
const plMessages = JSON.parse(fs.readFileSync(new URL('../public/locales/pl.json', import.meta.url), 'utf8'));
const promotionTranslate = (key, params) => Object.entries(params || {}).reduce((text, [name, value]) => text.replace(`{${name}}`, value), plMessages[key]);

test('fractional offer distinguishes four paid quarters from the free quarter', () => {
  const summary = promotionSummaryContext.wsPromotionItemsSummary({
    promotion_type: 'BUY_X_GET_Y', reward: { type: 'FREE' },
    items: [{ product_name: 'Quiche', product_portion_type: 'ONE_QUARTER', quantity: 5,
      role: 'trigger_and_reward', trigger_quantity: 4, reward_quantity: 1 }],
  }, {}, promotionTranslate);
  assert.equal(summary, 'Kup 4 × 1/4 Quiche + odbierz 1 × 1/4 Quiche gratis');
});

test('reduced-price reward is described without promising a free product', () => {
  const summary = promotionSummaryContext.wsPromotionItemsSummary({
    promotion_type: 'BUY_X_GET_Y', reward: { type: 'FIXED_PRICE' },
    items: [{ product_name: 'Quiche', quantity: 2,
      role: 'trigger_and_reward', trigger_quantity: 1, reward_quantity: 1 }],
  }, {}, promotionTranslate);
  assert.equal(summary, 'Kup 1 × 1/1 Quiche + odbierz 1 × 1/1 Quiche w cenie promocyjnej');
});

test('different trigger and reward products retain their separate portions', () => {
  const summary = promotionSummaryContext.wsPromotionItemsSummary({
    promotion_type: 'BUY_X_GET_Y', reward: { type: 'FREE' },
    items: [{ product_name: 'Quiche', product_portion_type: 'ONE_HALF', quantity: 2, role: 'trigger' },
      { product_name: 'Tarta', product_portion_type: 'ONE_QUARTER', quantity: 1, role: 'reward' }],
  }, {}, promotionTranslate);
  assert.equal(summary, 'Kup 2 × 1/2 Quiche · odbierz 1 × 1/4 Tarta gratis');
});

test('older offer responses still show their total composition', () => {
  assert.equal(promotionSummaryContext.wsPromotionItemsSummary({ promotion_type: 'BUY_X_GET_Y',
    items: [{ product_name: 'Quiche', quantity: 2, role: 'trigger_and_reward' }],
  }, {}, promotionTranslate), '2 × 1/1 Quiche');
});

vm.runInNewContext(transformSync(['wsFractionalPromotionRule', 'FractionalPromotionRule'].map(extract).join('\n'), { loader: 'jsx' }).code, Object.assign(promotionSummaryContext, { React }));
const fractionalOffer = {
  promotion_type: 'BUY_X_GET_Y', trigger: { quantity: 1, quantity_unit: 'PIECE_FRACTION', any_portion: true },
  reward: { type: 'FREE' }, items: [
    { product_name: 'Quiche', quantity: 1, role: 'trigger' },
    { product_name: 'Quiche', product_portion_type: 'ONE_QUARTER', quantity: 1, role: 'reward' },
  ],
};
const fractionalProduct = { portionOptions: [{ v: 'entier' }, { v: 'demi' }, { v: 'quart' }] };

test('fractional rule explains combinations independently of the selected portion', () => {
  const rule = promotionSummaryContext.wsFractionalPromotionRule(fractionalOffer, fractionalProduct, promotionTranslate);
  assert.match(rule.description, /dowolnej konfiguracji/);
  assert.match(rule.examples, /1 × 1\/1/);
  assert.match(rule.examples, /2 × 1\/2/);
  assert.match(rule.examples, /4 × 1\/4/);
  assert.match(rule.examples, /1 × 1\/2 \+ 2 × 1\/4/);
  assert.equal(rule.reward, 'odbierz 1 × 1/4 Quiche gratis');
});

test('examples omit portions absent from the product catalogue', () => {
  const rule = promotionSummaryContext.wsFractionalPromotionRule(fractionalOffer, { portionOptions: [{ v: 'quart' }] }, promotionTranslate);
  assert.match(rule.examples, /4 × 1\/4/);
  assert.doesNotMatch(rule.examples, /1\/2|1\/1|1\/8/);
});

test('restricted trigger portions do not claim the example combinations qualify', () => {
  const rule = promotionSummaryContext.wsFractionalPromotionRule({ ...fractionalOffer, trigger: { ...fractionalOffer.trigger, any_portion: false } }, fractionalProduct, promotionTranslate);
  assert.equal(rule.examples, '');
  assert.match(rule.description, /kwalifikujące/);
});

test('rendered explanation includes the exact reward and excludes it from paid quantity', () => {
  const html = renderToStaticMarkup(React.createElement(promotionSummaryContext.FractionalPromotionRule, { promotion: fractionalOffer, product: fractionalProduct, t: promotionTranslate }));
  assert.match(html, /pdm-promotion__rule/);
  assert.match(html, /1 × 1\/4 Quiche gratis/);
  assert.match(html, /Nagroda nie wlicza się/);
});

test('item-count promotions keep their existing description', () => {
  assert.equal(promotionSummaryContext.wsFractionalPromotionRule({ ...fractionalOffer, trigger: { quantity: 1, quantity_unit: 'ITEM' } }, fractionalProduct, promotionTranslate), null);
});

const basketContext = { ...context, ICONS: { back: null, pin: null }, wsTap: () => ({}) };
vm.runInNewContext(transformSync(extract('Basket'), { loader: 'jsx' }).code, basketContext);
function renderBasketPricing(status) {
  const old = { items: [{ line_key: 'web-1', total_gross_value_after_discount: '59.60' }], totals: { gross_before_discount: '59.60', gross_after_discount: '59.60', discount: '0.00' } };
  const current = { items: [...old.items, { line_key: 'web-2', total_gross_value_after_discount: '27.60' }], totals: { gross_before_discount: '94.10', gross_after_discount: '87.20', discount: '6.90' } };
  return renderToStaticMarkup(React.createElement(basketContext.Basket, {
    mode: 'collect', shop: { id: 2, address: 'Test shop' },
    basket: [{ line: 1, productId: 1, name: 'Quiche', qty: 4, options: [] },
      { line: 2, productId: 2, name: 'Quarters', qty: 5, options: [], promotion_group: 'offer-2' }],
    quoteState: { status, quote: status === 'ready' ? current : old, error: 'Pricing failed' },
  }));
}

test('a failed or pending basket quote shows unavailable prices instead of zero or stale totals', () => {
  for (const status of ['error', 'loading']) {
    const html = renderBasketPricing(status);
    assert.doesNotMatch(html, /€0.00|€59.60/);
    assert.match(html, /class="ws-line__price">—/);
    assert.match(html, /class="ws-basket__total-amount">—/);
    assert.match(html, /disabled=""/);
  }
});

test('a successful quote displays ordinary purchases and the additional discounted group price', () => {
  const html = renderBasketPricing('ready');
  assert.match(html, /€59.60/);
  assert.match(html, /€27.60/);
  assert.match(html, /€87.20/);
});


test('product preview identifies its synthetic line without marking ordinary cart quotes', async () => {
  const { api, calls } = apiFixture(quote(null));
  const basket = [{ line: 1, productId: 10, qty: 2 }];
  await api.quote({ shopId: 2, basket, promotionPreviewLineKey: 1 });
  const preview = JSON.parse(calls[0].request.body);
  assert.equal(preview.promotion_preview_line_key, preview.products[0].line_key);
  await api.quote({ shopId: 2, basket });
  assert.equal(JSON.parse(calls[1].request.body).promotion_preview_line_key, undefined);
});


const progressContext = { React, wsCurrency: value => `€${Number(value).toFixed(2)}` };
vm.runInNewContext(transformSync(extract('PromotionReceiptProgress'), { loader: 'jsx' }).code, progressContext);
test('locked promotion shows the server missing amount and accessible basket progress', () => {
  const html = renderToStaticMarkup(React.createElement(progressContext.PromotionReceiptProgress, {
    promotion: { minimum_receipt_gross: '20.00', minimum_receipt_missing: '7.00', is_available: false }, t: promotionTranslate,
  }));
  assert.match(html, /Brakuje Ci jeszcze €7.00/);
  assert.match(html, /<progress max="20" value="13" aria-label=/);
});
test('unlocked promotions and offers without a receipt minimum have no locked progress', () => {
  for (const promotion of [{ minimum_receipt_gross: '20.00', is_available: true }, { is_available: false }]) {
    assert.equal(renderToStaticMarkup(React.createElement(progressContext.PromotionReceiptProgress, { promotion, t: promotionTranslate })), '');
  }
});

const cartRewardOffer = { id_promotion: 17, name: 'Quiche offer', status: 'AVAILABLE',
  trigger: { quantity: 1, quantity_unit: 'PIECE_FRACTION' }, reward_quantity: 1,
  trigger_items: [{ id_product: 10, product_name: 'Quiche', product_portion_type: 'ONE_QUARTER', quantity: 4 }],
  options: [{ id_product: 10, id_product_portion: 3, product_name: 'Quiche', product_portion_type: 'ONE_QUARTER', quantity: 1 }],
};

const inlineRewardContext = { React, wsCurrency: value => `€${Number(value).toFixed(2)}`, wsPromotionItemsSummary: promotionSummaryContext.wsPromotionItemsSummary };
vm.runInNewContext(transformSync(extract('PromotionRewardChoices'), { loader: 'jsx' }).code, inlineRewardContext);
test('inline gift choices expose selection, catalogue pictures and honest free or discounted prices', () => {
  const html = renderToStaticMarkup(React.createElement(inlineRewardContext.PromotionRewardChoices, {
    options: [{ ...cartRewardOffer.options[0], image_src: '/photos/quiche.webp', regular_price: 6.30, additional_cost_gross: '0.00' },
      { ...cartRewardOffer.options[0], id_product: 20, product_name: 'Apricot', regular_price: 8.90, additional_cost_gross: '2.00' }],
    selectedKey: '20-3', onSelect() {}, t: promotionTranslate,
  }));
  assert.match(html, /role="radiogroup"/);
  assert.equal((html.match(/role="radio"/g) || []).length, 2);
  assert.equal((html.match(/aria-checked="true"/g) || []).length, 1);
  assert.match(html, /src="\/photos\/quiche.webp"/);
  assert.match(html, /<del>€6.30<\/del>/);
  assert.match(html, /Gratis/);
  assert.match(html, /€2.00/);
  assert.doesNotMatch(html, /role="dialog"/);
});

test('a reward option with an actual surcharge is not described as free', () => {
  const text = promotionSummaryContext.wsPromotionItemsSummary({ ...cartRewardOffer, promotion_type: 'BUY_X_GET_Y', reward: { type: 'FREE' }, items: [{ ...cartRewardOffer.options[0], role: 'reward' }] }, {}, promotionTranslate, '2.00');
  assert.doesNotMatch(text, /gratis/);
  assert.match(text, /w cenie promocyjnej/);
});

test('basket omits availability banners even when the API returns unlocked offers and rewards', () => {
  const html = renderToStaticMarkup(React.createElement(basketContext.Basket, {
    mode: 'collect', shop: { id: 2 }, basket: [{ line: 1, productId: 10, name: 'Sandwich', qty: 1, options: [] }],
    quoteState: { status: 'ready', quote: {
      items: [{ line_key: 'web-1', total_gross_value_after_discount: '0.90' }],
      totals: { gross_before_discount: '0.90', gross_after_discount: '0.90', discount: '0.00' },
      unlocked_promotions: [{ id_promotion: 2, name: 'Unlocked offer', status: 'UNLOCKED' }],
      promotion_rewards: [{ id_promotion: 3, name: 'Available gift', status: 'AVAILABLE' }],
    } },
  }));
  assert.doesNotMatch(html, /ws-cart-reward|Unlocked offer|Available gift|cart\.unlocked|cart\.reward/);
  assert.match(html, /Sandwich/);
});

test('reward discount is counted once and changes invalidate checkout even at equal totals', () => {
  const original = {...quote(null),loyalty_reward:{id:1,line_index:0,discount:'1.50'}};
  const total = context.wsQuoteTotals(original,0);
  assert.equal(total.reward,1.50); assert.equal(total.remise,0); assert.equal(total.total,8.50);
  const changed = {...original,loyalty_reward:{...original.loyalty_reward,id:2}};
  assert.notDeepEqual(context.wsCheckoutQuoteComparable(original),context.wsCheckoutQuoteComparable(changed));
});
