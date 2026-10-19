// API quantities are equivalents of a whole product, never a number of portions.
const portionFactors = { entier: 1, demi: 0.5, quart: 0.25, huitieme: 0.125 };
const statuses = ['available', 'out_of_stock', 'production', 'uninitialized', 'unknown', 'unconfirmed'];

export function normaliseAvailability(value, initializedAt) {
  if (value?.inventory_enforced === false && value?.status === 'not_enforced') return { status: 'not_enforced', quantity_available: null };
  if (!initializedAt) return { status: 'uninitialized', quantity_available: null };
  if (!value || !statuses.includes(value.status)) return { status: 'unknown', quantity_available: null };
  if (['available', 'out_of_stock'].includes(value.status)) {
    const amount = value.quantity_available;
    if (amount === null || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      return { status: 'unknown', quantity_available: null };
    }
    return { ...value, quantity_available: Number(amount) };
  }
  return { ...value, quantity_available: null };
}

export function basketProductUnits(basket, productId) {
  return basket.filter(line => String(line.productId) === String(productId))
    .reduce((total, line) => total + Number(line.qty || 0) * (portionFactors[line.portion] ?? 1), 0);
}

export function availablePortions(availability, portion, basketUnits = 0) {
  if (availability?.status === 'uninitialized') return 0;
  if (!['available', 'out_of_stock'].includes(availability?.status)) return null;
  const units = Math.max(0, availability.quantity_available - basketUnits);
  return Math.floor((units + 1e-8) / (portionFactors[portion] ?? 1));
}

export function stockMessageKey(availability) {
  if (availability?.status === 'uninitialized') return 'stock.uninitialized';
  if (availability?.status === 'unconfirmed') return 'stock.futureUnconfirmed';
  if (!availability || availability.status === 'unknown') return 'stock.unavailable';
  return null;
}
