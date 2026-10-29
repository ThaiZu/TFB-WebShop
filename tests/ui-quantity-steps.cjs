/* Local storefront with controlled API responses; no orders or payments. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const base = process.env.WS_UI_URL || 'http://127.0.0.1:5175/WebShop/';
  const origin = new URL(base).origin;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const { width, stockLimit } of [{ width: 1440 }, { width: 390 }, { width: 320 }, { width: 390, stockLimit: 7 }]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 600, hasTouch: width < 600 });
      await context.addInitScript(() => localStorage.setItem('ws.lang', 'fr'));
      const errors = [], quotes = [];
      let showUpcoming = true;
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (!url.pathname.includes('/api/v1/')) return route.continue();
        let body = [];
        if (url.pathname.endsWith('/shops')) {
          body = [{ id: 2, name: 'Test shop', default_lang: 'fr', languages: 'pl,fr,nl', collect_enabled: 1, delivery_enabled: 1 }];
        } else if (url.pathname.endsWith('/products/available')) {
          body = [{ id: 10, name: 'Sandwich', id_category: 70, is_active: 1, webshop_active: 1, webshop_bulk_quantity_enabled: 1,
            click_and_collect: 1, is_divisible: 0, is_piece_based: 1,
            category: { id: 70, name: 'Sandwich', groups: [] },
            webshop: { price_gross: '0.90', allergen_codes: [] }, portions: [], availability_periods: [],
            inventory_initialized_at: '2026-10-28 00:00:00',
            webshop_availability: stockLimit == null ? { status: 'not_enforced', inventory_enforced: false, quantity_available: null } : { status: 'available', inventory_enforced: true, quantity_available: stockLimit } }];
        } else if (url.pathname.endsWith('/cart/quote')) {
          const payload = request.postDataJSON();
          quotes.push(payload);
          const offer = { id_promotion: 17, name: 'Pistolekes en Sandwichke van de weekend',
            promotion_type: 'BUY_X_GET_Y', reward: { type: 'FREE' }, discount_total: '4.50',
            minimum_receipt_gross: '20.00', is_available: false,
            items: [{ id_product: 10, product_name: 'Sandwich', quantity: 20,
              role: 'trigger_and_reward', trigger_quantity: 15, reward_quantity: 5 }],
            available_from: '2026-10-31T06:00:00+01:00', timezone: 'Europe/Brussels',
            availability_valid_from: '2026-10-19T00:00:00+02:00', availability_valid_to: '2027-10-18T23:59:59+02:00',
            availability_schedule: [6, 7].map(day_of_week => ({ day_of_week, time_from: '06:00', time_to: '18:00' })) };
          const gross = payload.products.reduce((sum, line) => sum + Number(line.quantity) * 0.9, 0).toFixed(2);
          body = { items: payload.products.map(line => ({ ...line, unit_gross_price: '0.90', total_gross_value_after_discount: (Number(line.quantity) * 0.9).toFixed(2) })),
            totals: { gross_before_discount: gross, gross_after_discount: gross, discount: '0.00' },
            promotion_rewards: [{ id_promotion: 70, name: 'Reward banner', status: 'AVAILABLE', options: [{ id_product: 10, quantity: 1 }] }],
            unlocked_promotions: [{ id_promotion: 71, name: 'Unlocked banner', status: 'UNLOCKED', options: [{ id_product: 10, quantity: 1 }] }],
            promotion_suggestions: [], upcoming_promotion_suggestions: showUpcoming ? [offer,
              { ...offer, id_promotion: 18, name: 'Unrelated product offer', items: [{ id_product: 999, quantity: 1 }] }] : [] };
        } else if (url.pathname.endsWith('/config') || url.pathname.endsWith('/brand')) {
          body = {};
        } else if (url.pathname.endsWith('/availability/slots')) {
          body = [{ id: 1, label: '12:00 – 14:00', start: '12:00', end: '14:00', available: true }];
        }
        return route.fulfill({ json: body });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}?shop=2&category=category%3A70`);
      await page.locator('.ws-card .ws-add').first().click();
      const quick = page.locator('.pdm-quick-qty');
      const value = page.locator('.pdm-qty__val');
      const plus = page.locator('.pdm-qty__btn').last();
      const minus = page.locator('.pdm-qty__btn').first();
      const preset = amount => quick.getByText(String(amount), { exact: true });
      await quick.waitFor();
      assert.equal(await value.innerText(), '1');
      assert.equal(await quick.getByRole('button').count(), 4);
      assert.match(await quick.innerText(), /Choisir la quantité/);
      assert.equal(await page.locator('.pdm-qty-picker, .pdm-qty-step').count(), 0);
      assert.equal(await minus.isDisabled(), true);
      const placement = await quick.evaluate(element => {
        const box = element.getBoundingClientRect();
        return box.bottom <= document.querySelector('.pdm-qty').getBoundingClientRect().top + 1
          && box.bottom <= document.querySelector('.pdm-cta').getBoundingClientRect().top + 1;
      });
      assert.equal(placement, true, 'quick choices sit above both the counter and the cart button');
      await preset(1).click();
      assert.equal(await value.innerText(), '1', 'the first click selects one');
      await preset(1).click();
      assert.equal(await value.innerText(), '2', 'repeating the same choice adds its quantity');
      await preset(5).click();
      assert.equal(await value.innerText(), '5', 'choosing another amount sets that quantity');
      if (stockLimit != null) {
        assert.equal(await preset(10).isDisabled(), true);
        assert.equal(await preset(25).isDisabled(), true);
        await plus.click();
        assert.equal(await value.innerText(), '6');
        await preset(5).click();
        assert.equal(await value.innerText(), '7', 'repeated quantities stop at available stock');
        assert.equal(await plus.isDisabled(), true);
        assert.equal(await preset(5).isDisabled(), true);
      } else {
        await preset(10).click();
        assert.equal(await value.innerText(), '10');
        await preset(25).click();
        assert.equal(await value.innerText(), '25');
        await plus.click();
        assert.equal(await value.innerText(), '26');
        await preset(25).click();
        assert.equal(await value.innerText(), '51', '25, plus, 25 yields exactly 51');
        assert.match(await page.locator('.pdm-cta').innerText(), /45[,.]90/);
      }
      const expected = stockLimit ?? 51;
      await minus.click();
      assert.equal(Number(await value.innerText()), expected - 1, 'minus removes one');
      await plus.click();
      assert.equal(Number(await value.innerText()), expected, 'plus adds one');
      const subtract = page.locator('.pdm-qty-subtract');
      assert.equal(await subtract.getByRole('button').count(), 3);
      assert.equal(await subtract.evaluate(element => element.getBoundingClientRect().top >= document.querySelector('.pdm-qty').getBoundingClientRect().bottom), true, 'subtract choices sit below the counter');
      let reduced = expected;
      for (const amount of [1, 5, 10]) {
        if (reduced <= 1) break;
        await subtract.getByText(`−${amount}`, { exact: true }).click();
        reduced = Math.max(1, reduced - amount);
        assert.equal(Number(await value.innerText()), reduced);
      }
      while (Number(await value.innerText()) > 1) await subtract.getByText('−10', { exact: true }).click();
      assert.equal(await value.innerText(), '1', 'bulk subtraction stops at one');
      assert.equal(await subtract.locator('button:disabled').count(), 3);
      // Restore the amount used by the existing cart and pricing assertions.
      await preset(1).click();
      if (stockLimit != null) {
        await preset(5).click();
        await preset(5).click();
      } else {
        await preset(25).click();
        await plus.click();
        await preset(25).click();
      }
      assert.equal(Number(await value.innerText()), expected);
      const overflow = await page.locator('.pdm-foot').evaluate(element => element.getBoundingClientRect().right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1);
      assert.equal(overflow, false);
      await page.waitForTimeout(250); // Let the existing price animation finish before the review screenshot.
      await page.screenshot({ path: `/tmp/webshop-quantity-${width}-${stockLimit ?? 'unlimited'}.png` });
      await page.locator('.pdm-cta').click();
      await page.locator('.pdm-cta').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.querySelector('.ws-basket__total-amount')?.textContent.includes('€'));
      if (width < 600) await page.locator('.ws-tabbar__btn--cart').click();
      const basket = width < 600 ? page.locator('.ws-drawer .ws-basket') : page.locator('.ws-basket').first();
      assert.equal(await basket.locator('.ws-cart-reward, .ws-cart-unlocked').count(), 0);
      assert.ok(quotes.some(quote => !quote.promotion_preview_line_key && quote.products.some(line => Number(line.quantity) === expected)), 'the cart API receives the exact selected quantity');
      if (width < 600) await page.locator('.ws-drawer__close').click();
      if (stockLimit == null) {
        await page.locator('.ws-card .ws-add').first().click();
        await value.waitFor();
        assert.equal(await value.innerText(), '1');
        await preset(25).click();
        assert.equal(await value.innerText(), '25', 'the first-choice behavior resets when reopening the product');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS quick quantity choices at ${width}px; stock=${stockLimit ?? 'unlimited'}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
