/* =====================================================================
   WSOrders : order placement API stub
   ---------------------------------------------------------------------
   The checkout wizard calls WSOrders.place(payload) to confirm an order.
   To wire a real backend, set:
     window.WSOrders.endpoint = 'https://your-host/orders';
   Endpoints expected:
     POST {endpoint}                     -> { orderId, status, total, paymentUrl? }
     POST {payEndpoint} {orderId}        -> { ok, checkoutUrl }   (paiement hébergé)
     GET  {endpoint}/:id                 -> Order
     GET  {endpoint}/me                  -> Order[]  (current customer)
     POST {endpoint}/:id/cancel          -> { ok }

   Request body for POST {endpoint}:
   {
     shopId, mode,
     slot:     { date, slotId, label },
     basket:   [{ productId, qty, portion?, options?, bundleId?, bundleSlots? }],
     voucher:  "CODE" | null,
     customer: { id?, email, firstName, lastName, phone, officeId? },
     payment:  { method },
     delivery: { officeId?, tourId?, address? }   // delivery mode only
   }
   ===================================================================== */
(function () {
  /* Jeton porteur, source unique du module. Seul `place` le transmettait ; get,
     listMine et cancel appelaient des routes qui exigent d'être le PROPRIÉTAIRE
     connecté (GET /orders/:id le vérifie explicitement). Sans en-tête, elles
     répondent 401 : silencieusement converti en `null` ou `[]`, c'est-à-dire en
     « vous n'avez aucune commande ». */
  const authHeaders = () => {
    if (window.WSAuth && typeof window.WSAuth.authHeaders === 'function') return window.WSAuth.authHeaders();
    try { const t = window.WSSessionStorage.getItem('ws_auth_token'); return t ? { 'Authorization': 'Bearer ' + t } : {}; }
    catch (_) { return {}; }
  };

  const api = {
    endpoint: null,
    payEndpoint: null,   // POST /payments/checkout, session de paiement hébergée

    /* Place an order. Throws on network / server error. */
    async place(payload) {
      if (api.endpoint) {
        const r = await fetch(api.endpoint, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          if (!j || typeof j.orderRef !== 'string' || !j.orderRef.trim()) {
            throw new Error('Order confirmation is invalid.');
          }
          const result = { ok: true, ...j };
          if (result.guestAccessToken && result.orderRef) {
            try { sessionStorage.setItem('ws.order.token.' + result.orderRef, result.guestAccessToken); } catch (_) {}
          }
          if (result.paymentType === 'stripe' && result.orderRef) {
            try { sessionStorage.setItem('ws.pendingPay', JSON.stringify({ orderRef: result.orderRef })); sessionStorage.setItem('ws.lastPay', result.orderRef); } catch (_) {}
          }
          return result;
        }
        // L'API renvoie {error:"…", detail:"…"}, on AFFICHE la cause réelle
        // (avant : « Erreur 500 » générique alors que le motif était dans la réponse).
        const base = (typeof j.error === 'string' && j.error)
          ? j.error
          : (j.error?.message || j.description || `Error ${r.status}`);
        // « Stock insuffisant » sans nom de produit est inutilisable sur un
        // panier de dix lignes : le client ne sait pas quoi retirer. Le serveur
        // renvoie product et available, on les affiche.
        const quoi = j.product ? ` : « ${j.product} »` : '';
        const reste = (typeof j.available === 'number')
          ? (j.available > 0 ? ` (il en reste ${j.available})` : ' (il n\'en reste aucune)')
          : '';
        const error = new Error(base + quoi + reste + (j.detail ? (', ' + j.detail) : ''));
        error.status = r.status;
        error.orderRejected = r.status >= 400 && r.status < 500 && r.status !== 408;
        error.code = j.code || j.error?.code || j.description;
        error.quote = j.errors?.quote || j.error?.errors?.quote;
        throw error;
      }
      // Go-live : plus de simulation de commande. Sans API configurée, on
      // refuse : une commande ne peut jamais « réussir » à blanc.
      throw new Error('API commandes indisponible : commande non enregistrée.');
    },

    /* Démarre le PAIEMENT HÉBERGÉ (Stripe Checkout) d'une commande DÉJÀ
       enregistrée par place(). Rend { ok, orderId, checkoutUrl } ; jette avec
       le motif serveur sinon (503 Stripe non configuré, 502 échec Stripe).
       Étape séparée de place() : l'enregistrement et l'encaissement sont deux
       routes serveur distinctes, le serveur confirme le paiement auprès de Stripe. */
    async pay(orderRef) {
      if (!orderRef || !api.endpoint) throw new Error('Payment API is unavailable.');
      let guestToken = null;
      try { guestToken = sessionStorage.getItem('ws.order.token.' + orderRef); } catch (_) {}
      const returnUrl = new URL(window.location.pathname, window.location.origin);
      const response = await window.WSAuth.authenticatedFetch(`${api.endpoint}/${encodeURIComponent(orderRef)}/stripe-checkout`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(guestToken ? { 'X-Webshop-Order-Token': guestToken } : {}) },
        body: JSON.stringify({ return_url: returnUrl.href, locale: window.WSI18n?.getLang?.() || 'en', ui_mode: 'embedded' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = result.code || result.error?.code || result.description;
        const allowed = ['WEBSHOP_STRIPE_AMOUNT_INVALID', 'WEBSHOP_STRIPE_NOT_CONFIGURED', 'WEBSHOP_STRIPE_RECONCILIATION_REQUIRED', 'WEBSHOP_STRIPE_RETURN_URL_INVALID'];
        const error = new Error('Payment session could not be created.');
        if (allowed.includes(code)) error.code = code;
        throw error;
      }
      if (result.status === 'paid') return result;
      if (result.uiMode === 'embedded' && result.status === 'open') {
        if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(result.publishableKey || '') || !/^acct_[A-Za-z0-9]+$/.test(result.stripeAccount || '') || !/^cs_[A-Za-z0-9_]+_secret_/.test(result.clientSecret || '')) throw new Error('Payment session is invalid.');
        return result;
      }
      if (result.status === 'pending') {
        returnUrl.searchParams.set('stripe', 'return'); returnUrl.searchParams.set('orderRef', orderRef);
        return { ...result, pendingUrl: returnUrl.href };
      }
      let url;
      try { url = new URL(result.url); } catch (_) { throw new Error('Payment redirect is invalid.'); }
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Payment redirect is invalid.');
      return { ...result, checkoutUrl: url.href };
    },

    // Reconcile an existing payment. This endpoint never creates a payment or order.
    async paymentStatus(orderRef) {
      if (!orderRef || !api.endpoint) throw new Error('Payment API is unavailable.');
      let guestToken = null;
      try { guestToken = sessionStorage.getItem('ws.order.token.' + orderRef); } catch (_) {}
      const response = await window.WSAuth.authenticatedFetch(`${api.endpoint}/${encodeURIComponent(orderRef)}/stripe-status`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(guestToken ? { 'X-Webshop-Order-Token': guestToken } : {}) },
        body: '{}',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !['paid', 'unpaid', 'processing', 'expired', 'not_started', 'pending'].includes(result?.status)) {
        throw new Error('Payment status could not be verified.');
      }
      return result;
    },

    /* Fetch a single order (e.g. for the confirmation page). */
    async get(id) {
      if (!id) return null;
      if (api.endpoint) {
        try {
          let guestToken = null;
          try { guestToken = sessionStorage.getItem('ws.order.token.' + id); } catch (_) {}
          const headers = { ...authHeaders(), ...(guestToken ? { 'X-Webshop-Order-Token': guestToken } : {}) };
          const r = await fetch(`${api.endpoint}/${encodeURIComponent(id)}`, { credentials: 'include', headers });
          if (r.ok) return await r.json();
          console.error('[commandes] lecture refusée, HTTP ' + r.status);
        } catch (e) { console.error('[commandes] lecture injoignable', e); }
      }
      return null;
    },

    /* List the current customer's orders. */
    async listMine() {
      if (!api.endpoint) throw new Error('Order API is unavailable.');
      let r;
      try {
        r = await fetch(`${api.endpoint}/me`, { credentials: 'include', headers: authHeaders() });
      } catch (_) {
        throw new Error('Order history could not be loaded.');
      }
      if (!r.ok) throw new Error('Order history could not be loaded (HTTP ' + r.status + ').');
      const payload = await r.json().catch(() => null);
      if (!Array.isArray(payload)) throw new Error('Order history response is invalid.');
      return payload;
    },

    /* Cancel an order (server enforces cutoff rules). */
    async cancel(id) {
      if (!id) return { ok: false };
      if (api.endpoint) {
        try {
          let guestToken = null;
          try { guestToken = sessionStorage.getItem('ws.order.token.' + id); } catch (_) {}
          const r = await fetch(`${api.endpoint}/${encodeURIComponent(id)}/cancel`, {
            method: 'POST', credentials: 'include', headers: { ...authHeaders(), ...(guestToken ? { 'X-Webshop-Order-Token': guestToken } : {}) },
          });
          const j = await r.json().catch(() => ({}));
          return { ok: r.ok, ...j };
        } catch (_) {}
      }
      return { ok: false, error: 'API commandes indisponible' }; // Go-live : jamais de faux succès
    },
  };

  window.WSOrders = api;
})();
