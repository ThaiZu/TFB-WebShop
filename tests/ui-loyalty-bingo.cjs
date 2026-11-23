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
            if (url.endsWith('/personal/join')) {
              if (options.method !== 'POST' || JSON.parse(options.body).campaign_id !== 2) throw new Error('Unexpected enrollment');
              window.joinRequests++;
              return {response: {ok:true}, data:{}};
            }
            if (!url.endsWith('/personal/wallet')) throw new Error('Unexpected path');
            return {response:{ok:true}, data:{balance:12,history:[],
              bingo:window.noCampaign ? null : {id:2,name:'Listopad',joined:window.joinRequests > 0,
                starts_at:'2026-11-01 00:00:00', ends_at:'2026-12-01 00:00:00',
                tasks:['PURCHASES','QUANTITY','SPEND','DAYS'].map((type,i)=>({id:i+1,name:'Zadanie '+(i+1),type,
                  progress:window.joinRequests ? 1 : 0, target:2, points:3, complete:i===0 && window.joinRequests>0}))}}};
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
    await page.getByText('✓ Ukończono', {exact:true}).waitFor();
    assert.equal(await page.locator('.ws-bingo li').count(), 4);
    assert.equal(await page.locator('.ws-bingo li.is-complete').count(), 1);
    assert.equal(await page.evaluate(() => window.joinRequests), 1);
    await page.reload();
    await page.setContent('<div id="root"></div>');
    await page.evaluate(() => {window.noCampaign = true;});
    await page.addScriptTag({content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text});
    await page.getByRole('button', {name:'Bingo', exact:true}).click();
    await page.getByText('Obecnie nie trwa żadna edycja Bingo.').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: Fidelity wallet, explicit enrollment, four task types, progress and a gap between editions at 390 px');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
