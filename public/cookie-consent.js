/* First-party consent state. No Google/Meta code is loaded by this module.
 * Integration adapters must be audited and explicitly registered before activation. */
(function (w) {
  'use strict';
  if (w.WSConsent) return;
  const KEY = 'ws.consent', VERSION = 1, POLICY = 'atelierby-2026-01';
  const listeners = new Set(), adapters = new Map();
  let record = null, timer, configuration = null, policyVersion = POLICY;
  let cleanupIncomplete = false, reloadRequired = false;
  function sixMonthsAfter(timestamp) {
    const end = new Date(timestamp), day = end.getUTCDate();
    end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 6);
    const last = new Date(end.getTime()); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
    end.setUTCDate(Math.min(day, last.getUTCDate())); return end.getTime();
  }
  function removeInvalidChoice() {
    record = null;
    try { w.localStorage.removeItem(KEY); } catch (_) {}
  }
  // Only known optional first-party cookie names. Never clear storage wholesale.
  function cleanCookies(category) {
    const patterns = category === 'analytics'
      ? /^(?:_ga(?:_[A-Za-z0-9_-]+)?|_gid|_gat(?:_[A-Za-z0-9_-]+)?)$/
      : category === 'meta' ? /^(?:_fbp|_fbc)$/ : /^_gcl_(?:au|aw|dc|gs|gb)$/;
    if (!w.document || !w.location) return;
    try {
      const names = w.document.cookie.split(';').map(v => v.trim().split('=')[0]).filter(v => patterns.test(v));
      const paths = new Set(['/']);
      const parts = w.location.pathname.split('/').filter(Boolean);
      let path = '';
      for (const part of parts) { path += '/' + part; paths.add(path); paths.add(path + '/'); }
      const host = w.location.hostname, domains = ['', host];
      if (host === 'atelierby.be' || host.endsWith('.atelierby.be')) domains.push('atelierby.be');
      for (const name of names) for (const path of paths) for (const domain of domains) {
        w.document.cookie = name + '=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=' + path
          + (domain ? '; Domain=' + domain : '') + '; SameSite=Lax'
          + (w.location.protocol === 'https:' ? '; Secure' : '');
      }
      if (w.document.cookie.split(';').some(v => patterns.test(v.trim().split('=')[0]))) cleanupIncomplete = true;
    } catch (_) { cleanupIncomplete = true; }
  }
  function stopAdapter(a) {
    a.active = false; a.controller?.abort();
    try { a.stop(); } catch (_) { a.failed = true; reloadRequired = true; }
  }
  const denied = () => ({ analytics: false, advertising: false });
  function valid(r) {
    if (!r || r.version !== VERSION || r.policy !== policyVersion || r.scope !== 'atelierby'
      || typeof r.analytics !== 'boolean' || typeof r.advertising !== 'boolean'
      || !Number.isFinite(r.decidedAt) || !Number.isFinite(r.expiresAt)) return false;
    const limit = sixMonthsAfter(r.decidedAt);
    return r.decidedAt <= Date.now() && r.expiresAt > Date.now()
      && r.expiresAt > r.decidedAt && r.expiresAt <= limit;
  }
  function read() {
    let raw;
    try { raw = w.localStorage.getItem(KEY); }
    catch (_) { return valid(record) ? record : null; }
    try { const r = JSON.parse(raw); return valid(r) ? r : null; } catch (_) { return null; }
  }
  function snapshot() { return record && valid(record) ? { ...record } : null; }
  function notify() {
    const current = snapshot();
    for (const [id, a] of adapters) {
      const allowed = api.integrationAllowed(id) && !a.failed;
      const identity = configuration?.integrations[id]?.id;
      if (a.active && (!allowed || a.identity !== identity)) stopAdapter(a);
      if (allowed && !a.active && !a.failed) {
        a.controller = new AbortController(); a.active = true; a.identity = identity;
        const signal = a.controller.signal;
        try {
          const pending = a.start({ signal, id: identity, expiresAt: current.expiresAt, isAllowed: () => !signal.aborted && api.integrationAllowed(id) });
          if (pending && typeof pending.then === 'function') {
            Promise.resolve(pending).catch(() => {
              if (!signal.aborted) { a.failed = true; stopAdapter(a); notify(); }
            });
          }
        } catch (_) { a.failed = true; stopAdapter(a); }
      }
    }
    cleanupIncomplete = false;
    if (!current?.analytics || (configuration && !api.integrationAllowed('ga4'))) cleanCookies('analytics');
    if (!current?.advertising || (configuration && !api.integrationAllowed('googleAds'))) cleanCookies('advertising');
    if (!current?.advertising || (configuration && !api.integrationAllowed('meta'))) cleanCookies('meta');
    listeners.forEach(fn => { try { fn(current); } catch (_) {} });
    w.clearTimeout(timer);
    if (current) timer = w.setTimeout(() => { if (!valid(record)) removeInvalidChoice(); notify(); }, Math.min(current.expiresAt - Date.now() + 1, 2147483647));
  }
  record = read();
  const api = {
    get: snapshot,
    status() { return { cleanupIncomplete, reloadRequired }; },
    configuration() { return configuration ? JSON.parse(JSON.stringify(configuration)) : null; },
    configure(value) {
      // Never allow a remote response to silently change the consent contract.
      configuration = null;
      if (value && value.schemaVersion === 1 && value.scope === 'atelierby'
        && typeof value.policyVersion === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(value.policyVersion)
        && value.consentMode === 'basic'
        && value.choiceLifetimeMonths === 6 && ['draft', 'ready'].includes(value.status)) {
        if (value.policyVersion !== policyVersion) {
          policyVersion = value.policyVersion;
          const saved = read();
          if (saved) record = saved; else removeInvalidChoice();
        }
        const ids = { ga4: /^G-[A-Z0-9]+$/, googleAds: /^AW-[0-9]+$/, meta: /^[0-9]+$/ };
        const categories = { ga4: 'analytics', googleAds: 'advertising', meta: 'advertising' };
        const integrations = {};
        for (const id of Object.keys(ids)) {
          const item = value.integrations?.[id];
          integrations[id] = { category: categories[id], id: null, enabled: false };
          if (item?.enabled === true && item.category === categories[id]
            && typeof item.id === 'string' && ids[id].test(item.id)) {
            integrations[id] = { category: categories[id], id: item.id, enabled: true };
          }
        }
        const policies = {};
        for (const lang of ['fr', 'nl', 'pl']) {
          policies[lang] = {};
          for (const key of ['privacyUrl', 'cookiesUrl']) {
            const url = value.policies?.[lang]?.[key];
            try {
              const parsed = new URL(url);
              policies[lang][key] = typeof url === 'string' && parsed.protocol === 'https:'
                && !parsed.username && !parsed.password ? parsed.href : null;
            } catch (_) { policies[lang][key] = null; }
          }
        }
        const email = value.contact?.email;
        const contact = value.contact?.verified === true && typeof email === 'string' && email.length <= 254
          && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(email)
          ? { email, verified: true } : null;
        const controllerNotice = {};
        if (value.controllerRolesConfirmed === true) for (const lang of ['fr', 'nl', 'pl']) {
          const text = value.controllerNotice?.[lang];
          if (typeof text === 'string' && text.trim() && text.length <= 1000) controllerNotice[lang] = text.trim();
        }
        configuration = { schemaVersion: 1, scope: value.scope, policyVersion,
          consentMode: 'basic', choiceLifetimeMonths: 6, status: value.status, integrations, policies, contact, controllerNotice };
      }
      if (configuration) {
        // localStorage has no native TTL: prune stale records after the server policy is known.
        try {
          const raw = w.localStorage.getItem(KEY);
          if (raw !== null) {
            let stored; try { stored = JSON.parse(raw); } catch (_) {}
            if (!valid(stored)) w.localStorage.removeItem(KEY);
          }
        } catch (_) {}
      }
      notify(); return configuration !== null;
    },
    integrationAllowed(id) {
      const integration = configuration?.integrations[id];
      return configuration?.status === 'ready' && integration?.enabled === true
        && api.allows(integration.category);
    },
    allows(category) { return ['analytics', 'advertising'].includes(category) && !!snapshot()?.[category]; },
    save(choice) {
      if (!choice || typeof choice.analytics !== 'boolean' || typeof choice.advertising !== 'boolean') throw new TypeError('Invalid consent choice');
      const now = Date.now(), expiresAt = sixMonthsAfter(now);
      record = { version: VERSION, policy: policyVersion, scope: 'atelierby', ...denied(), analytics: choice.analytics,
        advertising: choice.advertising, decidedAt: now, expiresAt };
      let persisted = false;
      try { w.localStorage.setItem(KEY, JSON.stringify(record)); persisted = true; } catch (_) {}
      notify(); return { persisted };
    },
    reject() { return api.save(denied()); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    open() { w.dispatchEvent(new Event('ws:consent-open')); },
    // No built-in integrations: owning code must implement both start and effective stop/cleanup.
    register(id, adapter) {
      if (adapters.has(id) || !['ga4', 'googleAds', 'meta'].includes(id)
        || adapter.category !== (id === 'ga4' ? 'analytics' : 'advertising')
        || typeof adapter.start !== 'function' || typeof adapter.stop !== 'function') throw new TypeError('Invalid consent adapter');
      adapters.set(id, { ...adapter, active: false }); notify();
    },
    track(category, event, payload) {
      if (!api.allows(category)) return;
      for (const a of adapters.values()) if (a.category === category && a.active && typeof a.track === 'function') {
        try { a.track(event, payload); } catch (_) {}
      }
    },
  };
  w.addEventListener('storage', e => { if ((!e.storageArea || e.storageArea === w.localStorage) && (e.key === KEY || e.key === null)) { record = read(); notify(); } });
  w.addEventListener('pageshow', () => { record = read(); notify(); });
  w.addEventListener('focus', () => { record = read(); notify(); });
  w.WSConsent = Object.freeze(api); notify();
})(window);
