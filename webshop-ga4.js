/* Direct GA4, isolated from GTM. No script/request until the consent runtime starts it. */
export function createGa4Adapter(w = window, document = w.document) {
  const layerName = 'wsGa4Layer';
  let activation = null, script = null, loaded = false, attempted = false, identity = null, propertyChanged = false;
  const sent = new Set();
  const keyPrefix = 'ws.ga4.purchase.';
  const usable = () => activation && !activation.signal.aborted && activation.isAllowed() && w['ga-disable-' + identity] !== true;
  function command(...args) {
    if (!usable()) return;
    (w[layerName] ||= []).push((function () { return arguments; })(...args));
  }
  function initialize() {
    if (!usable()) return;
    command('consent', loaded ? 'update' : 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    command('js', new Date());
    // Fixed canonical metadata: no customer URLs, queries, hashes, titles or referrers.
    command('config', identity, { send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, page_location: 'https://webshop.atelierby.be/',
      page_referrer: '', page_title: 'Webshop', cookie_update: false,
      cookie_expires: Number.isFinite(activation.expiresAt)
        ? Math.max(1, Math.min(15552000, Math.floor((activation.expiresAt - Date.now()) / 1000))) : 15552000 });
  }
  return {
    category: 'analytics',
    start(context) {
      if (!/^G-[A-Z0-9]+$/.test(context.id)) throw Error('Invalid GA4 ID');
      if (identity && identity !== context.id) { propertyChanged = true; throw Error('Reload required for GA4 property change'); }
      if (attempted && !loaded) throw Error('Reload required after interrupted GA4 load');
      identity = context.id; activation = context;
      w['ga-disable-' + identity] = false;
      initialize();
      if (loaded) {
        command('event', 'page_view', { send_to: identity }); return;
      }
      attempted = true;
      script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + identity + '&l=' + layerName;
      script.onload = () => {
        loaded = true;
        if (usable()) command('event', 'page_view', { send_to: identity });
      };
      script.onerror = () => { w['ga-disable-' + identity] = true; activation = null; script?.remove(); };
      document.head.appendChild(script);
    },
    stop() {
      if (identity) w['ga-disable-' + identity] = true;
      activation = null;
      if (w[layerName]) w[layerName].length = 0;
      script?.remove();
      // Optional GA4 deduplication data only. Never touch login/payment keys.
      try { for (let i = w.sessionStorage.length - 1; i >= 0; i--) {
        const key = w.sessionStorage.key(i); if (key?.startsWith(keyPrefix)) w.sessionStorage.removeItem(key);
      } } catch (_) {}
      if (propertyChanged || (attempted && !loaded)) throw Error('Reload required for GA4 restart');
    },
    track(event, payload) {
      if (!usable() || !loaded) return;
      const clean = sanitizeGa4Event(event, payload);
      if (!clean) return;
      if (event === 'purchase') {
        const key = keyPrefix + identity + '.' + clean.transaction_id;
        if (sent.has(key)) return;
        try { if (w.sessionStorage.getItem(key) === '1') return; } catch (_) {}
        command('event', event, { ...clean, send_to: identity });
        sent.add(key);
        try { w.sessionStorage.setItem(key, '1'); } catch (_) {}
      } else command('event', event, { ...clean, send_to: identity });
    },
  };
}

// Explicit allowlist: never forward raw product/order/profile objects.
export function sanitizeGa4Event(event, data) {
  if (!['view_item', 'add_to_cart', 'begin_checkout', 'purchase'].includes(event) || !data) return null;
  const items = (Array.isArray(data.items) ? data.items : []).slice(0, 200).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const id = String(item.item_id ?? '');
    const quantity = Number(item.quantity);
    if (!/^[1-9][0-9]{0,14}$/.test(id) || !Number.isFinite(quantity) || quantity <= 0) return [];
    const clean = { item_id: id, quantity };
    if (typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0) clean.price = item.price;
    return [clean];
  });
  const result = { currency: 'EUR', items };
  if (typeof data.value === 'number' && Number.isFinite(data.value) && data.value >= 0) result.value = data.value;
  if (event === 'purchase') {
    if (!/^WEB-\d+-\d{8}-[A-F0-9]{6}$/.test(data.transaction_id || '') || result.value === undefined) return null;
    result.transaction_id = data.transaction_id;
  } else if (!items.length) return null;
  return result;
}
