const assert = require('node:assert/strict');
const path = require('node:path');
const {build} = require('esbuild');
const {chromium} = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const bundle = await build({
    stdin: {
      resolveDir: root, loader: 'jsx',
      contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {LoyaltyWallet} from './webshop-loyalty-wallet.jsx';
        import labels from './public/locales/pl.json';
        window.React = React;
        window.useT = () => ({t: key => labels[key] || key, lang: 'pl'});
        window.joinRequests = 0;
        window.WSAuth = {
          authenticatedJson: async (url, options) => {
            if (url.includes('/loyalty/cards')) {
              return {response: {ok: true}, data: {status: 'available', asOf: new Date().toISOString(), items: [], nextCursor: null}};
            }
            if (url.endsWith('/bingo/join') && options.method === 'POST') window.joinRequests++;
            return {response: {ok: true}, data: {
              joined: window.joinRequests > 0, starts_at: '2026-11-23', ends_at: '2027-02-21',
              threshold_cents: 1000, rewards: {3: 200, 13: 1000},
              weeks: Array.from({length: 13}, (_, i) => ({
                start: new Date(Date.UTC(2026, 10, 23 + i * 7)).toISOString().slice(0, 10),
                amount_cents: i === 0 ? 1050 : 0, complete: i === 0, state: i === 0 ? 'current' : 'future',
              })),
            }};
          },
        };
        createRoot(document.getElementById('root')).render(<LoyaltyWallet identity={{status:'loading'}}
          shopId={1} user={{id: 1}} onClose={() => {}}/>);
      `,
    },
    loader: {'.jpg': 'dataurl', '.ttf': 'dataurl', '.otf': 'dataurl', '.svg': 'dataurl'},
    bundle: true, write: false, format: 'iife', logLevel: 'silent', outdir: 'out',
    define: {__WS_API_BASE_URL__: JSON.stringify('https://api.example.invalid/api/v1')},
  });
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><meta name="viewport" content="width=device-width"><div id="root"></div>');
    const css = bundle.outputFiles.find(file => file.path.endsWith('.css'));
    if (css) await page.addStyleTag({content: css.text});
    await page.addScriptTag({content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text});
    await page.getByRole('button', {name: 'Bingo', exact: true}).click();
    await page.getByRole('button', {name: 'Dołącz', exact: true}).click({timeout: 5000}).catch(async error => { throw new Error((await page.locator('body').innerText()) + '\n' + errors.join(' | '), {cause: error}); });
    await page.getByText('1/13', {exact: true}).waitFor();
    assert.equal(await page.locator('.ws-bingo li').count(), 13);
    assert.equal(await page.locator('.ws-bingo li.is-complete').count(), 1);
    assert.equal(await page.evaluate(() => window.joinRequests), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: Fidelity wallet, explicit enrollment, 13 weeks and completed week at 390 px');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
