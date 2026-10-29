/* Local storefront with controlled API responses; no orders or payments. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const base = process.env.WS_UI_URL || 'http://127.0.0.1:5175/WebShop/';
  const origin = new URL(base).origin;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(() => localStorage.setItem('ws.lang', 'fr'));
      const errors = [];
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
            webshop: { price_gross: '0.90', allergen_codes: [] }, portions: [], availability_periods: [],
            webshop_availability: { status: 'not_enforced', inventory_enforced: false, quantity_available: null } }];
        } else if (url.pathname.endsWith('/cart/quote')) {
          const payload = request.postDataJSON();
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
      const section = page.locator('.pdm-promotion--upcoming');
      await section.waitFor();
      assert.equal(await section.locator('.pdm-promotion__card').count(), 1, 'only this product gets an upcoming card');
      assert.equal(await section.locator('.pdm-promotion__day').count(), 7);
      assert.equal(await section.locator('.pdm-promotion__day.is-active').count(), 2);
      assert.equal(await section.locator('.pdm-promotion__price, .pdm-promotion__composition').count(), 0);
      assert.doesNotMatch(await section.innerText(), /Achetez|gratuitement|20[,.]00|4[,.]50/);
      assert.match(await section.innerText(), /06:00–18:00/);
      assert.doesNotMatch(await section.innerText(), /Le week-end|tous les jours/);
      const rowBounds = await section.locator('.pdm-promotion__availability').evaluate(row => {
        const days = row.querySelector('.pdm-promotion__weekdays').getBoundingClientRect();
        const hours = row.querySelector('.pdm-promotion__hours').getBoundingClientRect();
        return { sameLine: Math.abs((days.top + days.height / 2) - (hours.top + hours.height / 2)) < 2,
          fits: row.scrollWidth <= row.clientWidth + 1 };
      });
      // Longer translated availability captions may move hours to the next line.
      assert.equal(rowBounds.fits, true, 'the compact row fits the card');
      const validity = section.locator('.pdm-promotion__validity');
      assert.equal(await validity.innerText(), 'Disponible à partir du 19 octobre 2026');
      assert.match(await section.locator('.pdm-promotion__validity-end').innerText(), /18 octobre 2027/);
      const presentation = await validity.evaluate(element => {
        const date = element.getBoundingClientRect();
        const days = element.parentElement.querySelector('.pdm-promotion__weekdays').getBoundingClientRect();
        const style = getComputedStyle(element);
        return { sameLine: Math.abs((date.top + date.height / 2) - (days.top + days.height / 2)) < 2,
          size: parseFloat(style.fontSize), weight: Number(style.fontWeight),
          background: style.backgroundColor, border: parseFloat(style.borderLeftWidth), padding: parseFloat(style.paddingLeft) };
      });
      assert.equal(presentation.sameLine, true, 'the start date shares the weekdays line');
      assert.ok(presentation.size >= 12 && presentation.weight >= 700);
      assert.equal(presentation.background, 'rgba(0, 0, 0, 0)');
      assert.equal(presentation.border, 0);
      assert.equal(presentation.padding, 0);
      assert.equal(await section.locator('button, input, [tabindex]').count(), 0);
      assert.equal(await section.locator('.pdm-promotion__card').getAttribute('aria-disabled'), 'true');
      const ctaBefore = await page.locator('.pdm-cta').innerText();
      await section.locator('.pdm-promotion__card').click();
      assert.equal(await page.locator('.pdm-cta').innerText(), ctaBefore, 'upcoming card cannot select a discount');
      assert.equal(await page.locator('.pdm-qty__val').innerText(), '1');
      const overflowing = await section.evaluate(element => [...element.querySelectorAll('*')].filter(child => {
        const box = child.getBoundingClientRect();
        return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
      }).map(child => child.className));
      assert.deepEqual(overflowing, [], `no horizontal overflow at ${width}px`);
      await page.screenshot({ path: `/tmp/webshop-upcoming-${width}.png` });
      showUpcoming = false;
      await page.locator('.pdm-qty__btn').last().click();
      await section.waitFor({ state: 'detached' });
      assert.equal(await page.locator('.pdm-cta').isEnabled(), true, 'ordinary purchase remains available');
      assert.deepEqual(errors, []);
      console.log(`PASS upcoming product sheet at ${width}px`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
