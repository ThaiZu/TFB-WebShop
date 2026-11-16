/* Interface translations are served from public/locales/*.json at runtime.
 * Edit deployed JSON files without rebuilding the frontend.
 * Product/category content remains the responsibility of the catalogue API.
 */

(function () {
  // Tableau MUTÉ EN PLACE (jamais réassigné) : la même référence est exportée
  // et lue par le sélecteur, donc une restriction par boutique s'y reflète.
  const SUPPORTED = ['fr', 'nl', 'pl'];
  const APP_DEFAULT = 'fr';                       // repli ultime

  const SHOP_CONFIG = { availableLanguages: SUPPORTED, defaultLanguage: null };

  /* Local interface dictionaries; no API or database dependency. */
  const UI = { fr: {}, nl: {}, pl: {} };
  /* Contenu (noms produits/catégories) : servi par l'API catalogue (marque),
     pas ici. On garde des tables vides pour l'API tProduct/tCategory. */
  const PRODUCT_TR = {};
  const CATEGORY_TR = {};

  /* ---------- persistance ------------------------------------------ */
  const LS_LANG = 'ws.lang';
  const LS_CUSTOMER = 'ws.customer';
  function readLS(k)  { try { return window.WSSessionStorage.getItem(k); } catch { return null; } }
  function writeLS(k, v) { try { window.WSSessionStorage.setItem(k, v); } catch {} }
  function readJSON(k)  { try { const v = window.WSSessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
  function writeJSON(k, v) { try { window.WSSessionStorage.setItem(k, JSON.stringify(v)); } catch {} }

  function hasExplicitChoice() {
    const stored = readLS(LS_LANG);
    if (stored && SUPPORTED.includes(stored)) return true;
    const c = readJSON(LS_CUSTOMER);
    return !!(c && SUPPORTED.includes(c.preferredLang));
  }

  function detectLang() {
    const stored = readLS(LS_LANG);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const c = readJSON(LS_CUSTOMER);
    if (c && SUPPORTED.includes(c.preferredLang)) return c.preferredLang;
    // langue de la boutique (connue après applyShop) avant le navigateur
    if (SHOP_CONFIG.defaultLanguage && SUPPORTED.includes(SHOP_CONFIG.defaultLanguage))
      return SHOP_CONFIG.defaultLanguage;
    const nav = (navigator.language || APP_DEFAULT).slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(nav)) return nav;
    return APP_DEFAULT;
  }

  /* ---------- état + notifications --------------------------------- */
  const listeners = new Set();
  let currentLang = detectLang();
  let _loaded = false;
  let localeEndpoint = null;
  let ipLanguageDetected = false;

  function notify() { listeners.forEach((fn) => { try { fn(currentLang); } catch {} }); if (document.title !== undefined && UI[currentLang]?.['app.title'] && document.getElementById?.('root')) document.title = t('app.title'); if (window.dispatchEvent) window.dispatchEvent(new Event('ws:language')); }
  function getLang() { return currentLang; }
  function isLoaded() { return _loaded; }

  let languageRequest = 0;
  async function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return false;
    const request = ++languageRequest;
    // Change the visible language only when its dictionary is ready.
    if (!await loadLanguage(lang) || request !== languageRequest) return false;
    currentLang = lang;
    writeLS(LS_LANG, lang);
    const c = readJSON(LS_CUSTOMER);
    if (c) { c.preferredLang = lang; writeJSON(LS_CUSTOMER, c); }
    document.documentElement.setAttribute('lang', lang);
    notify();
    return true;
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function format(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (k in params ? params[k] : `{${k}}`));
  }
  function t(key, params) {
    const dict = UI[currentLang] || UI.fr;
    const raw = (dict && dict[key]) || (UI.fr && UI.fr[key]) || key;
    const result = format(raw, params);
    // Keep message parameters so existing alerts follow later language changes.
    renderedMessages.set(result, { key, params });
    if (renderedMessages.size > 1000) renderedMessages.delete(renderedMessages.keys().next().value);
    return result;
  }

  const messageKeys = {
  "CLIENT_ACTIVATION_INVALID": "activation.invalid",
  "CLIENT_ACTIVATION_REQUIRED": "activation.required",
  "CLIENT_ACTIVATION_UNAVAILABLE": "activation.unavailable",
  "CLIENT_ACTIVATION_MAIL_FAILED": "activation.sendError",
  "Prices are being updated…": "ui.updatingPrices",
  "Postal code": "ui.postal",
  "Locality": "ui.locality",
  "Enter a valid postal code.": "error.postal",
  "Cart pricing is unavailable. Please refresh the quote.": "error.quote",
  "Products unavailable: catalogue could not be loaded": "error.catalogue",
  "Bureaux indisponibles, please debug.": "error.offices",
  "Serveur injoignable : modifications NON enregistrées.": "error.unsaved",
  "Service de compte indisponible, modifications NON enregistrées.": "error.accountUnavailable",
  "Échec de l'envoi.": "error.send",
  "Échec de l'envoi. Réessayez.": "error.send",
  "Erreur réseau": "error.network",
  "Erreur réseau lors de la validation du cadeau.": "error.network",
  "Erreur réseau lors de la validation du code.": "error.network",
  "Cart pricing is unavailable.": "error.quote",
  "WEBSHOP_PROMOTION_GROUP_NOT_APPLICABLE": "error.promotionConditions",
  "WEBSHOP_PROMOTION_GROUP_INCOMPLETE": "error.promotionConditions",
  "WEBSHOP_PROMOTION_GROUP_INVALID": "error.promotionConditions",
  "WEBSHOP_MULTIPLE_PROMOTION_SELECTIONS": "error.promotionConditions",
  "WEBSHOP_PROMOTION_SELECTION_CONFLICT": "error.promotionConditions",
  "WEBSHOP_SELECTED_PROMOTION_UNAVAILABLE": "error.promotionConditions",
  "Stock non tenu : please debug.": "error.stock",
  "Order API is unavailable.": "error.orderUnavailable",
  "Suggestions unavailable": "error.service",
  "Invalid credentials": "error.credentials",
  "Invalid current password": "error.credentials",
  "login and password required": "error.loginRequired",
  "A valid phone number is required": "error.phoneRequired",
  "A valid email is required": "error.email",
  "id_main_shop, name, surname and a valid email are required": "error.contactInvalid",
  "An account or a previous webshop order already uses this email or phone. Use password reset to access it.": "error.duplicate",
  "A client with this phone already exists": "error.duplicate",
  "Account disabled": "error.disabled",
  "Invalid refresh token": "error.session",
  "Invalid access token": "error.session",
  "Invalid session response.": "error.session",
  "zip is invalid": "error.postal",
  "postalCode is invalid": "error.postal",
  "locality is invalid": "error.locality",
  "new password must contain at least 4 characters": "error.passwordLength",
  "new password confirmation does not match": "error.passwordMismatch",
  "Invalid or expired password reset token": "error.resetExpired",
  "Password reset is temporarily unavailable": "error.service",
  "Could not create client account": "error.register",
  "OFFER_DISCOUNT_EXCEEDS_PRICE": "officeAccess.discountInvalid",
  "WEBSHOP_MIXED_SHOPPING_CONTEXT": "officeAccess.mixed",
  "OFFICE_AUTH_REQUIRED": "error.authRequired",
  "OFFICE_ACCESS_DENIED": "officeAccess.accessDenied",
  "OFFICE_OFFER_UNAVAILABLE": "officeAccess.offerUnavailable",
  "OFFICE_PICKUP_REQUIRED": "officeAccess.pickupRequired",
  "OFFICE_DELIVERY_SITE_REQUIRED": "officeDelivery.chooseRequired",
  "OFFICE_DELIVERY_UNAVAILABLE": "officeDelivery.unavailable",
  "OFFICE_DELIVERY_CONTEXT_MISMATCH": "officeDelivery.contextMismatch",
  "OFFICE_DELIVERY_PRODUCT_UNAVAILABLE": "officeDelivery.productUnavailable",
  "OFFICE_DATE_INVALID": "officeDelivery.unavailable",
  "OFFICE_COMPANY_UNAVAILABLE": "officeAccess.offerUnavailable",
  "OFFICE_CONTEXT_INVALID": "officeAccess.mixed",
  "OFFICE_PRODUCT_CONFIGURATION_UNSUPPORTED": "officeAccess.configurationUnsupported",
  "OFFICE_OFFER_VOUCHER_CONFLICT": "officeAccess.noVoucher",
  "LOYALTY_UNAVAILABLE": "loyalty.unavailable",
  "LOYALTY_REWARD_UNAVAILABLE": "loyaltyUse.unavailable",
  "LOYALTY_REWARD_INVALID": "loyaltyUse.invalid",
  "LOYALTY_REWARD_PRODUCT_INVALID": "loyaltyUse.invalid",
  "LOYALTY_REWARD_DATE_INVALID": "loyaltyUse.dateInvalid",
  "LOYALTY_REWARD_CONFLICT": "loyaltyUse.conflict",
  "WEBSHOP_QUOTE_CHANGED": "officeAccess.priceChanged",
  "WEBSHOP_AUTH_REQUIRED": "error.authRequired",
  "WEBSHOP_BASKET_INVALID": "error.basketInvalid",
  "WEBSHOP_GUEST_CONTACT_INVALID": "error.contactInvalid",
  "WEBSHOP_ORDER_ACCESS_DENIED": "error.access",
  "WEBSHOP_ORDER_CANCELLATION_CUTOFF_PASSED": "error.cancelCutoff",
  "WEBSHOP_ORDER_CANCELLATION_SCHEMA_MISSING": "error.cancelConfiguration",
  "WEBSHOP_STRIPE_CANCELLATION_UNCONFIRMED": "error.stripeCancellation",
  "WEBSHOP_ORDER_CANNOT_BE_CANCELLED": "error.cancelOrder",
  "WEBSHOP_ORDER_NOT_FOUND": "error.orderNotFound",
  "WEBSHOP_STRIPE_AMOUNT_INVALID": "stripe.amountInvalid",
  "WEBSHOP_STRIPE_NOT_CONFIGURED": "stripe.contactShop",
  "WEBSHOP_STRIPE_RECONCILIATION_REQUIRED": "stripe.contactShop",
  "WEBSHOP_STRIPE_RETURN_URL_INVALID": "stripe.contactShop",
  "WEBSHOP_PAYMENT_METHOD_UNAVAILABLE": "error.noPayments",
  "WEBSHOP_SHOP_EMPLOYEE_MISSING": "error.shopEmployeeMissing",
  "WEBSHOP_SLOT_REQUIRED": "error.slotUnavailable",
  "PERSONALIZATION_REQUIRED": "personalization.required",
  "PERSONALIZATION_SELECTION_INVALID": "personalization.invalid",
  "PERSONALIZATION_VERSION_CONFLICT": "personalization.changed",
  "PERSONALIZATION_RECIPE_CHANGED": "personalization.changed",
  "PERSONALIZATION_CONTEXT_UNSUPPORTED": "personalization.exclusive",
  "PERSONALIZATION_UNAVAILABLE": "personalization.unavailable",
  "MENU_NOT_AVAILABLE": "menu.unavailable",
  "MENU_COMPONENT_UNAVAILABLE": "menu.unavailable",
  "MENU_VERSION_CONFLICT": "menu.changed",
  "MENU_SELECTION_INVALID": "menu.selection",
  "MENU_CONFIGURATION_INVALID": "menu.selection",
  "MENU_WHOLE_PRODUCTS_ONLY": "menu.selection",
  "MENU_CONTEXT_UNSUPPORTED": "menu.unavailable",
  "MENU_VOUCHER_NO_ELIGIBLE_PRODUCTS": "menu.voucher",
  "WEBSHOP_SLOT_UNAVAILABLE": "error.slotUnavailable",
  "WEBSHOP_VOUCHER_INVALID": "error.codeInvalid",
  "PRODUCT_NOT_FOUND": "ui.noDelivery",
  "WEBSHOP_ORDER_CONTEXT_INVALID": "error.basketInvalid",
  "AVAILABILITY_DATE_INVALID": "error.slotUnavailable",
  "Unable to sign in.": "error.credentials",
  "Could not load the account profile.": "error.save",
  "Réseau indisponible, connexion impossible.": "error.network",
  "Unable to create the account.": "error.register",
  "Réseau indisponible, inscription impossible.": "error.network",
  "Service inscription indisponible, réessayez.": "error.register",
  "Service indisponible.": "error.service",
  "Demande impossible.": "error.service",
  "Réseau indisponible.": "error.network",
  "Envoi impossible.": "error.send",
  "Échec.": "error.service",
  "Échec de la mise à jour.": "error.save",
  "Jeton manquant.": "error.resetExpired",
  "Lien invalide.": "error.resetExpired",
  "TVA non reconnue.": "error.vat",
  "VIES indisponible. Réessayez.": "error.vies",
  "Échec de la liaison.": "error.link",
  "Numéro de TVA non reconnu.": "error.vat",
  "Échec de la demande.": "error.service",
  "Password update rejected.": "error.save",
  "Échec de l'ajout.": "error.add",
  "Profile update rejected.": "error.save",
  "Service profil indisponible, réessayez.": "error.save",
  "API disponibilites indisponible.": "error.slotUnavailable",
  "API calendrier indisponible.": "error.slotUnavailable",
  "Catalogue API is not configured.": "error.catalogue",
  "A numeric shop ID is required.": "error.service",
  "Shop catalogue API is not configured.": "error.catalogue",
  "Product unavailable in this shop.": "error.service",
  "API frais de livraison indisponible.": "error.deliveryFee",
  "Réseau indisponible, demande non enregistrée.": "error.network",
  "API commandes indisponible : commande non enregistrée.": "error.orderUnavailable",
  "API paiement indisponible.": "error.service",
  "Order history could not be loaded.": "error.orderUnavailable",
  "Order history response is invalid.": "error.orderUnavailable",
  "API commandes indisponible": "error.orderUnavailable",
  "API tarification indisponible.": "error.service",
  "Cart quote API is not configured.": "error.quote",
  "API creneaux indisponible": "error.slotUnavailable",
  "Ce numéro de TVA n’a pas été reconnu.": "error.vat",
  "Réponse VIES inattendue.": "error.vat",
  "VIES indisponible. Veuillez réessayer.": "error.vies",
  "Veuillez saisir un numéro de TVA.": "error.vat",
  "Vérification TVA indisponible. Veuillez réessayer plus tard.": "error.vies",
  "Service codes promo indisponible, réessayez.": "error.service"
};
  const renderedMessages = new Map();
  function translateKnown(value) {
    const saved = renderedMessages.get(value);
    if (saved) return t(saved.key, saved.params);
    return messageKeys[value] ? t(messageKeys[value]) : value;
  }
  function message(value) {
    if (!value) return '';
    const raw = typeof value === 'object' ? (value.message || value.error || value.description || '') : String(value);
    const saved = renderedMessages.get(raw);
    if (saved) return t(saved.key, saved.params);
    if (messageKeys[raw]) return t(messageKeys[raw]);
    if (UI[currentLang]?.[raw]) return t(raw);
    const code = raw.match(/\b(?:WEBSHOP|AVAILABILITY|PRODUCT|OFFICE|OFFER)_[A-Z_]+\b/)?.[0];
    if (code && messageKeys[code]) return t(messageKeys[code]);
    console.warn('[webshop] Unmapped service message:', raw);
    return t('error.unexpected');
  }

  function merge(strings) {
    if (!strings) return;
    Object.entries(strings).forEach(([lang, dict]) => {
      if (!UI[lang]) UI[lang] = {};
      Object.assign(UI[lang], dict || {});
      for (const [key, text] of Object.entries(dict || {})) messageKeys[text] = key;
    });
  }

  function tProduct(product, field = 'name') {
    if (!product) return '';
    const tr = PRODUCT_TR[currentLang] && PRODUCT_TR[currentLang][product.id];
    if (tr && tr[field]) return tr[field];
    return product[field] || '';
  }
  function tCategory(catId, fallback) {
    const tr = CATEGORY_TR[currentLang] && CATEGORY_TR[currentLang][catId];
    return tr || fallback || catId;
  }

  /* ---------- local language assets ------------------------------- */
  const loadedLanguages = new Set();
  const pending = new Map();
  const localeBase = import.meta.env.BASE_URL + 'locales/';

  function loadLanguage(lang) {
    if (loadedLanguages.has(lang)) return Promise.resolve(true);
    if (pending.has(lang)) return pending.get(lang);
    const request = fetch(localeBase + lang + '.json', {
      headers: { Accept: 'application/json' }, cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then((strings) => {
        if (!strings || Array.isArray(strings) || typeof strings !== 'object'
            || !Object.keys(strings).length
            || Object.values(strings).some((value) => typeof value !== 'string')) {
          throw new Error('Invalid translation dictionary');
        }
        merge({ [lang]: strings });
        loadedLanguages.add(lang);
        _loaded = true;
        notify();
        return true;
      })
      .catch((err) => {
        if (window.WSBug && window.WSBug.note)
          window.WSBug.note('i18n', 'Translations ' + lang.toUpperCase() + ' could not be loaded: ' + err.message);
        return false;
      })
      .finally(() => pending.delete(lang));
    pending.set(lang, request);
    return request;
  }

  function load() {
    // French fallback plus the selected language, once per page session.
    const languages = currentLang !== 'fr' ? ['fr', currentLang] : ['fr'];
    return Promise.all(languages.map(loadLanguage)).then((results) => results.every(Boolean));
  }

  function setLocaleEndpoint(url) {
    localeEndpoint = url || null;
  }

  async function detectFromIp() {
    if (hasExplicitChoice()) return false;

    let language = APP_DEFAULT;
    if (localeEndpoint) {
      try {
        const response = await fetch(localeEndpoint, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (response.ok) {
          const payload = await response.json();
          if (typeof payload?.language === 'string' && SUPPORTED.includes(payload.language)) {
            language = payload.language;
          }
        }
      } catch (_) {
        // The required fallback below keeps GeoIP failures invisible to visitors.
      }
    }

    currentLang = language;
    ipLanguageDetected = true;
    document.documentElement.setAttribute('lang', language);
    return language !== APP_DEFAULT;
  }

  /* Applique la config langue d'une boutique (default_lang / languages). */
  function applyShop(shop) {
    if (!shop) return;
    // Interface languages are supplied by local dictionaries, independently
    // of the catalogue languages advertised by the shop. Keep Polish selectable.
    const def = shop.default_lang || shop.defaultLanguage || null;
    SHOP_CONFIG.defaultLanguage = def;
    // La boutique impose sa langue SI le visiteur n'a pas choisi lui-même.
    if (def && SUPPORTED.includes(def) && !hasExplicitChoice() && !ipLanguageDetected && def !== currentLang) {
      setLang(def);
    }
  }

  /* ---------- profil client ---------------------------------------- */
  function getCustomer() { return readJSON(LS_CUSTOMER); }
  function setCustomer(profile) {
    writeJSON(LS_CUSTOMER, profile);
    if (!SUPPORTED.includes(readLS(LS_LANG)) && profile && profile.preferredLang && SUPPORTED.includes(profile.preferredLang))
      setLang(profile.preferredLang);
  }
  function signOut() { window.WSSessionStorage.clearCustomer?.(); }

  /* ---------- export ----------------------------------------------- */
  document.documentElement.setAttribute('lang', currentLang);

  window.WSI18n = {
    SUPPORTED, SHOP_CONFIG,
    getLang, setLang, onChange, isLoaded,
    t, message, translateKnown, merge, tProduct, tCategory,
    load, setLocaleEndpoint, detectFromIp, applyShop,
    getCustomer, setCustomer, signOut,
  };
})();
