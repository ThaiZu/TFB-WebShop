/* =====================================================================
   Landing « Livraison au bureau » — page complète (logique + mise en page).
   - En-tête marque + hero + formulaire dans une carte claire + pied.
   - Droplist alimentée par ws_tours ACTIVES (GET /delivery-zones),
     options groupées par zone principale (optgroup), chaque option = une
     zone secondaire. Aucune liste écrite en dur : l'ouverture d'une tournée
     fait apparaître sa zone sans toucher à cette page.
   - Dernière option « Ma zone n'est pas dans la liste » → formulaire
     (CP, commune, société, effectif, e-mail) → POST /zone-request
     (persisté en base ws_zone_requests + mail admin, rate-limit IP côté serveur).
   ===================================================================== */
(function () {
  'use strict';
  // La landing est servie sous /landing ; l'API du webshop vit sous /webshop/api
  // (même origine). Surchargée par window.LB_API si besoin.
  var params = new URLSearchParams(location.search);
  var shop = params.get('shop');
  var language = (params.get('lang') || 'fr').toLowerCase().split(/[-_]/)[0];
  if (!['fr','en','nl','pl'].includes(language)) language='en';
  document.documentElement.lang=language;
  var translations = {"← Retour à la boutique": {"fr": "← Retour à la boutique", "en": "← Back to the shop", "nl": "← Terug naar de winkel", "pl": "← Wróć do sklepu"}, "Livraison au bureau": {"fr": "Livraison au bureau", "en": "Office delivery", "nl": "Levering op kantoor", "pl": "Dostawy do biura"}, "Où livrons-nous ?": {"fr": "Où livrons-nous ?", "en": "Where do we deliver?", "nl": "Waar leveren we?", "pl": "Gdzie dostarczamy?"}, "L’Atelier By livre vos bureaux — pains, viennoiseries et traiteur, directement au travail.": {"fr": "L’Atelier By livre vos bureaux — pains, viennoiseries et traiteur, directement au travail.", "en": "L’Atelier By delivers bread, pastries and catering to your workplace.", "nl": "L’Atelier By levert brood, gebak en catering op uw werkplek.", "pl": "L’Atelier By dostarcza pieczywo, wypieki i catering do Twojego miejsca pracy."}, "Choisissez votre zone pour consulter les horaires habituels. La disponibilité exacte est confirmée lors de la commande.": {"fr": "Choisissez votre zone pour consulter les horaires habituels. La disponibilité exacte est confirmée lors de la commande.", "en": "Select your area to see the usual delivery times. Exact availability is confirmed when ordering.", "nl": "Kies uw zone om de gebruikelijke levertijden te bekijken. De exacte beschikbaarheid wordt bij de bestelling bevestigd.", "pl": "Wybierz obszar, aby sprawdzić standardowe terminy dostaw. Dokładna dostępność jest potwierdzana podczas zamawiania."}, "Choisissez votre zone de livraison…": {"fr": "Choisissez votre zone de livraison…", "en": "Select your delivery area…", "nl": "Kies uw leveringszone…", "pl": "Wybierz obszar dostawy…"}, "Ma zone n'est pas dans la liste": {"fr": "Ma zone n'est pas dans la liste", "en": "My area is not listed", "nl": "Mijn zone staat niet in de lijst", "pl": "Mojego obszaru nie ma na liście"}, "Votre zone": {"fr": "Votre zone", "en": "Your area", "nl": "Uw zone", "pl": "Twój obszar"}, "Zone de livraison": {"fr": "Zone de livraison", "en": "Delivery area", "nl": "Leveringszone", "pl": "Obszar dostawy"}, "Autres zones": {"fr": "Autres zones", "en": "Other areas", "nl": "Andere zones", "pl": "Pozostałe obszary"}, "Nom de la société": {"fr": "Nom de la société", "en": "Company name", "nl": "Bedrijfsnaam", "pl": "Nazwa firmy"}, "Code postal *": {"fr": "Code postal *", "en": "Postal code *", "nl": "Postcode *", "pl": "Kod pocztowy *"}, "Commune": {"fr": "Commune", "en": "City", "nl": "Gemeente", "pl": "Miejscowość"}, "Société": {"fr": "Société", "en": "Company", "nl": "Bedrijf", "pl": "Firma"}, "Nombre de collaborateurs": {"fr": "Nombre de collaborateurs", "en": "Number of employees", "nl": "Aantal medewerkers", "pl": "Liczba pracowników"}, "E-mail de contact *": {"fr": "E-mail de contact *", "en": "Contact email *", "nl": "Contact-e-mail *", "pl": "E-mail kontaktowy *"}, "Indiquez votre adresse et votre e-mail pour que le magasin puisse étudier votre demande.": {"fr": "Indiquez votre adresse et votre e-mail pour que le magasin puisse étudier votre demande.", "en": "Enter your area and email so the shop can review your request.", "nl": "Vul uw locatie en e-mailadres in zodat de winkel uw aanvraag kan beoordelen.", "pl": "Podaj lokalizację i e-mail, aby sklep mógł rozpatrzyć Twoje zgłoszenie."}, "Envoyer ma demande": {"fr": "Envoyer ma demande", "en": "Send request", "nl": "Aanvraag versturen", "pl": "Wyślij zgłoszenie"}, "Chargement des modalités…": {"fr": "Chargement des modalités…", "en": "Loading delivery details…", "nl": "Leveringsvoorwaarden laden…", "pl": "Wczytywanie warunków dostawy…"}, "Contactez le magasin pour confirmer les jours de livraison.": {"fr": "Contactez le magasin pour confirmer les jours de livraison.", "en": "Contact the shop to confirm delivery days.", "nl": "Neem contact op met de winkel om de leveringsdagen te bevestigen.", "pl": "Skontaktuj się ze sklepem, aby potwierdzić dni dostawy."}, "Livré par ": {"fr": "Livré par ", "en": "Delivered by ", "nl": "Geleverd door ", "pl": "Dostawa ze sklepu: "}, "Jours : ": {"fr": "Jours : ", "en": "Days: ", "nl": "Dagen: ", "pl": "Dni: "}, "Horaire : ": {"fr": "Horaire : ", "en": "Hours: ", "nl": "Uren: ", "pl": "Godziny: "}, "Heure limite : ": {"fr": "Heure limite : ", "en": "Order cutoff: ", "nl": "Uiterste besteltijd: ", "pl": "Godzina graniczna: "}, "Préavis minimum : ": {"fr": "Préavis minimum : ", "en": "Minimum notice: ", "nl": "Minimale voorbereidingstijd: ", "pl": "Minimalne wyprzedzenie: "}, "Créneaux : ": {"fr": "Créneaux : ", "en": "Time slots: ", "nl": "Tijdsloten: ", "pl": "Okna czasowe: "}, "Le code postal est requis.": {"fr": "Le code postal est requis.", "en": "Postal code is required.", "nl": "Postcode is verplicht.", "pl": "Podaj kod pocztowy."}, "Envoi en cours…": {"fr": "Envoi en cours…", "en": "Sending…", "nl": "Verzenden…", "pl": "Wysyłanie…"}, "Merci ! Votre demande est enregistrée — nous vous recontactons si une tournée ouvre près de chez vous.": {"fr": "Merci ! Votre demande est enregistrée — nous vous recontactons si une tournée ouvre près de chez vous.", "en": "Thank you! Your request has been saved for the shop to review.", "nl": "Bedankt! Uw aanvraag is opgeslagen en kan door de winkel worden beoordeeld.", "pl": "Dziękujemy! Zgłoszenie zostało zapisane do rozpatrzenia przez sklep."}, "Trop de demandes. Réessayez plus tard.": {"fr": "Trop de demandes. Réessayez plus tard.", "en": "Too many requests. Please try again later.", "nl": "Te veel aanvragen. Probeer het later opnieuw.", "pl": "Zbyt wiele zgłoszeń. Spróbuj ponownie później."}, "Une erreur est survenue, réessayez.": {"fr": "Une erreur est survenue, réessayez.", "en": "An error occurred. Please try again.", "nl": "Er is een fout opgetreden. Probeer het opnieuw.", "pl": "Wystąpił błąd. Spróbuj ponownie."}, "Réseau indisponible, réessayez.": {"fr": "Réseau indisponible, réessayez.", "en": "Connection unavailable. Please try again.", "nl": "Geen verbinding. Probeer het opnieuw.", "pl": "Brak połączenia. Spróbuj ponownie."}, "Sélectionnez une boutique avant de consulter les zones de livraison.": {"fr": "Sélectionnez une boutique avant de consulter les zones de livraison.", "en": "Select a shop before viewing delivery areas.", "nl": "Selecteer een winkel voordat u leveringszones bekijkt.", "pl": "Wybierz sklep przed sprawdzeniem obszarów dostawy."}, "Zone desservie : ": {"fr": "Zone desservie : ", "en": "Area served: ", "nl": "Bediende zone: ", "pl": "Obsługiwany obszar: "}, "© 2026 L’Atelier By — Maison de pains et viennoiseries · Belgique.": {"fr": "© 2026 L’Atelier By — Maison de pains et viennoiseries · Belgique.", "en": "© 2026 L’Atelier By · Belgium.", "nl": "© 2026 L’Atelier By · België.", "pl": "© 2026 L’Atelier By · Belgia."}, "Service unavailable. Please try again.": {"fr": "Service unavailable. Please try again.", "en": "Service unavailable. Please try again.", "nl": "Dienst niet beschikbaar. Probeer het opnieuw.", "pl": "Usługa niedostępna. Spróbuj ponownie."}, "Too many requests. Please try again later.": {"fr": "Too many requests. Please try again later.", "en": "Too many requests. Please try again later.", "nl": "Te veel aanvragen. Probeer het later opnieuw.", "pl": "Zbyt wiele zgłoszeń. Spróbuj ponownie później."}};
  function tr(key) { return translations[key] ? translations[key][language] : key; }
  document.title=tr('Livraison au bureau') + " · L’Atelier By";

  var base = new URL('../', location.href);
  var back = new URL(base); if (shop) back.searchParams.set('shop', shop); back.searchParams.set('lang', language);
  var API = String(window.WS_API_BASE_URL || '').replace(/\/$/, '') + '/webshop/shops/' + encodeURIComponent(shop || '0');
  var requestKey = Array.from(crypto.getRandomValues(new Uint8Array(16)), function(b){return b.toString(16).padStart(2,'0');}).join('');
  function request(path, options) {
    return fetch(API + path, options).then(function(r){if(!r.ok)throw new Error(r.status===429?tr("Too many requests. Please try again later."):tr("Service unavailable. Please try again."));return r.json();});
  }
  var OTHER = '__other__';
  var root = document.getElementById('root');

  // Palette locale (la page ne charge pas les tokens --lp-* de la landing B2B).
  var INK = '#241a16', CREAM = '#fdf6f0', CARD = '#ffffff', RUBY = '#8D1D2C',
      ABRICOT = '#E8A15C', MUTED = '#6b5d54', LINE = '#ece3da';

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function header() {
    return el('header', { style: 'position:sticky;top:0;z-index:10;background:rgba(253,246,240,.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid ' + LINE }, [
      el('div', { style: 'max-width:960px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px' }, [
        el('a', { href: back.href, style: 'font-family:var(--font-display,Vank),serif;font-size:21px;color:' + RUBY + ';text-decoration:none;letter-spacing:.02em', text: "L'Atelier By" }),
        el('a', { href: back.href, style: 'font:500 13px var(--font-ui,system-ui);color:' + MUTED + ';text-decoration:none', text: tr("← Retour à la boutique") }),
      ]),
    ]);
  }

  function footer() {
    return el('footer', { style: 'text-align:center;padding:34px 20px 48px;color:#9b8f86;font:400 12px var(--font-ui,system-ui)' }, [
      el('span', { text: tr("© 2026 L’Atelier By — Maison de pains et viennoiseries · Belgique.") }),
    ]);
  }

  function fieldStyle() {
    return 'width:100%;box-sizing:border-box;padding:11px 13px;font:inherit;color:' + INK +
      ';background:#fff;border:1px solid ' + LINE + ';border-radius:10px;outline:none';
  }

  function render(zones) {
    root.innerHTML = '';
    root.appendChild(header());

    var wrap = el('main', { style: 'max-width:640px;margin:0 auto;padding:28px 20px 8px' });

    // ── Hero ──
    wrap.appendChild(el('div', { style: 'text-align:center;padding:10px 0 22px' }, [
      el('h1', { style: 'font-family:var(--font-display,Vank),serif;font-size:34px;line-height:1.1;color:' + INK + ';margin:0 0 12px', text: tr("Livraison au bureau") }),
      el('p', { style: 'font:400 15px/1.55 var(--font-ui,system-ui);color:' + MUTED + ';margin:0 auto;max-width:520px', text: tr("L’Atelier By livre vos bureaux — pains, viennoiseries et traiteur, directement au travail.") }),
    ]));

    // ── Carte : le formulaire (ancre #contact) ──
    var card = el('div', { id: 'contact', style: 'scroll-margin-top:88px;background:' + CARD + ';border:1px solid ' + LINE + ';border-radius:16px;padding:24px 22px;box-shadow:0 12px 34px rgba(36,26,22,.06)' });

    card.appendChild(el('div', { style: 'font:600 18px var(--font-ui,system-ui);color:' + INK + ';margin-bottom:6px', text: tr("Où livrons-nous ?") }));
    card.appendChild(el('p', { style: 'font:400 13px/1.55 var(--font-ui,system-ui);color:' + MUTED + ';margin:0 0 16px', text: tr("Choisissez votre zone pour consulter les horaires habituels. La disponibilité exacte est confirmée lors de la commande.") }));

    // Droplist groupée par zone principale
    var sel = el('select', { class: 'lb-select', style: fieldStyle() + ';appearance:auto', 'aria-label': tr("Zone de livraison") });
    sel.appendChild(el('option', { value: '', text: tr("Choisissez votre zone de livraison…") }));
    var groups = {}; var order = [];
    zones.forEach(function (z) {
      var key = z.zonePrincipal || tr("Autres zones");
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(z);
    });
    order.forEach(function (key) {
      var og = el('optgroup', { label: key });
      groups[key].forEach(function (z) {
        og.appendChild(el('option', { value: String(z.id), text: z.zoneSecondary || z.tour }));
      });
      sel.appendChild(og);
    });
    sel.appendChild(el('option', { value: OTHER, text: tr("Ma zone n'est pas dans la liste") }));

    card.appendChild(el('label', { class: 'lb-field', style: 'display:block;margin:0 0 4px' }, [
      el('span', { style: 'display:block;margin-bottom:6px;font:600 12px var(--font-ui,system-ui);color:' + INK, text: tr("Votre zone") }),
      sel,
    ]));

    // Zone couverte : confirmation
    var covered = el('div', { style: 'display:none;margin-top:14px;padding:12px 14px;border-radius:10px;background:#eef6ef;border:1px solid #d3e6d5;color:#2d7a3e;font:500 13px var(--font-ui,system-ui)' });
    card.appendChild(covered);

    // Formulaire « hors zone »
    var form = el('div', { style: 'display:none;margin-top:16px' });
    var cp   = el('input', { class: 'lb-input', style: fieldStyle(), type: 'text', maxlength: '20', required: '', placeholder: '1348' });
    var city = el('input', { class: 'lb-input', style: fieldStyle(), type: 'text', placeholder: 'Louvain-la-Neuve' });
    var comp = el('input', { class: 'lb-input', style: fieldStyle(), type: 'text', placeholder: tr("Nom de la société") });
    var head = el('input', { class: 'lb-input', style: fieldStyle(), type: 'number', min: '1', max: '100000', step: '1', placeholder: 'ex. 25' });
    var mail = el('input', { class: 'lb-input', style: fieldStyle(), type: 'email', required: '', maxlength: '254', placeholder: 'vous@societe.be' });
    var lbl = function (t, node) { return el('label', { style: 'display:block;flex:1;min-width:150px;margin:0 0 12px' }, [
      el('span', { style: 'display:block;margin-bottom:6px;font:600 12px var(--font-ui,system-ui);color:' + INK, text: t }), node ]); };
    form.appendChild(el('p', { style: 'font:400 12.5px/1.55 var(--font-ui,system-ui);color:' + MUTED + ';margin:2px 0 14px', text: tr("Indiquez votre adresse et votre e-mail pour que le magasin puisse étudier votre demande.") }));
    form.appendChild(el('div', { style: 'display:flex;gap:12px;flex-wrap:wrap' }, [ lbl(tr("Code postal *"), cp), lbl(tr("Commune"), city) ]));
    form.appendChild(lbl(tr("Société"), comp));
    form.appendChild(el('div', { style: 'display:flex;gap:12px;flex-wrap:wrap' }, [ lbl(tr("Nombre de collaborateurs"), head), lbl(tr("E-mail de contact *"), mail) ]));
    var send = el('button', { type: 'button', style: 'margin-top:4px;background:' + RUBY + ';color:#fff;border:none;border-radius:999px;padding:13px 24px;font:600 14px var(--font-ui,system-ui);cursor:pointer', text: tr("Envoyer ma demande") });
    var fmsg = el('div', { style: 'margin-top:12px;font:500 13px var(--font-ui,system-ui);color:' + RUBY });
    form.appendChild(send); form.appendChild(fmsg);
    card.appendChild(form);

    wrap.appendChild(card);
    root.appendChild(wrap);
    root.appendChild(footer());

    sel.addEventListener('change', function () {
      var v = sel.value;
      form.style.display = (v === OTHER) ? 'block' : 'none';
      var isCov = !!(v && v !== OTHER && v !== '');
      covered.style.display = isCov ? 'block' : 'none';
      if (!isCov) return;
      var z = zones.filter(function (x) { return String(x.id) === v; })[0];
      covered.innerHTML = '';
      covered.appendChild(el('div', { style: 'font-weight:600', text: tr("Zone desservie : ") + (z ? (z.zoneSecondary || z.tour) : '') }));
      var mod = el('div', { style: 'margin-top:6px;font-weight:400;color:#37503f', text: tr("Chargement des modalités…") });
      covered.appendChild(mod);
      // « pilote tout » : la zone choisie affiche les vraies modalités de la boutique qui livre.
      request('/delivery-zones/' + encodeURIComponent(v))
        .then(function (m) {
          if (sel.value !== v) return;
          mod.innerHTML = '';
          if (!m.days.length) { mod.textContent = tr("Contactez le magasin pour confirmer les jours de livraison."); return; }
          var names = Array.from({length:7}, function(_,i){return new Intl.DateTimeFormat(language,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,0,5+i)));});
          mod.appendChild(el('div', {text: tr("Livré par ") + m.shop}));
          mod.appendChild(el('div', {text: tr("Jours : ") + m.days.map(function(d){return names[d-1];}).join(', ')}));
          if(m.delivery_hours_start && m.delivery_hours_end) mod.appendChild(el('div', {text: tr("Horaire : ") + m.delivery_hours_start.slice(0,5) + '–' + m.delivery_hours_end.slice(0,5) + ' (' + m.timezone + ')'}));
          if(m.delivery_cutoff_hour !== null)mod.appendChild(el('div', {text:tr("Heure limite : ")+String(m.delivery_cutoff_hour).padStart(2,'0')+':'+String(m.delivery_cutoff_minute||0).padStart(2,'0')}));
          if(Number(m.delivery_lead_hours)>0)mod.appendChild(el('div',{text:tr("Préavis minimum : ")+m.delivery_lead_hours+' h'}));
          if(m.slots.length)mod.appendChild(el('div', {text:tr("Créneaux : ")+m.slots.join(', ')}));
        }).catch(function (error) {if(sel.value===v)mod.textContent=error.message;});
    });

    send.addEventListener('click', function () {
      fmsg.textContent = '';
      if (!cp.value.trim()) { fmsg.textContent = tr("Le code postal est requis."); return; }
      if (!mail.reportValidity() || !head.reportValidity()) return;
      send.disabled = true;
      fmsg.textContent = tr("Envoi en cours…");
      fetch(API + '/delivery-interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_key: requestKey, postalCode: cp.value.trim(), city: city.value.trim(), company: comp.value.trim(),
          headcount: parseInt(head.value, 10) || null, email: mail.value.trim(),
        }),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          send.disabled = false;
          if (res.ok && res.j.saved === true) {
            form.innerHTML = '';
            form.appendChild(el('p', { style: 'font:500 14px/1.5 var(--font-ui,system-ui);color:#2d7a3e', text: tr("Merci ! Votre demande est enregistrée — nous vous recontactons si une tournée ouvre près de chez vous.") }));
          } else {
            fmsg.textContent = res.j && res.j.description === 'DELIVERY_INTEREST_RATE_LIMIT' ? tr("Trop de demandes. Réessayez plus tard.") : tr("Une erreur est survenue, réessayez.");
          }
        }).catch(function () { send.disabled = false; fmsg.textContent = tr("Réseau indisponible, réessayez."); });
    });
    // Pas de scroll automatique : le client atterrit en HAUT de la page entière
    // (en-tête + hero + section). Seul le formulaire de zone est dynamique.
  }

  if (!shop || !/^[1-9][0-9]*$/.test(shop) || !window.WS_API_BASE_URL) {
    root.textContent = tr("Sélectionnez une boutique avant de consulter les zones de livraison.");
  } else {
    request('/delivery-zones').then(function(zones){render(zones);}).catch(function(error){
      render([]);
      var notice=el('p', {role:'alert',text:error.message});
      root.querySelector('main').prepend(notice);
    });
  }
})();
