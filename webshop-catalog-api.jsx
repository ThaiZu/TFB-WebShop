import { normaliseShoppingContext } from './webshop-office-context.js';
import { adaptShopCatalogue } from './webshop-catalog-adapter.js';

/* Storefront catalogue: the central shop products endpoint is authoritative.
 * loadCatalogue derives products, categories and seasons from one response.
 * Availability is a read-only snapshot. Only accepted orders reserve stock.
 */
(function () {

  /* Date -> 'AAAA-MM-JJ' en heure LOCALE. toISOString() convertit en UTC : une
     Date construite à minuit local devient 22:00 la VEILLE en été (UTC+2), et
     la journée demandée au serveur était systématiquement la mauvaise, stock
     du jour précédent affiché en permanence. Même défaut que celui qui rendait
     le dernier jour du mois invisible au franchisé. */
  const pad2 = (n) => String(n).padStart(2, '0');
  const isoLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const toIso = (d) => (d instanceof Date ? isoLocal(d) : (d || ''));

  function requireEndpoint() {
    if (!api.endpoint) throw new Error('Catalogue API is not configured.');
    return api.endpoint;
  }

  async function getJson(url, label) {
    // Le jeton client accompagne le catalogue : c'est lui qui dit au serveur
    // si le client est rattaché à un bureau à assortiment réduit (0113).
    let hdr = {};
    try { const t = window.WSSessionStorage.getItem('ws_auth_token'); if (t) hdr = { 'Authorization': 'Bearer ' + t }; } catch (_) {}
    const r = await window.WSAuth.authenticatedFetch(url, { credentials: 'include', headers: hdr });
    if (!r.ok) throw new Error(label + ' unavailable (HTTP ' + r.status + ').');
    return await r.json();
  }

  // Share only in-flight reads, never persist prices or failed responses.
  const pendingCatalogues = new Map();

  const api = {
    endpoint: null,

    shopsEndpoint: null,
    async loadCatalogue({ shopId, mode, date, shoppingContext, includeLoyalty = false } = {}) {
      if (shopId == null || shopId === '') return { products: [], categories: [], assortments: [] };
      if (!/^\d+$/.test(String(shopId))) throw new Error('A numeric shop ID is required.');
      const context = normaliseShoppingContext(shoppingContext);
      if (context.mode !== 'standard') {
        const result = await window.WSOffices.catalogue({ shop: shopId, officeId: context.office_id, offerId: context.offer_id, date: toIso(date) });
        const catalogue = adaptShopCatalogue(result.products || [], { mode });
        catalogue.products.forEach(product => { product.has_menu_options = false; });
        return { ...catalogue, context: result.context || context, office: result.office, offer: result.offer, billing: result.billing };
      }
      if (!api.shopsEndpoint) throw new Error('Shop catalogue API is not configured.');
      const query = new URLSearchParams({
        webshop_active: '1', lang_code: window.WSI18n?.getLang?.() || 'fr', alias_type: 'webshop',
        include: 'webshop,portions,availability_periods,webshop_availability' + (includeLoyalty ? ',loyalty' : ''),
      });
      if (date) query.set('date', toIso(date));
      const url = `${api.shopsEndpoint}/${encodeURIComponent(shopId)}/products/available?${query}`;
      let token = '';
      try { token = window.WSSessionStorage.getItem('ws_auth_token') || ''; } catch (_) {}
      const key = url + '\n' + token;
      if (!pendingCatalogues.has(key)) {
        const pending = getJson(url, 'Catalogue').finally(() => pendingCatalogues.delete(key));
        pendingCatalogues.set(key, pending);
      }
      const rows = await pendingCatalogues.get(key);
      return adaptShopCatalogue(rows, { mode });
    },

    async listProducts(options = {}) { return (await api.loadCatalogue(options)).products; },
    async listCategories(options = {}) { return (await api.loadCatalogue(options)).categories; },

    async getProduct(id, shopId) {
      const catalogue = await api.loadCatalogue({ shopId });
      const product = catalogue.products.find((item) => String(item.id) === String(id));
      if (!product) throw new Error('Product unavailable in this shop.');
      return product;
    },

    async personalization({ productId, shopId, date, lang, mode } = {}) {
      const base = api.shopsEndpoint.replace(/\/shops\/?$/, '');
      const query = new URLSearchParams({lang_code: lang || window.WSI18n?.getLang?.() || 'fr'});
      if (date) query.set('date', toIso(date));
      if (mode) query.set('mode', mode);
      return getJson(`${base}/webshop/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(productId)}/personalization?${query}`, 'Personalization');
    },

    async listBundles({ productId, shopId, date, lang, mode } = {}) {
      if (!api.shopsEndpoint || !/^\d+$/.test(String(shopId))) throw new Error('MENU_NOT_AVAILABLE');
      const base = api.shopsEndpoint.replace(/\/shops\/?$/, '');
      const query = new URLSearchParams({lang_code: lang || window.WSI18n?.getLang?.() || 'fr'});
      if (date) query.set('date', toIso(date));
      if (mode) query.set('mode', mode);
      return await getJson(`${base}/webshop/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(productId)}/menus?${query}`, 'Formules');
    },

    async listAssortments(options = {}) { return (await api.loadCatalogue(options)).assortments; },

  };
  window.WSCatalog = api;
})();
