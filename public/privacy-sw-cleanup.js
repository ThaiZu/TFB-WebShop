/* Remove only the legacy webshop navigation cache. Never clear other apps' caches. */
self.addEventListener('activate', event => {
  event.waitUntil(caches.delete('ws-html'));
});
