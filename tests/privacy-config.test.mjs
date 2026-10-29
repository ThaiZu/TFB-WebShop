import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPrivacyConfiguration } from '../webshop-privacy-api.js';

test('uses public no-store request; clears stale configuration before fetching', async () => {
  const calls = [];
  const consent = { configure(value) { calls.push(value); return value !== null; } };
  const value = { schemaVersion: 1 };
  const result = await loadPrivacyConfiguration('/api/v1/webshop/privacy-config', { consent, fetcher: async (url, options) => {
    assert.equal(url, '/api/v1/webshop/privacy-config');
    assert.equal(options.credentials, 'omit');assert.equal(options.cache, 'no-store');
    assert.deepEqual(calls, [null]);
    return { ok: true, json: async () => value };
  }});
  assert.equal(result, true);assert.deepEqual(calls, [null, value]);
});
test('HTTP, JSON, network and contract failures never enable integrations or throw', async () => {
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw Error('JSON'); } }),
    async () => { throw Error('network'); },
    async () => ({ ok: true, json: async () => ({ invalid: true }) }),
  ]) {
    let active = true;
    const consent = { configure() { active = false; return false; } };
    assert.equal(await loadPrivacyConfiguration('/config', { consent, fetcher }), false);
    assert.equal(active, false);
  }
});
