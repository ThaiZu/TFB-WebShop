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
  wsNumber: value => Number(value).toFixed(2), Pict: () => null,
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
  assert.match(source, /promotion\.inline\.locked/);
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
  assert.equal(summary, 'Kup 1 × Quiche + odbierz 1 × Quiche w cenie promocyjnej');
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
  }, {}, promotionTranslate), '2 × Quiche');
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

const cartRewardContext = { getPlaceholder: () => '/img/placeholder.svg', React, useState: React.useState, wsCurrency: value => `€${Number(value).toFixed(2)}`, wsUseT: () => ({ t: promotionTranslate }), wsPromotionItemsSummary: promotionSummaryContext.wsPromotionItemsSummary };
vm.runInNewContext(transformSync(extract('CartPromotionRewards'), { loader: 'jsx' }).code, cartRewardContext);
const cartRewardOffer = { id_promotion: 17, name: 'Quiche offer', status: 'AVAILABLE',
  trigger: { quantity: 1, quantity_unit: 'PIECE_FRACTION' }, reward_quantity: 1,
  trigger_items: [{ id_product: 10, product_name: 'Quiche', product_portion_type: 'ONE_QUARTER', quantity: 4 }],
  options: [{ id_product: 10, id_product_portion: 3, product_name: 'Quiche', product_portion_type: 'ONE_QUARTER', quantity: 1 }],
};
function renderCartReward(status = 'ready', offer = cartRewardOffer, products = [{ id: 10, portionOptions: [{ id_product_portion: 3 }] }]) {
  return renderToStaticMarkup(React.createElement(cartRewardContext.CartPromotionRewards, {
    quoteState: { status, quote: { promotion_rewards: [offer] } }, onAddReward() {}, products,
  }));
}

test('qualified cart shows the server condition and reward chooser', () => {
  const html = renderCartReward();
  assert.match(html, /Możesz dobrać gratis/);
  assert.match(html, /4 × 1\/4 Quiche/);
  assert.match(html, /Wybierz gratis/);
  assert.match(html, /Zasady promocji/);
  assert.match(html, /Nagroda nie wlicza/);
});

test('pending and failed quotes hide outdated reward entitlement', () => {
  assert.equal(renderCartReward('loading'), '');
  assert.equal(renderCartReward('error'), '');
});

test('applied reward has no add button', () => {
  const html = renderCartReward('ready', { ...cartRewardOffer, status: 'APPLIED', options: [] });
  assert.match(html, /Gratis dodany/);
  assert.doesNotMatch(html, /Wybierz gratis/);
});

test('rewards absent from the current catalogue are not offered', () => {
  assert.doesNotMatch(renderCartReward('ready', cartRewardOffer, []), /Możesz dobrać gratis/);
  assert.doesNotMatch(renderCartReward('ready', cartRewardOffer, [{ id: 10, portionOptions: [] }]), /Możesz dobrać gratis/);
});

const modalContext = { React, createPortal: (element) => element, document: { body: {} },
  wsPromotionItemsSummary: promotionSummaryContext.wsPromotionItemsSummary,
  wsCurrency: (value) => `€${Number(value).toFixed(2)}` };
vm.runInNewContext(transformSync(extract('CartRewardModal'), { loader: 'jsx' }).code, modalContext);
test('reward modal shows every eligible choice with its own server-calculated extra cost', () => {
  const options = [{ ...cartRewardOffer.options[0], additional_cost_gross: '0.00' },
    { ...cartRewardOffer.options[0], id_product: 11, product_name: 'Other quiche', additional_cost_gross: '4.00' }];
  const html = renderToStaticMarkup(React.createElement(modalContext.CartRewardModal, {
    promotion: cartRewardOffer, options, onSelect() {}, onClose() {}, t: promotionTranslate,
  }));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Other quiche/);
  assert.match(html, /Bez dopłaty/);
  assert.match(html, /Dopłata do koszyka: €4.00/);
  assert.match(html, /najtańszy/);
});

test('cart reward rules display the API receipt minimum without deciding it in the browser', () => {
  const html = renderCartReward('ready', { ...cartRewardOffer, minimum_receipt_gross: '50.00' });
  assert.match(html, /€50.00/);
  assert.match(html, /przed rabatami/);
  assert.match(html, /bez dostawy/);
});

const basketContext = { ...context, ICONS: { back: null, pin: null }, wsTap: () => ({}), CartPromotionRewards: () => null, CartUnlockedPromotions: () => null };
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


const unlockedContext = { React, useState: React.useState, wsUseT: () => ({ t: promotionTranslate }),
  wsCurrency: value => `€${Number(value).toFixed(2)}`,
  getPlaceholder: () => '/img/placeholder.svg',
  portionOptionList: product => product.portionOptions || [{ id_product_portion: null }] };
vm.runInNewContext(transformSync(extract('CartUnlockedPromotions'), { loader: 'jsx' }).code, unlockedContext);
const unlockedOffer = { id_promotion: 2, name: 'Exclusive offer', minimum_receipt_gross: '50.00', status: 'UNLOCKED',
  options: [{ id_product: 10, id_product_portion: null, quantity: 1 }] };
function renderUnlocked(status = 'ready', unlocked = [unlockedOffer], rewards = [], extra = {}) {
  return renderToStaticMarkup(React.createElement(unlockedContext.CartUnlockedPromotions, {
    quoteState: { status, quote: { unlocked_promotions: unlocked, promotion_rewards: rewards } },
    products: [{ id: 10 }], onBrowsePromotion() {}, ...extra,
  }));
}
test('unlocked level has a clear invitation without claiming the discount is already applied', () => {
  const html = renderUnlocked();
  assert.match(html, /Odblokowane promocje/);
  assert.match(html, /Osiągnięto próg €50.00/);
  assert.match(html, /Rabat wymaga wybrania produktów/);
  assert.match(html, /Zobacz produkty/);
  assert.doesNotMatch(html, /Gratis został dodany/);
});
test('unlocked offers disappear below the level, during repricing, with errors and after a group selection', () => {
  for (const status of ['loading', 'error', 'idle']) assert.equal(renderUnlocked(status), '');
  assert.doesNotMatch(renderUnlocked('ready', []), /Exclusive offer/);
  assert.equal(renderUnlocked('ready', [unlockedOffer], [], { locked: true }), '');
  assert.doesNotMatch(renderUnlocked('ready', [unlockedOffer], [], { products: [] }), /Exclusive offer/);
});
test('one promotion is not repeated alongside its existing reward picker', () => {
  assert.doesNotMatch(renderUnlocked('ready', [unlockedOffer], [{ id_promotion: 2 }]), /Exclusive offer/);
});
test('the exclusive product chooser does not promise a free product or a zero surcharge', () => {
  const html = renderToStaticMarkup(React.createElement(modalContext.CartRewardModal, {
    promotion: unlockedOffer, options: unlockedOffer.options, onSelect() {}, onClose() {}, t: promotionTranslate,
    titleKey: 'cart.unlocked.browse', explanationKey: 'cart.unlocked.chooseProduct', showCost: false,
  }));
  assert.match(html, /Zobacz produkty/);
  assert.match(html, /Samo osiągnięcie progu nie nalicza rabatu/);
  assert.doesNotMatch(html, /Bez dopłaty|najtańszy|Wybierz gratis/);
});


test('an automatically applied bundle is described as an applied promotion rather than a free gift', () => {
  const html = renderUnlocked('ready', [{ ...unlockedOffer, promotion_type: 'BUNDLE_PROMOTION', status: 'APPLIED' }]);
  assert.match(html, /Promocja została naliczona/);
  assert.doesNotMatch(html, /Gratis dodany|Zobacz produkty/);
});


test('exclusive product buttons render small lazy images without changing their catalogue URLs', () => {
  const options = [{ ...unlockedOffer.options[0], image_src: '/photos/apricot.webp', image_fallback: '/img/placeholder.svg' },
    { ...unlockedOffer.options[0], id_product_portion: 3, image_src: '/photos/apricot.webp', image_fallback: '/img/placeholder.svg' }];
  const html = renderToStaticMarkup(React.createElement(modalContext.CartRewardModal, {
    promotion: unlockedOffer, options, onSelect() {}, onClose() {}, t: promotionTranslate,
    titleKey: 'cart.unlocked.browse', explanationKey: 'cart.unlocked.chooseProduct', showCost: false, productCards: true,
  }));
  assert.match(html, /ws-cart-reward__options--products/);
  assert.equal((html.match(/src="\/photos\/apricot.webp"/g) || []).length, 2);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 2);
  assert.equal((html.match(/decoding="async"/g) || []).length, 2);
  assert.match(html, /alt="" width="52" height="52"/);
});


test('reward chooser keeps the server surcharge alongside lazy catalogue thumbnails', () => {
  const html = renderToStaticMarkup(React.createElement(modalContext.CartRewardModal, {
    promotion: cartRewardOffer,
    options: [{ ...cartRewardOffer.options[0], image_src: '/photos/quiche.webp', image_fallback: '/img/placeholder.svg', additional_cost_gross: '1.00' }],
    onSelect() {}, onClose() {}, t: promotionTranslate, productCards: true,
  }));
  assert.match(html, /ws-cart-reward__options--products/);
  assert.match(html, /src="\/photos\/quiche.webp"/);
  assert.match(html, /loading="lazy" decoding="async"/);
  assert.match(html, /ws-promotion-product__body/);
  assert.match(html, /Dopłata do koszyka: €1.00/);
});
