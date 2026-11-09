/* =====================================================================
   WSAuth : authentification / session : central API uniquement
   ---------------------------------------------------------------------
   Go-live : aucun store local, aucun repli. Sans endpoint (ou en cas de
   panne réseau), les helpers renvoient une erreur explicite, jamais une
   session fabriquée. Câblage :
     window.WSAuth.endpoint = 'https://your-host/clients/auth';
   Endpoints expected:
     POST {endpoint}/register            -> session tokens
     POST {endpoint}/login               -> session tokens
     POST {endpoint}/refresh             -> rotated session tokens
     POST {endpoint}/logout              -> { ok }, accepts refresh_token
     GET  {endpoint}/me                  -> { user }
     PATCH {endpoint}/me                 -> { user }

   Browser session: refresh uses a Secure HttpOnly SameSite=Lax cookie and
   requires a same-site API (production: /api/v1 on the WebShop hostname).
   The access JWT stays in page memory and is sent as Authorization: Bearer
   on protected API calls. Browser refresh tokens are never exposed in JSON.
   ===================================================================== */
(function () {
  const TOKEN_KEY = 'ws_auth_token';
  const REFRESH_TOKEN_KEY = 'ws_auth_refresh_token';
  let refreshPending = null;
  let sessionGeneration = 0;
  let loginAttempt = 0;
  // Access tokens stay in page memory. Migrate an existing tab session once.
  const readLegacy = key => { try { return window.WSSessionStorage.getItem(key); } catch (_) { return null; } };
  let accessToken = readLegacy(TOKEN_KEY);
  let legacyRefresh = readLegacy(REFRESH_TOKEN_KEY);
  for (const key of [TOKEN_KEY, REFRESH_TOKEN_KEY]) {
    try { window.WSSessionStorage.removeItem(key); } catch (_) {}
  }
  const loggedOut = () => { try { return window.localStorage.getItem('ws.auth.loggedOut') === '1'; } catch (_) { return false; } };
  const rememberLogout = value => {
    try { value ? window.localStorage.setItem('ws.auth.loggedOut', '1') : window.localStorage.removeItem('ws.auth.loggedOut'); } catch (_) {}
  };
  let restoreAllowed = !loggedOut();
  if (!restoreAllowed) { accessToken = null; legacyRefresh = null; }
  const getToken = () => accessToken;
  const getRefreshToken = () => legacyRefresh || (restoreAllowed ? '@cookie' : null);
  const setToken = token => { accessToken = token; };
  const setRefreshToken = token => { legacyRefresh = token; };
  let sessionPresent = Boolean(accessToken);
  let mutationPending = Promise.resolve();
  // Serialise cookie rotation/login/logout, including across tabs when Web Locks is available.
  const sessionMutation = work => {
    const run = () => typeof navigator !== 'undefined' && navigator.locks?.request
      ? navigator.locks.request('webshop-auth-session', work) : work();
    const pending = mutationPending.catch(() => {}).then(run);
    mutationPending = pending;
    return pending;
  };
  const browserHeaders = () => ({ 'Content-Type': 'application/json', 'X-Webshop-Session': 'cookie' });
  let sessionChannel = null;
  try { if (typeof BroadcastChannel === 'function') sessionChannel = new BroadcastChannel('webshop-auth-session'); } catch (_) {}
  const announce = type => sessionChannel?.postMessage({type});
  const notifySessionEnded = () => {
    if (typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
      window.dispatchEvent(new Event('ws:session-ended'));
    }
  };
  const clearSession = (cancelLogin = true) => {
    sessionGeneration++;
    if (cancelLogin) loginAttempt++;
    refreshPending = null;
    sessionPresent = false;
    setToken(null); setRefreshToken(null);
    restoreAllowed = false;
    window.WSSessionStorage?.clearCustomer?.();
    notifySessionEnded();
  };
  const setSession = session => {
    const token = session?.access_token;
    if (typeof token !== 'string' || !token.trim() || session.session_transport !== 'cookie') return false;
    setToken(token);
    setRefreshToken(null);
    restoreAllowed = true;
    sessionPresent = true;
    return true;
  };
  const sessionChanged = () => Object.assign(new Error('SESSION_CHANGED'), { code: 'SESSION_CHANGED' });
  const assertSession = generation => { if (generation !== sessionGeneration) throw sessionChanged(); };
  const revoke = async refreshToken => {
    if (!api.endpoint || !refreshToken) return;
    try {
      await fetch(`${api.endpoint}/logout`, {
        keepalive: true, method: 'POST', credentials: 'include', headers: browserHeaders(),
        body: JSON.stringify(refreshToken === '@cookie' ? {} : { refresh_token: refreshToken }),
      });
    } catch (_) { /* Local session removal never depends on network availability. */ }
  };
  const acceptLogin = async (session, attempt, generation) => {
    if (attempt !== loginAttempt || generation !== sessionGeneration) {
      await revoke('@cookie');
      return { ok: false, error: 'SESSION_CHANGED' };
    }
    const replacingSession = sessionPresent;
    if (!setSession(session)) return { ok: false, error: 'Invalid session response.' };
    const acceptedGeneration = ++sessionGeneration;
    refreshPending = null;
    window.WSSessionStorage?.clearCustomer?.();
    if (replacingSession) notifySessionEnded();
    const user = await api.me();
    if (acceptedGeneration !== sessionGeneration || attempt !== loginAttempt) return { ok: false, error: 'SESSION_CHANGED' };
    if (user) { rememberLogout(false); announce('login'); return { ok: true, user }; }
    const refreshToken = getRefreshToken();
    clearSession();
    await revoke(refreshToken);
    return { ok: false, error: 'Could not load the account profile.' };
  };
  const authHeaders = () => { const t = getToken(); return t ? { 'Authorization': 'Bearer ' + t } : {}; };
  const expiresSoon = () => {
    try {
      const payload = getToken()?.split('.')[1];
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return Number(claims.exp) * 1000 <= Date.now() + 120000;
    } catch (_) { return false; }
  };
  const errorMessage = (response, fallback) => response?.description || response?.message || response?.error?.message || response?.error || fallback;
  const shopPhone = (phone, prefix) => {
    const value = String(phone || '').trim().replace(/^00/, '+');
    if (!value || value.startsWith('+') || value.includes('@')) return value;
    const callingCode = String(prefix || '+32').trim();
    const digits = value.replace(/[^0-9]/g, '');
    // Italy keeps the leading zero in international landline numbers.
    return callingCode + (callingCode === '+39' ? digits : digits.replace(/^0+/, ''));
  };
  const currentLocale = () => {
    try { return window.WSI18n?.getLang() || window.WSSessionStorage.getItem('ws.lang') || navigator.language || 'en'; } catch (_) { return 'en'; }
  };

  const api = {
    endpoint: null,
    configEndpoint: null,

    /* En-têtes d'authentification, PARTAGÉS. L'authentification est par jeton
       Bearer, jamais par cookie : un module qui appelle un endpoint protégé
       sans cet en-tête reçoit 401 quoi qu'il arrive, même client connecté.
       C'était le cas de WSOffices.contactFranchise, d'où « Connectez-vous pour
       demander un rattachement » sur une session parfaitement valide. La clé
       du jeton reste privée ; seul son en-tête sort d'ici. */
    authHeaders,

    /* ── Login (identifiant = email OU téléphone) ──────────────────── */
    async login({ identifier, email, password, phonePrefix, authMethod }) {
      const ident = (identifier || email || '').trim();
      if (!api.endpoint) return { ok: false, error: 'Service de connexion non configuré, please debug.' };
      const attempt = ++loginAttempt;
      return sessionMutation(async () => {
        if (attempt !== loginAttempt) return { ok: false, error: 'SESSION_CHANGED' };
        const generation = sessionGeneration;
        try {
          const r = await fetch(`${api.endpoint}/login`, {
            method: 'POST', credentials: 'include',
            headers: browserHeaders(),
            body: JSON.stringify({ login: shopPhone(ident, phonePrefix), password }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return { ok: false, error: errorMessage(j, 'Unable to sign in.'), status: r.status };
          return await acceptLogin(j, attempt, generation);
        } catch (_) {
          return { ok: false, error: 'Réseau indisponible, connexion impossible.' };
        }
      });
    },

    /* ── Register ──────────────────────────────────────────────────── */
    async resendActivation(email) {
      if (!api.endpoint) return { ok: false, error: 'CLIENT_ACTIVATION_UNAVAILABLE' };
      try {
        const r = await fetch(`${api.endpoint}/activation/resend`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const j = await r.json().catch(() => ({}));
        return r.ok ? { ok: true } : { ok: false, error: errorMessage(j, 'CLIENT_ACTIVATION_MAIL_FAILED') };
      } catch (_) { return { ok: false, error: 'CLIENT_ACTIVATION_MAIL_FAILED' }; }
    },

    async register({ email, phone, phonePrefix, password, firstName, lastName, postalCode, locality, authMethod, shopId }) {
      const attempt = ++loginAttempt;
      const generation = sessionGeneration;
      if (api.endpoint) {
        try {
          const r = await fetch(`${api.endpoint}/register`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_main_shop: Number(shopId), name: firstName, surname: lastName, email,
              phone: shopPhone(phone, phonePrefix), password, password_confirm: password,
              zip: postalCode || null, locality: locality || null, locale: currentLocale(),
            }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return { ok: false, error: errorMessage(j, 'Unable to create the account.'), exists: r.status === 409, status: r.status };
          if (attempt !== loginAttempt || generation !== sessionGeneration) {
            // Registration no longer creates a browser session.
            return { ok: false, error: 'SESSION_CHANGED' };
          }
          if (j.registered === true && j.activation_required === false) return api.login({ identifier: email, password });
          if (j.activation_required === true) return { ok: true, activationRequired: true, emailSent: j.activation_email_sent === true };
          return await acceptLogin(j, attempt, generation);
        } catch (_) {
          return { ok: false, error: 'Réseau indisponible, inscription impossible.' };
        }
      }
      return { ok: false, error: 'Service inscription indisponible, réessayez.' };
    },

    /* ── Rattachement à la fiche de la boutique ──────────────────────────
       Le client qui achète au comptoir a une fiche chez son franchisé. La
       relier à son compte lui rend son historique d'achats et sa fidélité.
       Le webshop n'ayant aucune vérification d'identité, la demande est
       ARBITRÉE par la boutique : ces trois appels déposent, consultent et
       annulent une demande : aucun ne rattache quoi que ce soit.
       La cible n'est jamais transmise : le serveur la retrouve depuis le
       téléphone du compte connecté. */
    async linkState() {
      if (!api.endpoint) return { etat: 'indisponible' };
      try {
        const r = await fetch(`${api.endpoint}/account/link-request`, { headers: authHeaders() });
        if (!r.ok) return { etat: 'indisponible' };
        return await r.json();
      } catch (_) { return { etat: 'indisponible' }; }
    },
    async linkAsk() {
      if (!api.endpoint) return { ok: false, error: 'Service indisponible.' };
      try {
        const r = await fetch(`${api.endpoint}/account/link-request`, { method: 'POST', headers: authHeaders() });
        const j = await r.json();
        return r.ok ? { ok: true, etat: j.etat || 'pending' }
                    : { ok: false, error: j.error || 'Demande impossible.' };
      } catch (_) { return { ok: false, error: 'Réseau indisponible.' }; }
    },
    async linkCancel() {
      if (!api.endpoint) return { ok: false };
      try {
        const r = await fetch(`${api.endpoint}/account/link-request`, { method: 'DELETE', headers: authHeaders() });
        return { ok: r.ok };
      } catch (_) { return { ok: false }; }
    },

    /* Password reset via SMS: no legacy ERP session and no automatic login. */
    async otpRequest({ phone, phonePrefix }) {
      if (!api.endpoint) return { ok: false, error: 'SMS_RESET_UNAVAILABLE' };
      try {
        const r = await fetch(`${api.endpoint}/password/reset/sms/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: shopPhone(phone, phonePrefix), locale: currentLocale() }),
        });
        const j = await r.json();
        if (r.ok && /^[a-f0-9]{64}$/.test(j.request_token || '')) return { ok: true, ...j };
        return { ok: false, error: errorMessage(j, 'SMS_RESET_UNAVAILABLE') };
      } catch (_) { return { ok: false, error: 'SMS_RESET_UNAVAILABLE' }; }
    },

    async otpSetPassword({ requestToken, code, password, passwordConfirm }) {
      if (!api.endpoint) return { ok: false, error: 'SMS_RESET_UNAVAILABLE' };
      try {
        const r = await fetch(`${api.endpoint}/password/reset/sms/confirm`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_token: requestToken, code, new_password: password, new_password_confirm: passwordConfirm }),
        });
        const j = await r.json();
        if (r.ok && j.ok === true) { clearSession(); return { ok: true }; }
        return { ok: false, error: errorMessage(j, 'SMS_RESET_UNAVAILABLE') };
      } catch (_) { return { ok: false, error: 'SMS_RESET_UNAVAILABLE' }; }
    },

    // Legacy prototype entry points have no central API contract. Never accept
    // their single `token` response beside another customer's refresh token.
    async setPassword({ email, phone, phonePrefix, identifier, password }) {
      return { ok: false, code: 'PASSWORD_RESET_REQUIRED', error: 'Use the password reset form.' };
    },

    // Compatibility result for old callers; Fidelity has no separate login.
    async handoff(token) {
      return { ok: false, code: 'HANDOFF_UNAVAILABLE', error: 'Sign in with your Webshop account.' };
    },

    /* ── Vérification TVA + liaison société (persistée) : miroir de la PWA
       POST /client/billing : VIES côté serveur, puis raison sociale/adresse/
       verified_at écrits sur la fiche client partagée. */
    async billingVerify({ vat, country }) {
      const failure = (code) => {
        const keys = {
          VIES_INPUT_INVALID: 'error.viesInput', VIES_VAT_INVALID: 'error.vat',
          VIES_BUSY: 'error.viesBusy', VIES_UNAVAILABLE: 'error.vies', VIES_AUTH_REQUIRED: 'error.viesAuth',
          VIES_SAVE_FAILED: 'error.viesSave', VIES_ENDPOINT_UNAVAILABLE: 'error.verifyUnavailable',
          VIES_COMPANY_MANAGED_BY_SHOP: 'error.viesCompanyManaged',
        };
        const key = keys[code] || 'error.verifyUnavailable';
        return { ok: false, error: { code: code === 'VIES_VAT_INVALID' || code === 'VIES_INPUT_INVALID' ? 'invalid' : 'unavailable', message: window.WSI18n?.t?.(key) || 'Verification failed. Please try again.' } };
      };
      if (!api.endpoint) return failure('VIES_ENDPOINT_UNAVAILABLE');
      try {
        const { response: r, data: j } = await api.authenticatedJson(`${api.endpoint}/billing-verify`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ vat, country }),
        });
        if (r.ok && j?.valid === true && j.user) return { ok: true, data: j.data, user: j.user };
        if (r.status === 401 || r.status === 403) return failure('VIES_AUTH_REQUIRED');
        return failure(j?.description || 'VIES_ENDPOINT_UNAVAILABLE');
      } catch (_) {
        return failure('VIES_ENDPOINT_UNAVAILABLE');
      }
    },

    /* ── Bureau (site de livraison) : liste par shop + liaison (parité PWA) ── */
    // q : terme de recherche. Le serveur ne rend RIEN sans lui, on retrouve son
    // bureau parce qu'on le connaît, on ne feuillette pas le carnet d'adresses
    // B2B de la boutique.
    async listOfficeSites({ shopId, q }) {
      if (!api.endpoint || !shopId) return [];
      if (!q || String(q).trim().length < 2) return [];
      try {
        const base = api.endpoint.replace(/\/auth\/?$/, '');
        const r = await fetch(`${base}/office-sites?shopId=${encodeURIComponent(shopId)}&q=${encodeURIComponent(String(q).trim())}`, { credentials: 'include' });
        if (r.ok) { const j = await r.json(); return Array.isArray(j) ? j : []; }
      } catch (_) {}
      return [];
    },
    async setOfficeSite(siteId) {
      if (!api.endpoint) return { ok: false, error: 'Service indisponible.' };
      try {
        const { response: r, data: j } = await api.authenticatedJson(`${api.endpoint}/office`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ siteId: siteId || null }),
        });
        if (r.ok) return { ok: true, user: j.user };
        return { ok: false, error: j.error || 'Échec de la liaison.' };
      } catch (_) {
        return { ok: false, error: 'Réseau indisponible.' };
      }
    },

    /* ── Config front (ws_param en liste blanche) : flag onglet Fidélité,
       icônes des deux touches de première position de la nav catégories…
       GO-LIVE : plus de repli codé en dur. L'ancien FALLBACK forçait
       fidelityTabEnabled:true, un onglet pouvait donc s'afficher alors que
       la boutique l'a désactivé en base. Sans config serveur on renvoie {} :
       l'UI applique ses propres règles d'absence, aucune option n'est
       inventée. ── */
    async config() {
      if (!api.configEndpoint) throw new Error('API configuration non disponible.');
      const r = await fetch(api.configEndpoint, { credentials: 'include' });
      if (!r.ok) throw new Error('Configuration indisponible (HTTP ' + r.status + ').');
      return await r.json();
    },

    /* ── Mes achats : liste unifiée tickets + commandes (12 mois, paginée) ── */
    async listPurchases({ filter, page, perPage } = {}) {
      if (!api.endpoint) return { items: [], total: 0, canRequestInvoice: false };
      try {
        const qs = new URLSearchParams();
        if (filter) qs.set('filter', filter);
        if (page) qs.set('page', String(page));
        if (perPage) qs.set('perPage', String(perPage));
        const r = await fetch(`${api.endpoint}/purchases?${qs}`, { credentials: 'include', headers: authHeaders() });
        if (r.ok) return await r.json();
      } catch (_) {}
      return { items: [], total: 0, canRequestInvoice: false };
    },

    /* ── « Facturer à une autre société » : VIES par le seul numéro de TVA,
       SANS lier cette société au compte. Rend la fiche société (id, nom,
       adresse) que la demande de facture recevra ensuite en billingEntityId.
       Aucune saisie libre de nom ou d'adresse : ce que VIES rend fait foi. */
    async billingEntityLookup({ vat }) {
      if (!api.endpoint) return { ok: false, error: 'Service indisponible.' };
      try {
        const r = await fetch(`${api.endpoint}/purchases/billing-entity`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ vat }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.entity) return { ok: true, entity: j.entity };
        const e = j.error;
        return { ok: false, error: (e && e.message) || e || 'Numéro de TVA non reconnu.' };
      } catch (_) { return { ok: false, error: 'VIES indisponible. Réessayez.' }; }
    },

    /* ── Demande de facture (to_invoice 1/0 + destinataire) sur un ticket
       de caisse OU une commande webshop : même appel, le serveur reconnaît la
       référence et applique les règles de sa source. ── */
    async requestInvoice({ ref, want, billingEntityId }) {
      if (!api.endpoint) return { ok: false, error: 'Service indisponible.' };
      try {
        const r = await fetch(`${api.endpoint}/purchases/request-invoice`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ ref, want: want ? 1 : 0, billingEntityId: billingEntityId ?? null }),
        });
        const j = await r.json();
        if (r.ok) return { ok: true, notice: j.notice };
        return { ok: false, error: j.error || 'Échec de la demande.' };
      } catch (_) { return { ok: false, error: 'Réseau indisponible.' }; }
    },

    /* ── Sécurité : changement de mot de passe de la session ── */
    /* Changement de mot de passe : l'ERP exige le mot de passe actuel. */
    async changePassword({ currentPassword, password }) {
      if (!api.endpoint) return { ok: false, error: 'Service indisponible.' };
      try {
        const r = await fetch(`${api.endpoint}/password/change`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: password,
            new_password_confirm: password,
          }),
        });
        const j = await r.json().catch(() => ({}));
        return r.ok ? { ok: true } : { ok: false, error: errorMessage(j, 'Password update rejected.') };
      } catch (_) { return { ok: false, error: 'Réseau indisponible.' }; }
    },

    /* Mot de passe oublié : l'ERP envoie l'e-mail. 202 quoi qu'il arrive,
       l'écran affiche un message neutre (aucune révélation de compte). */
    async resetRequest({ email }) {
      if (!api.endpoint) return { ok: false, error: 'Service indisponible.' };
      try {
        const r = await fetch(`${api.endpoint}/password/reset/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const j = await r.json().catch(() => ({}));
        return r.ok ? { ok: true } : { ok: false, error: j.message || j.error || 'Envoi impossible.' };
      } catch (_) { return { ok: false, error: 'Réseau indisponible.' }; }
    },
    async resetConfirm({ token, password }) {
      if (!api.endpoint) return { ok: false, error: 'Service indisponible.' };
      try {
        const r = await fetch(`${api.endpoint}/password/reset/confirm`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, new_password: password, new_password_confirm: password }),
        });
        const j = await r.json().catch(() => ({}));
        return r.ok ? { ok: true } : { ok: false, error: j.message || j.error || 'Échec.' };
      } catch (_) { return { ok: false, error: 'Réseau indisponible.' }; }
    },

    /* ── Société sans n° TVA (non assujettie) / archivage du lien ── */
    async addCompanyNoVat({ name, address, postalCode, city }) {
      if (!api.endpoint) return { ok: false, error: 'Service indisponible.' };
      try {
        const { response: r, data: j } = await api.authenticatedJson(`${api.endpoint}/billing-company`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ name, address, postalCode, city }),
        });
        if (r.ok) return { ok: true, user: j.user };
        return { ok: false, error: j.error || 'Échec de l\'ajout.' };
      } catch (_) { return { ok: false, error: 'Réseau indisponible.' }; }
    },
    async unlinkCompany() {
      const error = (key = 'error.billingUnlink') => ({ ok: false, error: window.WSI18n?.t?.(key) || 'Could not remove billing details. Please try again.' });
      if (!api.endpoint) return error();
      try {
        const { response: r, data: j } = await api.authenticatedJson(`${api.endpoint}/billing-company/unlink`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
        });
        if (r.ok && j?.ok === true && j.user) return { ok: true, user: j.user };
        if (r.status === 401 || r.status === 403) return error('error.viesAuth');
        if (j?.description === 'VIES_COMPANY_MANAGED_BY_SHOP') return error('error.viesCompanyManaged');
        return error();
      } catch (_) { return error(); }
    },

    /* ── Logout ─────────────────────────────────────────────────────── */
    async logout() {
      const refreshToken = getRefreshToken() || '@cookie';
      rememberLogout(true);
      clearSession(); // Local logout must not wait for the network.
      announce('logout');
      try {
        sessionStorage.removeItem('ws.pendingPay');
        sessionStorage.removeItem('ws.lastPay');
        Object.keys(sessionStorage).filter(key => key.startsWith('ws.order.token.')).forEach(key => sessionStorage.removeItem(key));
      } catch (_) {}
      window.dispatchEvent(new Event('ws:payment-logout'));
      await sessionMutation(() => revoke(refreshToken));
      return { ok: true };
    },

    /* ── Session check (GET /me) ─────────────────────────────────────── */
    async me() {
      const generation = sessionGeneration;
      if (api.endpoint) {
        if (!getToken() && !getRefreshToken()) {
          if (sessionPresent) clearSession();
          return null;
        }
        try {
          const { response: r, data: j } = await api.authenticatedJson(`${api.endpoint}/me`, { credentials: 'include' });
          assertSession(generation);
          if (!getToken()) return null;
          if (r.ok) {
            const user = j.user || j;
            return Number.isSafeInteger(Number(user?.id)) && Number(user.id) > 0 ? user : null;
          }
          if (r.status === 401 || r.status === 403) clearSession();
          // Toute autre réponse était avalée : une session perdue pour cause de
          // panne serveur ressemblait trait pour trait à « pas de session ».
          else console.error('[auth] session non restaurée, /me a répondu HTTP ' + r.status);
        } catch (e) { if (e.code !== 'SESSION_CHANGED') console.error('[auth] session non restaurée, /me injoignable', e); }
        return null;
      }
      return null; // No session in demo mode
    },

    /* ── Profile update (PATCH /me) ──────────────────────────────────── */
    async updateMe(patch) {
      const generation = sessionGeneration;
      const payload = { ...patch };
      // Empty locality means "not supplied", not a request to clear an existing city.
      if (payload.locality == null || (typeof payload.locality === 'string' && !payload.locality.trim())) delete payload.locality;
      if (api.endpoint) {
        try {
          const { response: r, data: j } = await api.authenticatedJson(`${api.endpoint}/me`, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload),
          });
          assertSession(generation);
          const user = j?.user || j;
          if (r.ok && Number.isSafeInteger(Number(user?.id)) && Number(user.id) > 0) return { ok: true, user };
          if (r.status === 401 || r.status === 403) clearSession();
          return { ok: false, error: errorMessage(j, 'Profile update rejected.') };
        } catch (e) { if (e.code === 'SESSION_CHANGED') return { ok: false, error: 'SESSION_CHANGED' }; }
      }
      // Go-live : plus de mutation d'un store local fictif.
      return { ok: false, error: 'Service profil indisponible, réessayez.' };
    },

    async authenticatedFetch(url, options = {}) {
      const generation = sessionGeneration;
      await api.ensureFreshSession();
      assertSession(generation);
      const token = getToken();
      const request = () => {
        const headers = { ...options.headers };
        delete headers.Authorization;
        return fetch(url, { ...options, headers: { ...headers, ...authHeaders() } });
      };
      let response = await request();
      assertSession(generation);
      if (response.status === 401 && getRefreshToken()) {
        const renewed = token !== getToken() || await api.refresh();
        // Rejection of this session is returned as 401. A different signed-in
        // customer must never inherit a replay of the previous customer's call.
        if (generation !== sessionGeneration && !getToken()) return response;
        assertSession(generation);
        if (renewed) response = await request();
        assertSession(generation);
      }
      return response;
    },

    // Account-specific JSON (including future Fidelity reads) stays bound to
    // the same session through body decoding, not just until headers arrive.
    async authenticatedJson(url, options = {}) {
      const generation = sessionGeneration;
      const response = await api.authenticatedFetch(url, options);
      const data = await response.json();
      assertSession(generation);
      return { response, data };
    },

    async refresh() {
      if (refreshPending) return refreshPending;
      const generation = sessionGeneration;
      const pending = sessionMutation(() => generation === sessionGeneration ? api.refreshSession() : false);
      refreshPending = pending;
      try { return await pending; }
      finally { if (refreshPending === pending) refreshPending = null; }
    },

    async ensureFreshSession() {
      if (!getToken() && !getRefreshToken()) {
        if (sessionPresent) clearSession();
        return false;
      }
      if (api.endpoint && getRefreshToken() && (legacyRefresh || !getToken() || expiresSoon())) return api.refresh();
      return Boolean(getToken());
    },

    async refreshSession() {
      const refreshToken = getRefreshToken();
      const generation = sessionGeneration;
      if (!api.endpoint || !refreshToken) return false;
      try {
        const r = await fetch(`${api.endpoint}/refresh`, {
          method: 'POST', credentials: 'include', headers: browserHeaders(),
          body: JSON.stringify(refreshToken === '@cookie' ? {} : { refresh_token: refreshToken }),
        });
        const j = await r.json().catch(() => ({}));
        if (generation !== sessionGeneration || refreshToken !== getRefreshToken()) {
          if (r.ok) await revoke('@cookie');
          return Boolean(getToken() && getRefreshToken());
        }
        if (r.ok && setSession(j)) return true;
        if ((r.status === 401 || r.status === 403) && refreshToken === getRefreshToken()) clearSession(false);
      } catch (_) { /* A network failure does not invalidate the stored session. */ }
      return false;
    },

    /* ── Password reset ─────────────────────────────────────────────── */
    async requestPasswordReset({ email }) {
      if (api.endpoint) {
        try {
          const r = await fetch(`${api.endpoint}/password/reset/request`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          return { ok: r.ok };
        } catch (_) {}
      }
      return { ok: false }; // Go-live : jamais de faux succès
    },
  };

  if (sessionChannel) sessionChannel.onmessage = event => {
    if (!['login', 'logout'].includes(event.data?.type)) return;
    clearSession();
    restoreAllowed = event.data.type === 'login' && !loggedOut();
    if (restoreAllowed) window.dispatchEvent(new Event('ws:session-available'));
  };
  window.WSAuth = api;
  // Timers may pause on mobile. Also renew when returning to the shop or going online.
  const renewInBackground = () => {
    if (document.visibilityState !== 'hidden') api.ensureFreshSession().catch(() => {});
  };
  window.setInterval(renewInBackground, 30000);
  window.addEventListener('focus', renewInBackground);
  window.addEventListener('online', renewInBackground);
  document.addEventListener('visibilitychange', renewInBackground);
})();
