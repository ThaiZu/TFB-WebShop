export function normalizeReceiptToken(value) {
  return typeof value === 'string' && /^(?:[0-9a-hjkmnp-tv-z]{20}|[0-9a-f]{64})$/i.test(value)
    ? value.toLowerCase()
    : null;
}
