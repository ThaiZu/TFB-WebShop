/* Real storefront, controlled API: no orders or payments. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--host-resolver-rules=MAP webshop.tfbuddy.local 127.0.0.1'] });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 1000 } });
      await context.addInitScript(() => localStorage.setItem('ws.lang', 'pl'));
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (!['webshop.tfbuddy.local', 'tfb.tfbuddy.local'].includes(url.hostname)) return route.abort();
        if (url.pathname === '/category-fixture.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="gold"/></svg>' });
        if (!url.pathname.includes('/api/v1/')) return route.continue();
        let body = [];
        if (url.pathname.endsWith('/shops')) body = [{ id: 2, name: 'Test shop', default_lang: 'pl', languages: 'pl,fr,nl', collect_enabled: 1 }];
        if (url.pathname.endsWith('/products/available')) body = [
          { id: 11, name: 'Test bread', id_category: 3, category: { id: 3, name: 'Bread', groups: [], webshop_image: { url: '/category-fixture.svg' } } },
          { id: 12, name: 'Test cake', id_category: 4, category: { id: 4, name: 'Cakes', groups: [{ id: 8, name: 'Desserts', webshop_image: { url: '/category-fixture.svg' } }] } },
        ].map(product => ({ ...product, is_active: 1, webshop_active: 1, click_and_collect: 1, office_delivery: 1, is_divisible: 0, webshop: { price_gross: '5.00', allergen_codes: [] }, portions: [], availability_periods: [], webshop_availability: { status: 'not_enforced', inventory_enforced: false, quantity_available: null } }));
        if (url.pathname.endsWith('/config') || url.pathname.endsWith('/brand')) body = {};
        return route.fulfill({ json: body });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('https://webshop.tfbuddy.local/?shop=2');
      await page.getByRole('button', { name: 'Bread', exact: true }).last().waitFor();
      const cards = page.locator('.ws-grid .ws-category-card');
      assert.equal(await cards.count(), 2);
      assert.equal(await page.locator('.ws-grid .ws-add').count(), 0, 'home hides all product cards');
      assert.equal(await cards.first().locator('img').getAttribute('src'), '/category-fixture.svg');
      await cards.filter({ hasText: 'Desserts' }).click();
      await page.locator('.ws-grid .ws-add').waitFor();
      assert.match(page.url(), /category=group%3A8/);
      assert.equal(await page.locator('.ws-grid .ws-card__name').innerText(), 'Test cake');
      await page.reload();
      await page.locator('.ws-grid .ws-add').waitFor();
      assert.equal(await cards.count(), 0, 'category deep link survives reload');
      await page.locator('.ws-categories-back').click();
      await cards.first().waitFor();
      assert.equal(await cards.count(), 2, 'back restores category home');
      await cards.filter({ hasText: 'Bread' }).click();
      await page.locator('.ws-grid .ws-add').waitFor();
      assert.equal(await page.locator('.ws-grid .ws-card__name').innerText(), 'Test bread');
      await page.locator('.ws-cat').filter({ hasText: 'Wszystko' }).click();
      await page.waitForFunction(() => document.querySelectorAll('.ws-grid .ws-add').length === 2);
      assert.equal(await cards.count(), 0, 'all shows products instead of categories');
      await page.reload();
      await page.waitForFunction(() => document.querySelectorAll('.ws-grid .ws-add').length === 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS category home, R2 icons, filtering, deep links and back at width ' + width);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
