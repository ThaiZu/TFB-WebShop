import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../webshop-auth-api.jsx', import.meta.url), 'utf8');
function fixture(handler) {
  const storage = {getItem: key => key === 'ws_auth_token' ? 'fixture-access' : null, removeItem() {}};
  const context = {window: {setInterval() {}, addEventListener() {}, WSSessionStorage: storage,
    localStorage: storage}, document: {addEventListener() {}}, fetch: handler};
  vm.runInNewContext(source, context);
  const api = context.window.WSAuth;
  api.endpoint = '/clients/auth';
  api.ensureFreshSession = async () => true;
  return api;
}

test('profile sends both names and uses the persisted API identity on reload', async () => {
  let stored = {id: 42, firstName: '', lastName: '', email: 'person@example.invalid'};
  const api = fixture(async (url, options) => {
    assert.equal(url, '/clients/auth/me');
    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      assert.deepEqual(body, {firstName: 'Élodie', lastName: 'Test'});
      stored = {...stored, ...body};
    }
    return {ok: true, status: 200, json: async () => ({user: stored})};
  });
  const saved = await api.updateMe({firstName: 'Élodie', lastName: 'Test'});
  assert.equal(saved.ok, true);
  assert.equal(saved.user.firstName, 'Élodie');
  assert.equal(saved.user.lastName, 'Test');
  assert.equal((await api.me()).lastName, 'Test');
});

test('profile save failure returns an error without inventing saved customer data', async () => {
  const api = fixture(async () => ({ok: false, status: 422,
    json: async () => ({description: 'lastName is invalid'})}));
  const result = await api.updateMe({firstName: 'Élodie', lastName: ''});
  assert.equal(result.ok, false);
  assert.equal(result.error, 'lastName is invalid');
  assert.equal(result.user, undefined);
});

test('password reset sends the supplied email independently of missing profile names', async () => {
  const api = fixture(async (url, options) => {
    assert.equal(url, '/clients/auth/password/reset/request');
    assert.deepEqual(JSON.parse(options.body), {email: 'person@example.invalid'});
    return {ok: true, status: 202, json: async () => ({ok: true})};
  });
  assert.equal((await api.resetRequest({email: 'person@example.invalid'})).ok, true);
});
