/* Run the Webshop against an intercepted local API. Uses no real accounts. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.env.WEBSHOP_BASE || 'http://127.0.0.1:33409';
const token = 'a'.repeat(64);
const user = { id: 7, email: 'customer@example.invalid', firstName: 'Test', lastName: 'Client', needsPostcode: true };
const transactions = [{ id: 52, reference: 'SALE-52', at: '2026-11-23T10:00:00Z', shop: 'Atelier', source: 'store', total: 6 }];
const orders = [
  { orderId: 12, source: 'store', orderRef: 'POS-12', status: 'new', total: 6, itemsCount: 1, mode: 'collect', payment: {method: 'store', status: 'pending'} },
  { orderId: 13, source: 'webshop', orderRef: 'WEB-2-20261123-ABCDEF', status: 'new', total: 9, itemsCount: 1, mode: 'collect', payment: {method: 'stripe', status: 'paid'} },
];

async function flow(browser, opts) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 900 } });
  await context.addInitScript(() => {
    const createdAt = Date.now();
    sessionStorage.setItem('ws.session.v1:ws.lang', JSON.stringify({value:'pl', createdAt, expiresAt:createdAt + 43200000}));
  });
  let loggedIn = opts.signedIn, resolveCount = 0;
  const errors = [];
  await context.route('**/api/v1/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    const payload = (status, data) => route.fulfill({ status, json: data });
    switch (path) {
      case '/clients/auth/refresh':
        return loggedIn ? payload(200, { access_token:'fixture', session_transport:'cookie' }) : payload(401, {});
      case '/clients/auth/me':
        return loggedIn ? payload(200, { user }) : payload(401, {});
      case '/clients/auth/login':
        loggedIn = true;
        return payload(200, { user, access_token:'fixture', session_transport:'cookie' });
      case '/webshop/transactions/me/resolve-receipt':
        assert.equal(req.method(), 'POST');
        assert.equal(req.headers().authorization, 'Bearer fixture');
        assert.deepEqual(req.postDataJSON(), {token});
        resolveCount++;
        return opts.owned ? payload(200, { ...transactions[0], lines: [{id:1,name:'Tarte témoin',quantity:1,unitGrossPrice:6,discountValue:0,totalGross:6}] }) : payload(404, {});
      case '/webshop/transactions/me':
        return payload(200, { items: transactions, nextBefore: null });
      case '/webshop/orders/me':
        return payload(200, orders);
      case '/webshop/orders/store/12':
        return payload(200, { ...orders[0], items: [{id:2,name:'Pain réservé',quantity:1,unitGrossPrice:6,discountValue:0,totalGross:6}] });
      case '/shops':
        return payload(200, [{id:2,name:'Atelier'}]);
      case '/config':
      case '/brand':
        return payload(200, {});
      default:
        return payload(200, []);
    }
  });

  const page = await context.newPage();
  page.on('pageerror', err => errors.push(err.message));
  try {
    // No selected shop, preferred shop or previous Webshop visit is required.
    await page.goto(base + '/#receipt=' + token);
    if (!opts.signedIn) {
      const login = page.locator('form').filter({ has: page.locator('input[autocomplete=current-password]') });
      await login.locator('input[autocomplete=username]').fill(user.email);
      await login.locator('input[autocomplete=current-password]').fill('fixture-password');
      await login.locator('button[type=submit]').click();
    }
    if (opts.owned) {
      await page.getByText('Tarte témoin').waitFor();
      await page.getByRole('button', {name:/Wróć do transakcji/}).click();
    } else {
      await page.getByText('Ten paragon jest niedostępny na tym koncie.').waitFor();
      assert.equal(await page.getByText('Tarte témoin').count(), 0);
    }
    await page.getByText('SALE-52', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(resolveCount, 1);

    await page.getByRole('tab', {name:'Moje zamówienia'}).click();
    await page.getByText('POS-12 · W sklepie stacjonarnym').waitFor();
    await page.getByText('WEB-2-20261123-ABCDEF · W sklepie internetowym').waitFor();
    assert.equal(await page.getByRole('button', {name:'Anuluj zamówienie'}).count(), 0);
    const store = page.locator('.ws-acc__card').filter({hasText:'POS-12'});
    await store.getByRole('button', {name:'Szczegóły zamówienia'}).click();
    await page.getByText('Pain réservé').waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    await flow(browser, { signedIn: false, owned: true });
    await flow(browser, { signedIn: true, owned: false });
    console.log('PASS: receipt login and active sessions, owned/foreign lookup, separate transaction and order histories without a selected shop');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
