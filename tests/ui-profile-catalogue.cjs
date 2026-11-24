const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.env.WS_BASE_URL || 'http://127.0.0.1:5173';
const product = {
  id: 11, name: 'Bagietka testowa', id_category: 3, is_active: 1, webshop_active: 1, click_and_collect: 1,
  category: { id: 3, name: 'Pieczywo', groups: [] },
  webshop: { price_gross: '10.00', allergen_codes: [] },
  portions: [], availability_periods: [],
  webshop_availability: { status: 'not_enforced', inventory_enforced: false },
};

async function simulateAutofill(field, value) {
  await field.evaluate((input, text) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: text }));
  }, value);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox'],
  });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        const save = (name, value) => {
          const createdAt = Date.now();
          sessionStorage.setItem('ws.session.v1:' + name, JSON.stringify({ value, createdAt, expiresAt: createdAt + 43200000 }));
        };
        save('ws_auth_token', 'profile-test');
        save('ws.lang', 'pl');
      });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/v1/')) return route.continue();
        let data = [];
        if (url.pathname.endsWith('/shops')) {
          data = [{ id: 2, name: 'Piekarnia', default_lang: 'pl', languages: 'pl', collect_enabled: 1 }];
        } else if (url.pathname.endsWith('/clients/auth/me')) {
          data = { user: { id: 7, email: 'anna@example.invalid', firstName: 'Anna', lastName: 'Testowa', postalCode: '1000' } };
        } else if (url.pathname.endsWith('/products/available')) {
          data = [product];
        } else if (url.pathname.endsWith('/config') || url.pathname.endsWith('/brand')) {
          data = {};
        }
        return route.fulfill({ json: data });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/?shop=2&category=all');

      const card = page.locator('.ws-grid .ws-card').filter({ hasText: product.name });
      const profile = width < 768
        ? page.locator('.ws-tabbar__btn--account')
        : page.getByRole('button', { name: 'Konto', exact: true });
      const search = page.getByRole('searchbox', { name: 'Szukaj produktów' });
      const noProducts = page.getByText('Nie znaleziono produktów.', { exact: true });
      const close = page.locator('.ws-modal__close:visible');

      await card.waitFor();
      if (width < 768) await page.locator('.ws-product-search-toggle').click();

      await profile.click();
      await page.getByRole('button', { name: 'Wyloguj się', exact: true }).waitFor();
      await simulateAutofill(search, 'anna@example.invalid');
      await close.click();
      assert.equal(await noProducts.count(), 0, 'Profile autofill must not empty the catalogue');
      assert.equal(await search.inputValue(), '');
      assert.equal(await card.count(), 1);

      await search.fill('bagietka');
      assert.equal(await card.count(), 1);
      await profile.click();
      await close.click();
      await simulateAutofill(search, 'anna@example.invalid');
      assert.equal(await search.inputValue(), 'bagietka', 'An intentional search survives closing the profile');
      assert.equal(await card.count(), 1);
      await search.fill('niepasujący produkt');
      await noProducts.waitFor();
      await search.clear();
      assert.equal(await card.count(), 1);

      await profile.click();
      const passwordForm = page.locator('form').filter({ has: page.locator('input[name="current-password"]') });
      await passwordForm.locator('input[name="current-password"]').fill('example-old');
      await passwordForm.locator('input[name="new-password"]').fill('example-new');
      await passwordForm.locator('input[name="confirm-password"]').fill('example-new');
      const [passwordRequest] = await Promise.all([
        page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/password/change') && request.method() === 'POST'),
        passwordForm.locator('button[type="submit"]').click(),
      ]);
      assert.deepEqual(passwordRequest.postDataJSON(), {
        current_password: 'example-old', new_password: 'example-new', new_password_confirm: 'example-new',
      });
      await passwordForm.locator('.ws-acc__vat-msg--ok').waitFor();
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS profile and catalogue search at width ' + width);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
