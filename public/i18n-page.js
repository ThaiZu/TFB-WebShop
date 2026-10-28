/* Standalone customer pages use the same dictionaries and language preference
   as the React shop. Explicit annotations preserve user-entered data. */
window.WSPageReady = window.WSI18n.load().then(async function (ready) {
  if (!ready) throw new Error('Translation dictionaries unavailable');
  const linkLanguage = new URLSearchParams(location.search).get('lang');
  if (linkLanguage && !window.WSSessionStorage.getItem('ws.lang')) await window.WSI18n.setLang(linkLanguage);
  function render() {
    document.querySelectorAll('[data-i18n]').forEach(function (element) {
      element.textContent = window.WSI18n.t(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (element) {
      element.placeholder = window.WSI18n.t(element.dataset.i18nPlaceholder);
    });
  }
  render();
  // Dynamic form messages can already be visible. Re-translate known messages
  // without reloading: reset tokens are intentionally removed from the URL.
  const select = document.createElement('select');
  select.setAttribute('aria-label', window.WSI18n.t('lang.selector.label'));
  select.style.cssText = 'max-width:200px;margin:0 0 16px;align-self:center';
  window.WSI18n.SUPPORTED.forEach(function (lang) {
    const option = document.createElement('option');
    option.value = lang; option.textContent = window.WSI18n.t('lang.' + lang);
    select.appendChild(option);
  });
  select.value = window.WSI18n.getLang();
  select.addEventListener('change', async function () {
    if (!await window.WSI18n.setLang(select.value)) return;
    // Translate known text nodes, preserving inputs, links and backend content.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (!['SCRIPT', 'STYLE', 'OPTION'].includes(walker.currentNode.parentElement?.tagName)) nodes.push(walker.currentNode);
    }
    nodes.forEach(node => { node.nodeValue = window.WSI18n.translateKnown(node.nodeValue); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      element.placeholder = window.WSI18n.t(element.dataset.i18nPlaceholder);
    });
    document.title = window.WSI18n.t(document.querySelector('title').dataset.i18n);
  });
  document.body.prepend(select);
});
