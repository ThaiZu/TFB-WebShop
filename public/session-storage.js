/* Requested storefront functions only. No localStorage fallback and no migration
 * of legacy personal data. TTL is checked on access, startup and page resume;
 * browsers cannot delete bytes while the application is closed. */
(function (w) {
  const MAX_AGE = 12 * 60 * 60 * 1000;
  const PREFIX = 'ws.session.v1:';
  const legacy = key => ['ws_auth_token', 'ws_auth_refresh_token', 'ws.customer', 'ws.lang', 'ws.activeShop', 'ws.accountTab', 'ws.pwa.install.laterAt', 'ws.pwa.install.installed'].includes(key) || key.startsWith('ws.deliveryPreference:');
  const memory = new Map();
  function removeItem(key) {
    memory.delete(key);
    try { w.sessionStorage.removeItem(PREFIX + key); } catch (_) {}
  }
  function getItem(key) {
    let raw = memory.get(key);
    if (!raw) try { raw = w.sessionStorage.getItem(PREFIX + key); } catch (_) {}
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      const now = Date.now();
      if (typeof record.value === 'string' && Number.isFinite(record.createdAt) && record.createdAt <= now && record.expiresAt === record.createdAt + MAX_AGE && now < record.expiresAt) return record.value;
    } catch (_) {}
    removeItem(key);
    return null;
  }
  function setItem(key, value) {
    const createdAt = Date.now();
    const raw = JSON.stringify({value: String(value), createdAt, expiresAt: createdAt + MAX_AGE});
    // Memory only when storage is unavailable; it never survives navigation.
    memory.delete(key);
    try { w.sessionStorage.setItem(PREFIX + key, raw); }
    catch (_) { memory.set(key, raw); }
  }
  function keys(storage) {
    const result = [];
    for (let i = 0; i < storage.length; i++) result.push(storage.key(i));
    return result;
  }
  function sweep() {
    try { keys(w.localStorage).filter(key => key && legacy(key)).forEach(key => w.localStorage.removeItem(key)); } catch (_) {}
    try { keys(w.sessionStorage).filter(key => key?.startsWith(PREFIX)).forEach(key => getItem(key.slice(PREFIX.length))); } catch (_) {}
    for (const key of memory.keys()) getItem(key);
  }
  function clearCustomer() {
    try { keys(w.sessionStorage).filter(key => key?.startsWith(PREFIX)).map(key => key.slice(PREFIX.length)).filter(key => key === 'ws.customer' || key === 'ws.accountTab' || key.startsWith('ws.deliveryPreference:')).forEach(removeItem); } catch (_) {}
    for (const key of memory.keys()) if (key === 'ws.customer' || key === 'ws.accountTab' || key.startsWith('ws.deliveryPreference:')) removeItem(key);
  }
  w.WSSessionStorage = {getItem, setItem, removeItem, clearCustomer};
  sweep();
  w.addEventListener('pageshow', sweep);
  w.addEventListener('focus', sweep);
})(window);
