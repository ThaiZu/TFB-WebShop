import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../webshop-pwa-install.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../webshop-pwa-install.css', import.meta.url), 'utf8');
const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

for (const source of ['beforeinstallprompt', 'event.preventDefault()', 'appinstalled', 'prompt.userChoice', "display-mode: standalone", 'navigator.standalone', 'WS_PWA_DELAY_MS', 'WSSessionStorage', 'role="dialog"', 'aria-modal="true"', 'Escape', 'safe-area-inset-bottom']) {
  assert.ok(component.includes(source) || css.includes(source), `Missing PWA installation behaviour: ${source}`);
}
assert.match(component, /pwaIsIosSafari/);
assert.match(component, /pwaDeferredRecently/);
assert.match(component, /window\.useT\(\)/);
assert.doesNotMatch(component, /window\.wsUseT/);
assert.match(component, /setTimeout\([\s\S]{0,160}1400/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /min-height:\s*46px/);
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
assert.match(config, /VitePWA/);
assert.match(config, /background_color:\s*'#EAE4DC'/);
console.log('PASS: PWA installation prompt contract and manifest configuration.');
