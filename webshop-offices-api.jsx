/* =====================================================================
   WSOffices : annuaire des bureaux (B2B) : SERVEUR UNIQUEMENT
   ---------------------------------------------------------------------
   Go-live : aucune donnée locale, aucun repli, aucun faux succès. Les
   bureaux viennent de /api/offices ; si l'appel échoue, l'écran doit
   afficher l'erreur : jamais une liste fabriquée.
     window.WSOffices.endpoint = '<base>/offices'   (câblé par l'app)
   ===================================================================== */
(function () {
  function noEndpoint() {
    throw new Error('API bureaux non configurée : please debug.');
  }

  /* L'API n'authentifie QUE par `Authorization: Bearer` (auth_uid() ne lit pas
     de cookie) : `credentials: 'include'` ne transporte aucune session. Un
     appel protégé sans cet en-tête renvoie donc 401 même pour un client
     connecté : c'est ce qui rendait la demande de rattachement impossible. */
  const authHeaders = () =>
    (window.WSAuth && typeof window.WSAuth.authHeaders === 'function') ? window.WSAuth.authHeaders() : {};

  const api = {
    endpoint: null,
    consumerEndpoint: null,
    async invitation(action, token) {
      const request = action === 'accept' ? window.WSAuth.authenticatedFetch.bind(window.WSAuth) : fetch;
      const response = await request(api.consumerEndpoint.replace(/\/offices$/, '/office-invites/') + action, {
        method: 'POST', headers: {...authHeaders(), 'Content-Type':'application/json'}, body: JSON.stringify({token}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error('Office invitation unavailable.');
      return data;
    },
    async consumerRequest(path, { method = 'GET', body } = {}) {
      if (!api.consumerEndpoint) throw new Error('Office API is not configured.');
      const response = await window.WSAuth.authenticatedFetch(api.consumerEndpoint + path, {
        method, credentials: 'include', headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = result.code || result.error?.code || result.description;
        const error = new Error(code || result?.error?.message || result?.message || 'Office request failed.');
        error.code = code; throw error;
      }
      return result;
    },
    async listAllMemberships() {
      const result = await api.consumerRequest('/me');
      if (!Array.isArray(result.offices)) throw new Error('Office memberships response is invalid.');
      return result.offices;
    },
    async deliveryPreference(shop) {
      const result = await api.consumerRequest('/delivery-preference?shop=' + encodeURIComponent(shop));
      return result.preference || null;
    },
    async saveDeliveryPreference(shop, officeId, siteId) {
      return api.consumerRequest('/delivery-preference', { method: 'POST', body: { shop, office_id: officeId, site_id: siteId } });
    },
    async listMemberships(shop) {
      const result = await api.consumerRequest('?shop=' + encodeURIComponent(shop));
      return Array.isArray(result.offices) ? result.offices : [];
    },
    async searchMemberships(body) {
      const result = await api.consumerRequest('/search', { method: 'POST', body });
      return Array.isArray(result.offices) ? result.offices : [];
    },
    joinMembership({ officeId, ...body }) {
      return api.consumerRequest('/' + encodeURIComponent(officeId) + '/join', { method: 'POST', body });
    },
    leaveMembership({ officeId, shop }) {
      return api.consumerRequest('/' + encodeURIComponent(officeId) + '/join?shop=' + encodeURIComponent(shop), { method: 'DELETE' });
    },
    catalogue({ shop, officeId, offerId, date }) {
      const query = new URLSearchParams({ shop: String(shop), lang_code: window.WSI18n?.getLang?.() || 'fr' });
      query.set('lang', window.WSI18n?.getLang?.() || 'fr');
      if (offerId) query.set('offer_id', String(offerId));
      if (date) query.set('date', date);
      return api.consumerRequest('/' + encodeURIComponent(officeId) + '/catalog?' + query);
    },
    delivery({ shop, officeId }) {
      return api.consumerRequest('/' + encodeURIComponent(officeId) + '/delivery?shop=' + encodeURIComponent(shop));
    },
    async deliverySlots({ shop, officeId, siteId, date }) {
      const query = new URLSearchParams({shop: String(shop), site_id: String(siteId), date});
      const result = await api.consumerRequest('/' + encodeURIComponent(officeId) + '/delivery/slots?' + query);
      if (!Array.isArray(result.slots)) throw new Error('Invalid office delivery slots response.');
      return result.slots;
    },

    // Bureaux VALIDÉS de la boutique (préférée) auxquels le client peut se
    // lier lui-même. Un bureau appartient à une boutique → toujours scoper.
    async listApproved(shopId) {
      if (!api.endpoint) noEndpoint();
      const q = '?status=validated' + (shopId ? '&shopId=' + encodeURIComponent(shopId) : '');
      const r = await fetch(api.endpoint + q, { credentials: 'include' });
      if (!r.ok) throw new Error('Bureaux indisponibles (' + r.status + ') : please debug.');
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },

    // « Mon bureau n'est pas dans la liste » : demande de RATTACHEMENT envoyée
    // au franchisé. Ne crée ni ne lie aucun bureau : c'est le franchisé qui
    // décide (BO › Demandes de rattachement → écrit client.office_id).
    async contactFranchise(payload) {
      if (!api.endpoint) return { ok: false, error: 'API bureaux non configurée, demande non enregistrée.' };
      try {
        const r = await fetch(api.endpoint + '/contact', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) return j && j.ok === false ? j : { ok: true, ...j };
        return { ok: false, error: j.error || j.message || ('Échec de l\'envoi (' + r.status + ').') };
      } catch (e) {
        return { ok: false, error: 'Réseau indisponible, demande non enregistrée.' };
      }
    },

    // Un bureau par id (avec ses sites de livraison).
    async get(id) {
      if (!id) return null;
      if (!api.endpoint) noEndpoint();
      const r = await fetch(api.endpoint + '/' + encodeURIComponent(id), { credentials: 'include' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Bureau indisponible (' + r.status + ') : please debug.');
      return await r.json();
    },
  };
  window.WSOffices = api;
})();
