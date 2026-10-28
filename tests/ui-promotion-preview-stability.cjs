/* Local storefront with controlled API responses; no orders or payments. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const base = process.env.WS_UI_URL || 'http://127.0.0.1:5175/WebShop/';
  const origin = new URL(base).origin;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
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
          body = [{ id: 10, name: 'Sandwich', id_category: 70, is_active: 1, webshop_active: 1,
            click_and_collect: 1, is_divisible: 0, is_piece_based: 1,
            category: { id: 70, name: 'Sandwich', groups: [] },
            webshop: { price_gross: '0.90', allergen_codes: [] }, portions: [{id:7,portion_type:'ONE_HALF',is_active:1,is_ready_for_sale:1,shop_price_gross:'0.45'}], availability_periods: [],
            webshop_availability: { status: 'not_enforced', inventory_enforced: false, quantity_available: null } }];
        } else if (url.pathname.endsWith('/cart/quote')) {
          const payload = request.postDataJSON();
          quotes.push(payload);
          const target = payload.products.find(line => line.line_key === payload.promotion_preview_line_key);
          const quantity = Number(target?.quantity);
          if (quantity === 7) return route.fulfill({ status: 422, json: { error: 'Pricing unavailable' } });
          await new Promise(resolve => setTimeout(resolve, quantity === 5 ? 1000 : quantity === 6 ? 100 : 400));
          const offer = { id_promotion: 17, name: 'Pistolekes en Sandwichke van de weekend',
            promotion_type: 'BUY_X_GET_Y', reward: { type: 'FREE' }, discount_total: '4.50',
            minimum_receipt_gross: '20.00', is_available: false,
            items: [{ id_product: 10, product_name: 'Sandwich', quantity: 20,
              role: 'trigger_and_reward', id_product_portion: target?.id_product_portion ?? null, trigger_quantity: 15, reward_quantity: 5 }],
            available_from: '2026-10-31T06:00:00+01:00', timezone: 'Europe/Brussels',
            availability_valid_from: '2026-10-19T00:00:00+02:00', availability_valid_to: '2027-10-18T23:59:59+02:00',
            availability_schedule: [6, 7].map(day_of_week => ({ day_of_week, time_from: '06:00', time_to: '18:00' })) };
          const gross = payload.products.reduce((sum, line) => sum + Number(line.quantity) * 0.9, 0).toFixed(2);
          body = { items: payload.products.map(line => ({ ...line, unit_gross_price: '0.90', total_gross_value_after_discount: (Number(line.quantity) * 0.9).toFixed(2) })),
            totals: { gross_before_discount: gross, gross_after_discount: gross, discount: '0.00' },
            promotion_suggestions: [{...offer, id_promotion:19, name:`Active for ${quantity}, portion ${target?.id_product_portion ?? 'whole'}`, is_available:true, minimum_receipt_gross:null}], upcoming_promotion_suggestions: showUpcoming ? [offer,
              { ...offer, id_promotion: 18, name: 'Unrelated product offer', items: [{ id_product: 999, quantity: 1 }] }] : [] };
        } else if (url.pathname.endsWith('/config') || url.pathname.endsWith('/brand')) {
          body = {};
        } else if (url.pathname.endsWith('/availability/slots')) {
          body = [{ id: 1, label: '12:00 – 14:00', start: '12:00', end: '14:00', available: true }];
        }
        return route.fulfill({ json: body }).catch(() => {});
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}?shop=2&category=category%3A70`);
      await page.locator('.ws-card .ws-add').first().click();
      const upcoming = page.locator('.pdm-promotion--upcoming');
      const active = page.locator('.pdm-promotion:not(.pdm-promotion--upcoming)');
      const plus = page.locator('.pdm-qty__btn').last();
      await active.locator('button.pdm-promotion__card').waitFor();
      await page.waitForFunction(() => document.querySelector('.pdm-promotion')?.getAttribute('aria-busy') === 'false');
      await page.evaluate(() => {
        window.previewNodes = [...document.querySelectorAll('.pdm-promotion, .pdm-promotion__card')];
        window.previewRemovals = 0;
        window.previewObserver = new MutationObserver(records => {
          for (const record of records) for (const removed of record.removedNodes) {
            if (window.previewNodes.some(node => removed === node || removed.contains?.(node))) window.previewRemovals++;
          }
        });
        window.previewObserver.observe(document.querySelector('.pdm-scroll'), { childList: true, subtree: true });
      });
      const before = quotes.length;
      for (let i = 0; i < 3; i++) await plus.click();
      await page.waitForFunction(() => document.querySelector('.pdm-qty__val')?.textContent === '4');
      assert.equal(await upcoming.isVisible(), true, 'upcoming offer stays visible before the delayed request');
      await page.waitForFunction(() => document.querySelector('.pdm-promotion')?.getAttribute('aria-busy') === 'true');
      assert.equal(await active.locator('button.pdm-promotion__card').isDisabled(), true, 'old active offer cannot be selected during refresh');
      await page.waitForTimeout(300);
      assert.equal(quotes.length, before + 1, 'three rapid increments produce one request');
      assert.equal(await upcoming.isVisible(), true, 'upcoming offer stays visible during the response delay');
      await page.waitForFunction(() => document.querySelector('.pdm-promotion')?.getAttribute('aria-busy') === 'false');
      assert.match(await active.innerText(), /Active for 4/);
      assert.equal(await active.locator('button.pdm-promotion__card').isEnabled(), true);
      assert.equal(await page.evaluate(() => window.previewRemovals), 0, 'promotion cards stay mounted throughout refresh');
      await page.evaluate(() => window.previewObserver.disconnect());
      // Cancel an in-flight slow response when a newer quantity is requested.
      await plus.click();
      await page.waitForFunction(() => document.querySelector('.pdm-qty__val')?.textContent === '5');
      await page.waitForTimeout(300);
      assert.ok(quotes.some(quote => quote.products.some(line => Number(line.quantity) === 5)));
      await plus.click();
      await page.waitForFunction(() => document.querySelector('.pdm-promotion')?.getAttribute('aria-busy') === 'false');
      assert.match(await active.innerText(), /Active for 6/);
      await page.waitForTimeout(1000);
      assert.match(await active.innerText(), /Active for 6/, 'late older response cannot replace the current offer');
      // A portion change must clear the previous eligibility while loading.
      await page.locator('.pdm-seg--portions').getByRole('radio', { name: /1\/2/ }).click();
      await active.waitFor({ state: 'detached' });
      await active.waitFor();
      await page.waitForFunction(() => document.querySelector('.pdm-promotion')?.getAttribute('aria-busy') === 'false');
      assert.match(await active.innerText(), /portion 7/);
      await page.screenshot({ path: `/tmp/webshop-preview-stable-${width}.png` });
      // A failed recheck must not leave selectable stale offers.
      await plus.click();
      await active.waitFor({ state: 'detached' });
      assert.equal(await page.locator('.pdm-promotion__card').count(), 0);
      assert.equal(await page.locator('.pdm-cta').isEnabled(), true, 'ordinary purchases remain possible');
      const beforeClose = quotes.length;
      await plus.click();
      await page.keyboard.press('Escape');
      await page.locator('.pdm-cta').waitFor({ state: 'detached' });
      await page.waitForTimeout(350);
      assert.equal(quotes.length, beforeClose, 'closing the sheet cancels its queued preview');
      assert.deepEqual(errors, []);
      console.log(`PASS stable promotion preview, debounce, cancellation and failure at ${width}px`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
