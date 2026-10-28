import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const calls = [];
let ok = true;
const context = vm.createContext({
  window: { setInterval() {}, addEventListener() {} },
  document: { addEventListener() {} },
  __WS_API_BASE_URL__: '/api/v1',
  fetch: async (url) => {
    calls.push(url);
    return { ok, status: 503, json: async () => ({ fidelityTabEnabled: false }) };
  },
});
for (const file of ['webshop-auth-api.jsx', 'api-config.js']) {
  vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
}
assert.equal((await context.window.WSAuth.config()).fidelityTabEnabled, false);
assert.deepEqual(calls, ['/api/v1/webshop/config']);
assert.equal(context.window.WSAuth.endpoint, '/api/v1/clients/auth');
ok = false;
await assert.rejects(context.window.WSAuth.config(), /503/);
console.log('PASS: public configuration endpoint, auth endpoint preserved, HTTP errors propagated');
