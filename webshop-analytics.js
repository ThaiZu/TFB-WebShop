const observedPurchases = new Set();

// Business hooks only. The consent runtime and adapter own delivery and deduplication.
export function analyticsItems(lines) {
  return (Array.isArray(lines) ? lines : []).filter(line => line && typeof line === 'object').map(line => ({
    item_id: String(line.productId ?? line.id_product ?? ''),
    quantity: Number(line.qty ?? line.quantity),
    ...(Number.isFinite(Number(line.price ?? line.unitGrossPrice))
      ? { price: Number(line.price ?? line.unitGrossPrice) } : {}),
  }));
}
export function analyticsEvent(event, items, value) {
  try { window.WSConsent?.track('analytics', event, { items: analyticsItems(items), ...(Number.isFinite(value) ? { value } : {}) }); } catch (_) { /* Never interrupt shopping. */ }
}
export function analyticsPurchase(order, value) {
  if (!order || !Array.isArray(order.items) || !/^WEB-\d+-\d{8}-[A-F0-9]{6}$/.test(order.orderRef || '')) return;
  if (['cancelled', 'canceled'].includes(String(order.status).toLowerCase())) return;
  if (order.payment?.method === 'stripe' && order.payment.status !== 'paid') return;
  const amount = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isFinite(amount) || amount < 0 || observedPurchases.has(order.orderRef)) return;
  // Remember the observation even when consent/loading suppresses delivery: no later replay.
  observedPurchases.add(order.orderRef);
  try { window.WSConsent?.track('analytics', 'purchase', { transaction_id: order.orderRef,
    value: amount, items: analyticsItems(order.items) }); } catch (_) { /* Never interrupt confirmation. */ }
}
