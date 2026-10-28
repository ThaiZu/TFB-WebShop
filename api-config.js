/* API address is supplied by VITE_API_BASE_URL at dev startup / build time.
 * No same-origin fallback or user-editable endpoint. Feature contracts are
 * migrated separately from the old WebShop/php-api adapter.
 */
(function () {
  const BASE_URL = __WS_API_BASE_URL__;

  // Existing feature suffixes: connectivity configuration only at this stage.
  if (window.WSShops)        window.WSShops.endpoint        = BASE_URL + '/shops';
  if (window.WSCatalog) {
    window.WSCatalog.endpoint = BASE_URL + '/catalog';
    window.WSCatalog.shopsEndpoint = BASE_URL + '/shops';
    // Optional service: central API does not yet implement cross-sell rules.
    window.WSCatalog.crossSellEndpoint = null;
    window.WSCatalog.crossSellStatsEndpoint = null;
  }
  if (window.WSDeliveryFees) window.WSDeliveryFees.endpoint = BASE_URL + '/delivery-fees';
  if (window.WSOffices) window.WSOffices.consumerEndpoint = BASE_URL + '/webshop/offices';
  if (window.WSOffices)      window.WSOffices.endpoint      = BASE_URL + '/offices';
  if (window.WSTours)        window.WSTours.endpoint        = BASE_URL + '/tours';
  if (window.WSOrders)       window.WSOrders.endpoint       = BASE_URL + '/webshop/orders';
  if (window.WSOrders)       window.WSOrders.payEndpoint    = BASE_URL + '/payments/checkout';
  if (window.WSCompanies)    window.WSCompanies.setEndpoint(BASE_URL + '/companies');
  if (window.WSPayments)     window.WSPayments.endpoint     = BASE_URL + '/webshop/payment-methods';
  if (window.WSAuth)         window.WSAuth.endpoint         = BASE_URL + '/clients/auth';
  if (window.WSAuth)         window.WSAuth.configEndpoint   = BASE_URL + '/webshop/config';
  if (window.WSQuote)        window.WSQuote.endpoint        = BASE_URL + '/webshop/cart/quote';
  if (window.WSAvailability) window.WSAvailability.endpoint = BASE_URL + '/availability';
  if (window.WSSlots)        window.WSSlots.endpoint        = BASE_URL + '/slots';
  if (window.WSCalendar)     window.WSCalendar.endpoint     = BASE_URL + '/calendar';
  // Interface translations are local assets. The API only picks the initial
  // language from the visitor's IP before the storefront is mounted.
  if (window.WSI18n) window.WSI18n.setLocaleEndpoint(BASE_URL + '/webshop/locale');
  /* VIES: template endpoint — the stub fills {country}/{vat}. */
  if (window.WSVies)         window.WSVies.endpoint         = BASE_URL + '/vies/{country}/{vat}';

  /* Optional: CSRF token for mutations (set by your auth endpoint) */
  // document.addEventListener('wsauth:login', function (e) {
  //   const token = e.detail && e.detail.csrfToken;
  //   if (token) window._WS_CSRF = token;
  // });
})();
