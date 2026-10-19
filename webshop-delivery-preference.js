const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const key = (client, shop) => `ws.deliveryPreference:${Number(client)}:${Number(shop)}`;

export function readDeliveryPreference(client, shop) {
  if (!positiveId(client) || !positiveId(shop)) return null;
  try {
    const value = JSON.parse(localStorage.getItem(key(client, shop)));
    return value && positiveId(value.officeId) && positiveId(value.siteId)
      ? { officeId: Number(value.officeId), siteId: Number(value.siteId) } : null;
  } catch { return null; }
}

export function saveDeliveryPreference(client, shop, officeId, siteId) {
  if (![client, shop, officeId, siteId].every(positiveId)) return;
  try {
    localStorage.setItem(key(client, shop), JSON.stringify({officeId: Number(officeId), siteId: Number(siteId)}));
  } catch { /* Storage restrictions must not prevent checkout. */ }
}
