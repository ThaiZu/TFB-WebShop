/* =====================================================================
   Landing « Livraison au bureau » — page complète (logique + mise en page).
   - En-tête marque + hero + formulaire dans une carte claire + pied.
   - Droplist alimentée par ws_tours ACTIVES (GET /delivery-zones),
     options groupées par zone principale (optgroup), chaque option = une
     zone secondaire. Aucune liste écrite en dur : l'ouverture d'une tournée
     fait apparaître sa zone sans toucher à cette page.
   - Dernière option « Ma zone n'est pas dans la liste » → formulaire
     (CP, commune, société, effectif, e-mail) → POST /delivery-interest (TF Buddy,
     rate-limit IP côté serveur), puis une copie au cockpit (bureau-hors-zone :
     dashboard de la boutique › Clients › Bureaux).
   - Zone desservie : ses modalités (mêmes libellés que la landing atelierby.be)
     et l'inscription du bureau, le questionnaire de la boutique au cockpit
     (…/bureau/?m={boutique}), comme sur la landing atelierby.be.
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
  // Les libellés de la landing atelierby.be (27/11/2026) : les deux pages « Livraison au bureau » disent la même chose,
  // et proposent la même inscription (le questionnaire de la boutique, au cockpit).
  Object.assign(translations, {
    "Jours livrés : ": {"fr": "Jours livrés : ", "en": "Delivery days: ", "nl": "Leverdagen: ", "pl": "Dni dostaw: "},
    "Heure limite de commande : ": {"fr": "Heure limite de commande : ", "en": "Order cutoff: ", "nl": "Uiterste besteltijd: ", "pl": "Godzina graniczna zamówień: "},
    "Créneaux de livraison : ": {"fr": "Créneaux de livraison : ", "en": "Delivery slots: ", "nl": "Leveringstijdvakken: ", "pl": "Okna dostaw: "},
    "Inscrivez votre bureau en ligne": {"fr": "Inscrivez votre bureau en ligne", "en": "Register your office online", "nl": "Schrijf uw kantoor online in", "pl": "Zarejestruj biuro online"},
    "Six étapes avec la boutique : votre compte webshop, votre société, la livraison, votre équipe, puis votre bon de bienvenue. La boutique valide ensuite votre bureau.": {
      "fr": "Six étapes avec la boutique : votre compte webshop, votre société, la livraison, votre équipe, puis votre bon de bienvenue. La boutique valide ensuite votre bureau.",
      "en": "Six steps with the shop: your webshop account, your company, delivery, your team, then your welcome voucher. The shop then approves your office.",
      "nl": "Zes stappen met de winkel: uw webshopaccount, uw bedrijf, de levering, uw team en tot slot uw welkomstbon. De winkel valideert daarna uw kantoor.",
      "pl": "Sześć kroków ze sklepem: konto w sklepie internetowym, firma, dostawa, zespół, a na koniec bon powitalny. Sklep następnie zatwierdza biuro."},
    "Inscrire mon bureau": {"fr": "Inscrire mon bureau", "en": "Register my office", "nl": "Mijn kantoor inschrijven", "pl": "Zarejestruj moje biuro"},
    "Le formulaire d’inscription est en français.": {"fr": "", "en": "The registration form is in French.", "nl": "Het inschrijvingsformulier is voorlopig enkel in het Frans.", "pl": "Formularz rejestracyjny jest w języku francuskim."}
  });
  function tr(key) { return translations[key] ? translations[key][language] : key; }
  document.title=tr('Livraison au bureau') + " · L’Atelier By";

  var base = new URL('../', location.href);
  var back = new URL(base); if (shop) back.searchParams.set('shop', shop); back.searchParams.set('lang', language);
  var API = String(window.WS_API_BASE_URL || '').replace(/\/$/, '') + '/webshop/shops/' + encodeURIComponent(shop || '0');
  // Le cockpit (atelierby.be/consulant_bo) : le questionnaire d'inscription d'un bureau (…/bureau/?m={boutique}) et la
  // copie des demandes hors zone (…/api/cockpit/bureau-hors-zone). Surchargé par window.LB_COCKPIT si besoin.
  var COCKPIT = String(window.LB_COCKPIT || 'https://atelierby.be/consulant_bo').replace(/\/$/, '');
  var requestKey = Array.from(crypto.getRandomValues(new Uint8Array(16)), function(b){return b.toString(16).padStart(2,'0');}).join('');
  function request(path, options) {
    return fetch(API + path, options).then(function(r){if(!r.ok)throw new Error(r.status===429?tr("Too many requests. Please try again later."):tr("Service unavailable. Please try again."));return r.json();});
  }
  var OTHER = '__other__';
  var root = document.getElementById('root');

  // Mise en page : classes lb-* de livraison-bureau.css (design system du webshop).
  var logo = new URL('../logo.png', location.href).href;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function officeIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '30'); svg.setAttribute('height', '30');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    ['M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16', 'M14 9h5a1 1 0 0 1 1 1v11', 'M2 21h20', 'M8 8h2M8 12h2M8 16h2M17 13h0M17 17h0'].forEach(function (d) {
      var path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('d', d); svg.appendChild(path);
    });
    return svg;
  }

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
    return el('header', { class: 'lb-header' }, [
      el('div', { class: 'lb-header__in' }, [
        el('a', { class: 'lb-logo', href: back.href, 'aria-label': "L'Atelier By" }, [ el('img', { src: logo, alt: "L'Atelier By" }) ]),
        el('a', { class: 'lb-back', href: back.href, text: tr("← Retour à la boutique") }),
      ]),
    ]);
  }

  function footer() {
    return el('footer', { class: 'lb-footer' }, [
      el('span', { text: tr("© 2026 L’Atelier By — Maison de pains et viennoiseries · Belgique.") }),
    ]);
  }


  function render(zones) {
    root.innerHTML = '';
    root.appendChild(header());

    var wrap = el('main', { class: 'lb-main' });

    // ── Hero ──
    wrap.appendChild(el('div', { class: 'lb-hero' }, [
      el('span', { class: 'lb-hero__ico' }, [ officeIcon() ]),
      el('h1', { text: tr("Livraison au bureau") }),
      el('p', { text: tr("L’Atelier By livre vos bureaux — pains, viennoiseries et traiteur, directement au travail.") }),
    ]));

    // ── Carte : le formulaire (ancre #contact) ──
    var card = el('div', { id: 'contact', class: 'lb-card' });

    card.appendChild(el('h2', { text: tr("Où livrons-nous ?") }));
    card.appendChild(el('p', { class: 'lb-card__lede', text: tr("Choisissez votre zone pour consulter les horaires habituels. La disponibilité exacte est confirmée lors de la commande.") }));

    // Droplist groupée par zone principale
    var sel = el('select', { class: 'lb-select', 'aria-label': tr("Zone de livraison") });
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

    card.appendChild(el('label', { class: 'lb-label' }, [
      el('span', { text: tr("Votre zone") }),
      sel,
    ]));

    // Zone couverte : confirmation
    var covered = el('div', { class: 'lb-covered', style: 'display:none' });
    card.appendChild(covered);

    // Formulaire « hors zone »
    var form = el('div', { class: 'lb-form', style: 'display:none' });
    var cp   = el('input', { class: 'lb-input', type: 'text', maxlength: '20', required: '', placeholder: '1348' });
    var city = el('input', { class: 'lb-input', type: 'text', placeholder: 'Louvain-la-Neuve' });
    var comp = el('input', { class: 'lb-input', type: 'text', placeholder: tr("Nom de la société") });
    var head = el('input', { class: 'lb-input', type: 'number', min: '1', max: '100000', step: '1', placeholder: 'ex. 25' });
    var mail = el('input', { class: 'lb-input', type: 'email', required: '', maxlength: '254', placeholder: 'vous@societe.be' });
    var lbl = function (t, node) { return el('label', { class: 'lb-label' }, [ el('span', { text: t }), node ]); };
    form.appendChild(el('p', { class: 'lb-form__intro', text: tr("Indiquez votre adresse et votre e-mail pour que le magasin puisse étudier votre demande.") }));
    form.appendChild(el('div', { class: 'lb-row' }, [ lbl(tr("Code postal *"), cp), lbl(tr("Commune"), city) ]));
    form.appendChild(lbl(tr("Société"), comp));
    form.appendChild(el('div', { class: 'lb-row' }, [ lbl(tr("Nombre de collaborateurs"), head), lbl(tr("E-mail de contact *"), mail) ]));
    var send = el('button', { type: 'button', class: 'lb-send', text: tr("Envoyer ma demande") });
    var fmsg = el('div', { class: 'lb-msg' });
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
      covered.appendChild(el('div', { class: 'lb-covered__title', text: tr("Zone desservie : ") + (z ? (z.zoneSecondary || z.tour) : '') }));
      var mod = el('div', { class: 'lb-covered__details', text: tr("Chargement des modalités…") });
      covered.appendChild(mod);
      // L'inscription du bureau : le questionnaire de la boutique, le même que propose la landing atelierby.be.
      var note = tr("Le formulaire d’inscription est en français.");
      covered.appendChild(el('div', { class: 'lb-go' }, [
        el('h3', { class: 'lb-go__title', text: tr("Inscrivez votre bureau en ligne") }),
        el('p', { class: 'lb-go__lede', text: tr("Six étapes avec la boutique : votre compte webshop, votre société, la livraison, votre équipe, puis votre bon de bienvenue. La boutique valide ensuite votre bureau.") }),
        el('a', { class: 'lb-send lb-go__cta', href: COCKPIT + '/bureau/?m=' + encodeURIComponent(shop), text: tr("Inscrire mon bureau") }),
        note ? el('p', { class: 'lb-go__note', text: note }) : null,
      ]));
      // « pilote tout » : la zone choisie affiche les vraies modalités de la boutique qui livre.
      request('/delivery-zones/' + encodeURIComponent(v))
        .then(function (m) {
          if (sel.value !== v) return;
          mod.innerHTML = '';
          if (!m.days.length) { mod.textContent = tr("Contactez le magasin pour confirmer les jours de livraison."); return; }
          // Les modalités dans l'ordre et avec les libellés de la landing atelierby.be : jours livrés, heure limite,
          // préavis, créneaux (l'horaire seulement s'il n'y a pas de créneau : c'est le même).
          var names = Array.from({length:7}, function(_,i){var n=new Intl.DateTimeFormat(language,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,0,5+i))).replace(/\.$/,'');return n.charAt(0).toUpperCase()+n.slice(1);});
          var slots = m.slots.length ? m.slots : (m.delivery_hours_start && m.delivery_hours_end ? [m.delivery_hours_start.slice(0,5) + '–' + m.delivery_hours_end.slice(0,5)] : []);
          mod.appendChild(el('div', {text: tr("Livré par ") + m.shop}));
          mod.appendChild(el('div', {text: tr("Jours livrés : ") + m.days.map(function(d){return names[d-1];}).join(' · ')}));
          if(m.delivery_cutoff_hour !== null)mod.appendChild(el('div', {text:tr("Heure limite de commande : ")+String(m.delivery_cutoff_hour).padStart(2,'0')+':'+String(m.delivery_cutoff_minute||0).padStart(2,'0')}));
          if(Number(m.delivery_lead_hours)>0)mod.appendChild(el('div',{text:tr("Préavis minimum : ")+m.delivery_lead_hours+' h'}));
          if(slots.length)mod.appendChild(el('div', {text:tr("Créneaux de livraison : ")+slots.join(' / ')}));
        }).catch(function (error) {if(sel.value===v)mod.textContent=error.message;});
    });

    // La copie de la demande au cockpit (Clients › Bureaux du dashboard de la boutique), une fois la réponse de TF Buddy
    // connue : en text/plain par sendBeacon, sans lire la réponse (aucune autorisation d'origine à régler au cockpit).
    function copieCockpit(tfbuddy) {
      try {
        var corps = JSON.stringify({ shop: shop, cp: cp.value.trim(), commune: city.value.trim(), societe: comp.value.trim(), effectif: parseInt(head.value, 10) || null,
          email: mail.value.trim(), origine: 'webshop', tfbuddy: tfbuddy, request_key: requestKey, langue: language });
        var url = COCKPIT + '/api/cockpit/bureau-hors-zone';
        if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([corps], { type: 'text/plain;charset=UTF-8' }))) return;
        fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: corps }).catch(function () {});
      } catch (e) { /* la demande est dans TF Buddy : la copie ne doit jamais gêner le visiteur */ }
    }

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
          copieCockpit(res.ok && res.j.saved === true ? 'ok' : 'refus');
          if (res.ok && res.j.saved === true) {
            form.innerHTML = '';
            form.appendChild(el('p', { class: 'lb-done', role: 'status', text: tr("Merci ! Votre demande est enregistrée — nous vous recontactons si une tournée ouvre près de chez vous.") }));
          } else {
            fmsg.textContent = res.j && res.j.description === 'DELIVERY_INTEREST_RATE_LIMIT' ? tr("Trop de demandes. Réessayez plus tard.") : tr("Une erreur est survenue, réessayez.");
          }
        }).catch(function () { send.disabled = false; fmsg.textContent = tr("Réseau indisponible, réessayez."); });
    });
    // Pas de scroll automatique : le client atterrit en HAUT de la page entière
    // (en-tête + hero + section). Seul le formulaire de zone est dynamique.
  }

  if (!shop || !/^[1-9][0-9]*$/.test(shop) || !window.WS_API_BASE_URL) {
    root.appendChild(header());
    root.appendChild(el('p', { class: 'lb-empty', text: tr("Sélectionnez une boutique avant de consulter les zones de livraison.") }));
  } else {
    request('/delivery-zones').then(function(zones){render(zones);}).catch(function(error){
      render([]);
      var notice=el('p', {role:'alert',class:'lb-alert',text:error.message});
      root.querySelector('main').prepend(notice);
    });
  }
})();
