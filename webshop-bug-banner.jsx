// Keep technical diagnostics in the console and display a short recovery message.
(function () {
  var erreurs = [];      // { quoi, detail } : dédupliquées par `quoi`
  var el = null;

  function label(key, fallback) {
    return window.WSI18n?.isLoaded() ? window.WSI18n.t(key) : fallback;
  }

  function rendre() {
    try {
      if (!el) {
        el = document.createElement('div');
        el.id = 'ws-bug';
        el.setAttribute('role', 'alert');
        el.style.cssText =
          'position:fixed;bottom:calc(76px + env(safe-area-inset-bottom, 0px));right:12px;z-index:99999;' +
          'box-sizing:border-box;max-width:min(420px,calc(100% - 24px));background:#fffaf3;color:#332821;' +
          'font:500 14px/1.45 system-ui,sans-serif;padding:14px 42px 14px 14px;' +
          'border:1px solid #cdbdae;border-radius:12px;box-shadow:0 4px 18px #0002';
        var x = document.createElement('button');
        x.textContent = '✕';
        x.setAttribute('aria-label', window.WSI18n?.t('common.close2') || '×');
        x.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:none;' +
                          'color:inherit;font-size:16px;cursor:pointer';
        x.onclick = function () { el.remove(); el = null; };
        el.appendChild(x);
        var b = document.createElement('div');
        b.id = 'ws-bug-corps';
        el.appendChild(b);
        var reload = document.createElement('button');
        reload.type = 'button';
        reload.id = 'ws-bug-refresh';
        reload.style.marginTop = '8px';
        reload.onclick = function () { window.location.reload(); };
        el.appendChild(reload);
        (document.body || document.documentElement).appendChild(el);
      }
      var c = document.getElementById('ws-bug-corps');
      if (c) c.textContent = label('serviceProblem.message', 'Un problème est survenu. Actualisez la page. Si le problème persiste, réessayez dans quelques instants. Le service sera rétabli dès que possible.');
      document.getElementById('ws-bug-refresh').textContent = label('stock.refresh', 'Actualiser');
    } catch (_) { /* si même ça échoue, il reste la console */ }
  }

  /* note(quoi, detail) : `quoi` identifie la source (« catalogue », « stock »…)
     et sert de clé de déduplication : un appel qui échoue à chaque frappe ne
     doit pas empiler cinquante lignes identiques. */
  function note(quoi, detail) {
    console.warn('[webshop:' + quoi + ']', detail);
    var txt = (detail && detail.message) ? detail.message : String(detail || 'échec');
    for (var i = 0; i < erreurs.length; i++) {
      if (erreurs[i].quoi === quoi) { erreurs[i].detail = txt; rendre(); return; }
    }
    erreurs.push({ quoi: quoi, detail: txt });
    rendre();
  }

  window.addEventListener('ws:language', function () { if (el) rendre(); });

  function clear(source) {
    erreurs = erreurs.filter(function (error) { return error.quoi !== source; });
    if (!erreurs.length) { if (el) el.remove(); el = null; }
    else if (el) rendre();
  }
  window.WSBug = { note: note, clear: clear, list: function () { return erreurs.slice(); } };

  /* Ce que le code applicatif ne peut pas attraper : une promesse rejetée sans
     .catch, une exception de rendu. Sans ça, l'écran reste blanc sans un mot. */
  window.addEventListener('unhandledrejection', function (ev) {
    if (ev?.reason?.code === 'SESSION_CHANGED') return;
    note('promesse', (ev && ev.reason && ev.reason.message) || String((ev && ev.reason) || 'rejet non traité'));
  });
  window.addEventListener('error', function (ev) {
    if (ev && ev.message) note('script', ev.message);
  });
})();
