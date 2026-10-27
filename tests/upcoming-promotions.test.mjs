import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';

const source = fs.readFileSync(new URL('../webshop-full-bundle.jsx', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const context = { React, wsCurrency: value => `${Number(value).toFixed(2)} €` };
vm.runInNewContext(transformSync([
  'wsPromotionItemsSummary', 'wsFractionalPromotionRule', 'FractionalPromotionRule',
  'wsPromotionBenefit', 'wsPromotionDateLabel', 'wsPromotionWeekday',
  'wsUpcomingPromotionSchedule', 'wsUpcomingPromotionValidity',
  'UpcomingPromotionSchedule', 'UpcomingPromotionCard',
].map(extract).join('\n'), { loader: 'jsx' }).code, context);

export const promotion = {
  id_promotion: 17, name: 'Pistolekes en Sandwichke van de weekend',
  promotion_type: 'BUY_X_GET_Y', reward: { type: 'FREE' }, discount_total: '4.50',
  items: [{ id_product: 10, product_name: 'Sandwich', quantity: 20,
    role: 'trigger_and_reward', trigger_quantity: 15, reward_quantity: 5 }],
  timezone: 'Europe/Brussels',
  availability_schedule: [6, 7].map(day_of_week => ({ day_of_week, time_from: '06:00', time_to: '18:00' })),
  availability_valid_from: '2026-10-19T00:00:00+02:00',
  availability_valid_to: '2027-10-18T23:59:59+02:00',
};
export function renderOffer(offer = promotion, lang = 'fr') {
  const messages = JSON.parse(fs.readFileSync(new URL(`../public/locales/${lang}.json`, import.meta.url), 'utf8'));
  const t = (key, params = {}) => {
    assert.ok(messages[key], `Missing ${lang} translation: ${key}`);
    return Object.entries(params).reduce((text, [key, value]) => text.replace(`{${key}}`, value), messages[key]);
  };
  return renderToStaticMarkup(React.createElement(context.UpcomingPromotionCard, {
    promotion: offer, product: { id: 10, name: 'Sandwich' }, lang, t,
  }));
}

test('future offer has seven weekday badges and highlights only Saturday and Sunday', () => {
  const html = renderOffer();
  assert.equal((html.match(/class="pdm-promotion__day(?: is-active)?"/g) || []).length, 7);
  assert.equal((html.match(/class="pdm-promotion__day is-active"/g) || []).length, 2);
  assert.match(html, /Le week-end, de 06:00 à 18:00/);
  assert.match(html, /19 octobre 2026/);
  assert.match(html, /18 octobre 2027/);
  assert.match(html, /−4.50 €/);
});

test('future offers have no selection controls, even when their receipt minimum is met', () => {
  for (const is_available of [true, false]) {
    const html = renderOffer({ ...promotion, is_available, minimum_receipt_gross: '20.00' });
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /20.00 €/);
    assert.doesNotMatch(html, /<button|<input|tabindex|aria-pressed/);
  }
});

test('different hours and multiple windows on one day are preserved', () => {
  const html = renderOffer({ ...promotion, availability_schedule: [
    { day_of_week: 1, time_from: '06:00', time_to: '10:00' },
    { day_of_week: 1, time_from: '14:00', time_to: '18:00' },
    { day_of_week: 6, time_from: '08:00', time_to: '12:00' },
  ] });
  for (const hours of ['06:00 à 10:00', '14:00 à 18:00', '08:00 à 12:00']) assert.ok(html.includes(hours));
  assert.equal((html.match(/class="pdm-promotion__day is-active"/g) || []).length, 2);
});

test('unrestricted schedule highlights every day without inventing hours or date bounds', () => {
  const html = renderOffer({ ...promotion, availability_schedule: [], availability_valid_from: null, availability_valid_to: null });
  assert.equal((html.match(/class="pdm-promotion__day is-active"/g) || []).length, 7);
  assert.match(html, /tous les jours/);
  assert.doesNotMatch(html, /pdm-promotion__validity|06:00|Invalid Date/);
});

test('validity dates use the shop timezone around midnight', () => {
  assert.match(context.wsPromotionDateLabel('2026-10-18T22:30:00Z', 'fr', 'Europe/Brussels'), /19 octobre 2026/);
  assert.equal(context.wsPromotionDateLabel('invalid', 'fr', 'Europe/Brussels'), '');
});

test('the calendar is translated in every storefront language', () => {
  for (const lang of ['fr', 'nl', 'pl']) {
    const html = renderOffer(promotion, lang);
    assert.doesNotMatch(html, /promotion\.inline\./);
    assert.match(html, /06:00/);
  }
});
