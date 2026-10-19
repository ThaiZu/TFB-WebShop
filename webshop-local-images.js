// Indexed at build/startup: no failing extension probes or product-name guesses.
const files = typeof __WS_LOCAL_IMAGES__ === 'undefined' ? {} : __WS_LOCAL_IMAGES__;
const base = typeof __WS_IMAGE_BASE__ === 'undefined' ? '/' : __WS_IMAGE_BASE__;
const slug = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function localCatalogueImage(directory, keys, index = files, prefix = base) {
  const names = index[directory] || [];
  for (const key of keys) {
    if (key == null || key === '') continue;
    const match = names.find(name => slug(name.replace(/\.[^.]+$/, '')) === slug(key));
    if (match) return prefix + 'assets/' + directory + '/' + encodeURIComponent(match);
  }
  return null;
}
