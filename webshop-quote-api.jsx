import { basketShoppingContext, normaliseShoppingContext } from './webshop-office-context.js';
/* Server-authoritative WebShop cart quote. */
(function () {
  const authHeaders = () => (window.WSAuth && typeof window.WSAuth.authHeaders === 'function') ? window.WSAuth.authHeaders() : {};
  const amount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const api = {
    endpoint: null,
    async quote({ shopId, basket, voucherCode, signal, shoppingContext, deliveryDate, mode, promotionPreviewLineKey, includeLoyalty = false, loyaltyReward = null } = {}) {
      if (!api.endpoint) throw new Error('Cart quote API is not configured.');
      if (!/^\d+$/.test(String(shopId || ''))) throw new Error('A numeric shop ID is required.');
      const date = deliveryDate instanceof Date ? `${deliveryDate.getFullYear()}-${String(deliveryDate.getMonth() + 1).padStart(2, '0')}-${String(deliveryDate.getDate()).padStart(2, '0')}` : deliveryDate;
      const context = shoppingContext ? normaliseShoppingContext(shoppingContext) : basketShoppingContext(basket);
      const promotionIds = new Set((Array.isArray(basket) ? basket : []).map((line) => {
        const direct = Number(line?.promotion_id || 0);
        if (direct > 0) return direct;
        const legacy = String(line?.promotion_group || '').match(/-(\d+)$/);
        return legacy ? Number(legacy[1]) : 0;
      }).filter((id) => Number.isInteger(id) && id > 0));
      const products = (Array.isArray(basket) ? basket : []).map((line, index) => ({
        line_key: 'web-' + String(line.line ?? index).replace(/[^A-Za-z0-9-]/g, '-').slice(0, 60),
        id_product: line.productId,
        shopping_context: normaliseShoppingContext(line.shopping_context || context),
        quantity: amount(line.qty),
        ...(line.personalization_selection ? {personalization_selection: line.personalization_selection} : {}),
        ...(line.menu_selection ? { menu_selection: line.menu_selection } : {}),
        ...(line.weight_grams != null ? { weight_grams: line.weight_grams } : {}),
        ...(line.id_product_portion != null ? { id_product_portion: line.id_product_portion } : {}),
        ...(line.promotion_group && Number(line.promotion_id) > 0 ? {
          promotion_group: String(line.promotion_group),
          promotion_id: Number(line.promotion_id),
        } : {}),
      }));
      if (!products.length) return null;
      const options = {
        method: 'POST', credentials: 'include', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...(includeLoyalty ? {include_loyalty:true} : {}), ...(loyaltyReward ? {loyalty_reward:loyaltyReward} : {}), id_shop: Number(shopId), fulfilment_mode: mode, shopping_context: context, products, ...(promotionPreviewLineKey ? { promotion_preview_line_key: 'web-' + String(promotionPreviewLineKey).replace(/[^A-Za-z0-9-]/g, '-').slice(0, 60) } : {}), ...(date ? { delivery_date: date } : {}), ...(voucherCode ? { voucher_code: voucherCode } : {}), ...(promotionIds.size === 1 ? { selected_automatic_promotion_id: [...promotionIds][0] } : {}) }),
      };
      // Fidelity contains a customer's balance: validate session through JSON decoding.
      const decoded = includeLoyalty || loyaltyReward
        ? await window.WSAuth.authenticatedJson(api.endpoint, options)
        : await window.WSAuth.authenticatedFetch(api.endpoint, options).then(async response => ({response,data:await response.json().catch(()=>({}))}));
      const {response,data:body} = decoded;
      if (!response.ok) {
        const message = typeof body.error === 'string' ? body.error : (body.error && body.error.message) || `Cart quote failed (HTTP ${response.status}).`;
        const error = new Error(body?.code || body?.error?.code || body?.description || message);
        error.code = body?.error?.code || body?.code || body?.description;
        throw error;
      }
      const money = value => (typeof value === 'string' && value.trim() !== '' || typeof value === 'number') && Number.isFinite(Number(value)) && Number(value) >= 0;
      if (!body || !Array.isArray(body.items) || body.items.length !== products.length ||
          !['gross_before_discount', 'discount', 'gross_after_discount'].every(key => money(body.totals?.[key])) ||
          new Set(body.items.map(line => line.line_key)).size !== products.length ||
          products.some(product => !body.items.some(line => line.line_key === product.line_key && money(line.total_gross_value_after_discount)))) {
        throw new Error('error.quote');
      }
      if (loyaltyReward && (body.loyalty_reward?.id !== loyaltyReward.id || body.loyalty_reward?.line_index !== loyaltyReward.line_index
        || !money(body.loyalty_reward?.discount) || Number(body.loyalty_reward.discount) <= 0)) throw new Error('LOYALTY_REWARD_UNAVAILABLE');
      return body;
    },
  };
  window.WSQuote = api;
})();
