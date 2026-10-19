// API completion means preparation finished; only pickup closes the purchase.
export function orderStatusName(status) {
  const key = String(status || 'new').toLowerCase();
  return ({new:'new',in_production:'inProduction',completed:'ready',ready:'ready',picked_up:'completed',unpicked:'notCollected',cancelled:'cancelled',canceled:'cancelled'})[key] || 'unknown';
}

export function paymentStatusName(status) {
  const key = String(status || 'pending').toLowerCase();
  return ['paid','pending','failed','refunded'].includes(key) ? key : 'unknown';
}
