// Navigation links are independent of promotion validation.
(function () {
  window.parseDeepLink = function parseDeepLink() {
    const p = new URLSearchParams(window.location.search);
    const out = {};
    if (p.get('shop') || p.get('shopId')) out.shopId = p.get('shop') || p.get('shopId');
    if (p.get('mode')) out.mode = p.get('mode');
    if (p.get('voucher')) out.voucher = p.get('voucher').toUpperCase();
    if (p.get('category')) out.cat = p.get('category');
    if (p.get('sub')) out.sub = p.get('sub');
    if (p.get('product')) out.productId = p.get('product');
    if (p.get('open') === 'product' && p.get('product')) out.openProduct = p.get('product');
    return out;
  };
})();
