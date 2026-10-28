/* Production build, intercepted requests only. No live API, Google, Meta or DB. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const serveBuild = require('./helpers/static-build.cjs');
const build = process.env.CONSENT_BUILD || path.resolve(__dirname, '../dist');
const config = { schemaVersion: 1, scope: 'atelierby', policyVersion: 'atelierby-2026-01', consentMode: 'basic', choiceLifetimeMonths: 6, status: 'ready', policies: {}, integrations: {ga4:{enabled:true,category:'analytics',id:'G-TEST123'}}, contact:{email:'webshop@atelierby.be',verified:false} };
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
 try {
 for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
  await context.addInitScript(() => { if (!window.WSSessionStorage?.getItem('ws.lang')) sessionStorage.setItem('ws.session.v1:' + 'ws.lang', ((createdAt)=>JSON.stringify({value: 'pl', createdAt, expiresAt:createdAt+43200000}))(Date.now())); });
  const external = [], errors = [];
  let configFails = false, holdConfig = true, releaseConfiguration;
  const configurationGate = new Promise(resolve => { releaseConfiguration = resolve; });
  await context.route('**/*', async route => {
   const req = route.request(), url = new URL(req.url());
   if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') return route.fulfill({contentType:'application/javascript',body:''});
   if (url.hostname !== 'webshop.test' && !(url.hostname === 'api.tfbuddy.local' && url.pathname.startsWith('/api/v1/'))) { external.push(req.url()); return route.abort(); }
   if (!url.pathname.includes('/api/v1/')) return serveBuild(route, build);
   let data = [];
   if (url.pathname.endsWith('/privacy-config')) {
    if (holdConfig) await configurationGate;
    if (configFails) return route.fulfill({ status: 503, json: {} });
    data = config;
   } else if (url.pathname.endsWith('/shops')) data = [{ id: 2, name: 'Test shop', default_lang: 'pl', languages: 'pl,fr,nl', collect_enabled: 1 }];
   else if (url.pathname.endsWith('/products/available')) data = [{ id: 11, name: 'Test baguette', id_category: 3, is_active: 1, webshop_active: 1, click_and_collect: 1, category: { id: 3, name: 'Bread', groups: [] }, webshop: { price_gross: '10.00', allergen_codes: [], ingredients: '' }, portions: [], availability_periods: [], webshop_availability: { status: 'not_enforced', inventory_enforced: false } }];
   else if (url.pathname.endsWith('/cart/quote')) { const b = req.postDataJSON(); data = { items: b.products.map(p => ({ ...p, total_gross_value_after_discount: '10.00', unit_gross_price: '10.00' })), shopping_context: b.shopping_context, billing: { mode: 'person' }, totals: { gross_before_discount: '10.00', discount: '0.00', gross_after_discount: '10.00' } }; }
   else if (url.pathname.endsWith('/locale')) data = { language: 'pl' };
   else if (url.pathname.endsWith('/clients/auth/me')) return route.fulfill({ status: 401, json: {} });
   else if (url.pathname.endsWith('/brand')) data = {};
   await route.fulfill({ json: data });
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto('https://webshop.test/?shop=2');
  const panel = page.locator('.ws-cookie-panel'); await panel.waitFor();
  if(process.env.CONSENT_SCREENSHOT_DIR){const fs=require('node:fs');fs.mkdirSync(process.env.CONSENT_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CONSENT_SCREENSHOT_DIR,'cookie-banner-'+width+'.png')});}
  assert.equal(await panel.getAttribute('aria-modal'), 'false');
  assert.equal(await panel.getByText(/Google Ads|Meta/).count(),0);
  assert.equal(await page.evaluate(() => window.WSConsent.get()), null);
  // A missing configuration must not solicit future analytics consent.
  assert.equal(await panel.getByRole('button',{name:'Akceptuj wszystkie',exact:true}).count(),0);
  holdConfig=false;releaseConfiguration();
  await page.waitForFunction(()=>window.WSConsent.configuration()!==null);
  await panel.getByRole('button',{name:'Ustawienia',exact:true}).click();
  await panel.locator('input').first().check();
  await page.evaluate(()=>window.WSConsent.configure(window.WSConsent.configuration()));
  assert.equal(await panel.locator('input').first().isChecked(),true);
  assert.equal(await panel.locator('a[href^="mailto:"]').count(),0);
  // Dismissing a banner must keep all purposes denied.
  await panel.getByRole('button', { name: 'Zamknij bez zmiany wyboru' }).click();
  assert.equal(await page.evaluate(() => window.WSConsent.allows('analytics')), false);
  await page.getByRole('button', { name: 'Ustawienia cookies', exact: true }).click();
  await panel.getByRole('button', { name: 'Akceptuj wszystkie', exact: true }).click();
  assert.equal(await page.evaluate(() => window.WSConsent.get().advertising), false);
  assert.equal(await page.evaluate(() => window.WSConsent.integrationAllowed('ga4')), true);
  await page.reload(); await page.locator('.ws-cookie-settings').waitFor();
  assert.equal(await panel.count(), 0);
  await page.getByRole('button', { name: 'Ustawienia cookies', exact: true }).click();
  assert.equal(await panel.locator('input:checked').count(), 1);
  await panel.locator('input').first().uncheck();
  await panel.getByRole('button', { name: 'Zapisz wybór' }).click();
  assert.deepEqual(await page.evaluate(() => { const c = window.WSConsent.get(); return [c.analytics,c.advertising]; }), [false,false]);
  await page.locator('.ws-cookie-settings').click();
  await panel.getByRole('button',{name:'Akceptuj wszystkie',exact:true}).click();
  // Another tab revokes analytics.
  const other = await context.newPage(); await other.goto('https://webshop.test/?shop=2');
  await other.waitForFunction(() => window.WSConsent && window.WSI18n?.isLoaded());
  await other.evaluate(() => window.WSConsent.reject());
  await page.waitForFunction(() => window.WSConsent.get()?.analytics === false);
  await other.close();
  // Preserve essential data and expire known visible first-party optional cookies.
  await page.evaluate(() => { sessionStorage.setItem('ws.session.v1:' + 'ws_auth_token', ((createdAt)=>JSON.stringify({value:'keep', createdAt, expiresAt:createdAt+43200000}))(Date.now())); sessionStorage.setItem('ws.pendingPay','keep'); document.cookie='_ga=test; Path=/'; document.cookie='_fbp=test; Path=/'; window.WSConsent.reject(); });
  assert.deepEqual(await page.evaluate(() => [window.WSSessionStorage?.getItem('ws_auth_token'),sessionStorage.getItem('ws.pendingPay'),document.cookie.includes('_ga='),document.cookie.includes('_fbp=')]), ['keep','keep',false,false]);
  await page.evaluate(() => window.WSSessionStorage.removeItem('ws_auth_token'));
  // Existing catalogue/cart flow remains available after refusal.
  await page.getByRole('button',{name:'Bread',exact:true}).last().click();
  await page.locator('.ws-card .ws-add').first().click();
  await page.locator('.pdm-cta').click(); await page.locator('.pdm-cta').waitFor({ state: 'detached' });
  if(width<600) await page.locator('.ws-tabbar__btn--cart').click();
  await page.locator('.ws-basket:visible .ws-line').first().waitFor();
  if(width<600) await page.locator('.ws-drawer__close').click();
  // Language changes update consent UI as well.
  await page.locator('.ws-cookie-settings').click();
  for (const [lang,title] of [['fr','Confidentialité et cookies'],['nl','Privacy en cookies'],['pl','Prywatność i pliki cookie']]) {
   await page.evaluate(lang => window.WSI18n.setLang(lang), lang);
   await panel.getByRole('heading', { name: title }).waitFor();
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  // New policy requires a fresh decision.
  await page.evaluate(() => window.WSConsent.configure({ ...window.WSConsent.configuration(), policyVersion:'atelierby-2026-02' }));
  assert.equal(await page.evaluate(() => window.WSConsent.get()), null);
  await panel.getByRole('button', { name: 'Odrzuć opcjonalne' }).click();
  // Unavailable configuration never enables tracking or breaks the page.
  configFails = true; await page.reload(); await page.locator('.ws-card').first().waitFor();
  await page.waitForFunction(() => window.WSConsent?.configuration() === null);
  assert.equal(await page.evaluate(() => window.WSConsent.integrationAllowed('meta')), false);
  assert.deepEqual(external, []); assert.deepEqual(errors, []);
  console.log('PASS cookies '+width+'px: choices, reload, categories, cross-tab withdrawal, cleanup, cart, FR/NL/PL, API failure, no external requests');
  await context.close();
 }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
