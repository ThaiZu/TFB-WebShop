// A menu is independent from the context established by the first cart line.
export function normaliseShoppingContext(value) {
  const mode = value?.mode || 'standard';
  if (!['standard', 'office_catalog', 'office_offer'].includes(mode)) throw new Error('Invalid shopping context.');
  const id = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
  if (mode === 'standard') return { mode, office_id: null, offer_id: null };
  const office_id = id(value?.office_id);
  const offer_id = mode === 'office_offer' ? id(value?.offer_id) : null;
  if (!office_id || (mode === 'office_offer' && !offer_id)) throw new Error('Invalid shopping context.');
  return { mode, office_id, offer_id };
}
export function sameShoppingContext(left, right) {
  return JSON.stringify(normaliseShoppingContext(left)) === JSON.stringify(normaliseShoppingContext(right));
}
export function basketShoppingContext(basket) {
  if (!basket?.length) return normaliseShoppingContext(null);
  const first = normaliseShoppingContext(basket[0].shopping_context);
  if (basket.some(line => !sameShoppingContext(first, line.shopping_context) || (basket[0].shop_id != null && line.shop_id != null && Number(basket[0].shop_id) !== Number(line.shop_id)))) throw new Error('Mixed shopping contexts.');
  return first;
}
export function needsCartReplacement(basket, context, shopId) {
  return Boolean(basket?.length && (!sameShoppingContext(basketShoppingContext(basket), context) || (shopId != null && basket[0].shop_id != null && Number(shopId) !== Number(basket[0].shop_id))));
}
export function shoppingContextLabel(context, t, fallback) {
  const normal = normaliseShoppingContext(context);
  return normal.mode === 'standard' ? t('officeAccess.standard')
    : normal.mode === 'office_offer' ? t('officeAccess.offer', { name: fallback?.offer_name || normal.offer_id })
    : t('officeAccess.catalogue', { name: fallback?.office_name || normal.office_id });
}

// Office price API currently prices product/portion only, not custom options.
// Labels do not tell us whether an option is paid: reject any supplied configuration.
export function hasUnsupportedOfficeConfiguration(line) {
  return Boolean((Array.isArray(line?.options) ? line.options.length : line?.options)
    || line?.bundleId || line?.bundleOfferId || line?.bundle_id || line?.bundle_offer_id
    || (line?.bundleSlots && Object.keys(line.bundleSlots).length)
    || Number(line?.offerDiscount) > 0);
}

// API membership lists contain the currently available offers in display order.
export function defaultShoppingContext(offices = []) {
  const active = offices.filter(office => !office.status || office.status === 'active');
  for (const office of active) {
    const offer = (office.offers || []).find(offer => !offer.status || offer.status === 'active');
    if (offer) return normaliseShoppingContext({mode:'office_offer', office_id:office.id, offer_id:offer.id});
  }
  return active.length ? normaliseShoppingContext({mode:'office_catalog', office_id:active[0].id}) : normaliseShoppingContext(null);
}
