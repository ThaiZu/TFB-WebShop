import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('webshop-full-bundle.jsx', root), 'utf8');
const dictionaries = Object.fromEntries(['fr', 'nl', 'pl'].map((language) => [
  language,
  JSON.parse(fs.readFileSync(new URL(`public/locales/${language}.json`, root), 'utf8')),
]));

const confirmationKeys = [
  'shopConfirm.eyebrow', 'shopConfirm.title', 'shopConfirm.intro',
  'shopConfirm.continue', 'shopConfirm.change', 'shopConfirm.paymentLabel',
  'shopConfirm.clearBasketTitle', 'shopConfirm.clearBasketBody',
  'shopConfirm.clearBasketConfirm',
];

test('shop confirmation is translated in every supported storefront language', () => {
  for (const language of ['fr', 'nl', 'pl']) {
    for (const key of confirmationKeys) {
      assert.ok(dictionaries[language][key], `${language}.${key} must be present`);
    }
  }
  for (const language of ['nl', 'pl']) {
    assert.deepEqual(
      dictionaries[language]['shopConfirm.continue'].match(/\{\w+\}/g),
      dictionaries.fr['shopConfirm.continue'].match(/\{\w+\}/g),
      `${language} must retain the shop interpolation`,
    );
  }
});

test('login preserves an already chosen shop and confirms the actual order shop', () => {
  assert.match(source, /const WS_SHOP_CONFIRM_FALLBACKS = \{/);
  assert.match(source, /function wsShopConfirmText\(key, params\)[\s\S]*?translated !== key/);
  assert.match(source, /function handleLogin\(u\)[\s\S]*?u\.preferredShopId && shopId == null/);
  assert.doesNotMatch(source, /u\.preferredShopId && u\.preferredShopId !== shopId/);
  assert.match(source, /const orderingShop = \(shops \|\| \[\]\)\.find\(\(item\) => Number\(item\.id\) === Number\(cartShopId\)\) \|\| shop/);
  assert.match(source, /<OrderingShopConfirmation[\s\S]*?shop=\{orderingShop\}/);
  assert.match(source, /<CheckoutStep3[\s\S]*?shop=\{shop\}/);
  assert.match(source, /wsShopConfirmText\('shopConfirm\.continue'[\s\S]*?wsShopConfirmText\('shopConfirm\.change'/);
  const modal = source.slice(source.indexOf('function OrderingShopConfirmation'), source.indexOf('// =========================================================================\n// SHOP FRAME'));
  assert.doesNotMatch(modal, /shopConfirm\.(?:eyebrow|intro)/);
  assert.match(source, /<section className="ws-co-ordering-shop" aria-label=\{shop\.name\}>\s*<strong>\{shop\.name\}<\/strong>\s*<span>\{shop\.address\}<\/span>/);
  assert.equal(dictionaries.pl['shopConfirm.title'], 'Twoja pracownia');
  assert.equal(dictionaries.fr['shopConfirm.title'], 'Votre atelier');
});

test('changing a shop cannot silently retain a cart from another shop', () => {
  assert.match(source, /function requestShopChange\(id\)[\s\S]*?basket\.length && String\(cartShopId\) !== String\(id\)[\s\S]*?setPendingShopChange\(id\)/);
  assert.match(source, /shopConfirm\.clearBasketConfirm/);
  assert.match(source, /setBasket\(\[\]\); setVoucherApplied\(null\); setVoucherInput\(''\)/);
});
