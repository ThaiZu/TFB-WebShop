# Cookiebeleid en vergelijkbare technologieën — concept NL

CONCEPT TER VERIFICATIE — NIET PUBLICEREN vóór afronding van DEC-01 t/m DEC-12. Versie draft-0.4, stand 28.10.2026. De lijst beschrijft lokale code, niet waarnemingen op productie. DEC-vermeldingen zijn redactionele opdrachten.

## 1. Scope en verantwoordelijkheid

Dit beleid betreft https://webshop.atelierby.be. Netwerkeigenaar is ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ, NIP 8971903536, ul. Stanisława Leszczyńskiego 4/29, 50-078 Wrocław, Polen. Contact: webshop@atelierby.be. [DEC-01/02: de verantwoordelijke(n) per doel en de rol van de gekozen verkoper benoemen]. Privacybeleid: [DEC-12: werkende NL-link].

Cookies zijn kleine browseropslagbestanden. Vergelijkbare regels kunnen gelden voor localStorage, sessionStorage, pixels en andere opslag/toegang op het apparaat. De webshop gebruikt ook PWA-cache. Het werkelijke doel en de noodzakelijkheid bepalen de kwalificatie, niet de technologienaam.

## 2. Categorieën en keuze

Strikt noodzakelijke mechanismen ondersteunen communicatie of een uitdrukkelijk gevraagde functie. De vrijstelling moet afzonderlijk worden beoordeeld en neemt de informatieplicht niet weg. Langdurige voorkeuren zijn niet automatisch noodzakelijk (DEC-08).

Optionele analyse helpt het webshopgebruik begrijpen. Google Analytics is momenteel uitgeschakeld; Ads, Meta en GTM worden in deze scope niet geactiveerd. Toekomstige GA4-activering vereist informatie, juiste configuratie en voorafgaande toestemming. Het is geen garantie van anonimiteit en geen aankoopvoorwaarde.

Met de knoppen kunt u optionele meting weigeren, instellingen kiezen of analyse accepteren. Sluiten of verder browsen is geen toestemming. Bestellingen en betalingen blijven mogelijk bij weigering. Via ‘Cookie-instellingen’ kunt u wijzigen; weigeren trekt de toestemming in. [DEC-12: benamingen en bereikbaarheid in de feitelijke uitrol controleren].

## 3. Mechanismen in de onderzochte code

Tenzij een externe leverancier wordt genoemd, betreft dit eigen applicatiegegevens. Publiceer categorieën onder DEC-08 niet zonder beoordeling als vrijgesteld.

De functionele gegevens hieronder gebruiken sessionStorage met voorvoegsel `ws.session.v1:`. De grens van 12 uur begint bij iedere schrijfactie; lezen verlengt deze niet. Controle bij lezen, starten en terugkeren naar de pagina. Tabherstel kan de sessie behouden; een tabblad dat door een ander wordt geopend kan een kopie ontvangen. Fysieke verwijdering bij gesloten browser wordt niet gegarandeerd. Bij geblokkeerde opslag wordt alleen paginageheugen gebruikt. Bekende oude localStorage-gegevens worden zonder migratie verwijderd; opnieuw aanmelden is nodig. Onafhankelijke tabbladen of PWA-vensters kunnen een aparte aanmelding vereisen. Deze technische beperking bepaalt geen toestemmingsvrijstelling (DEC-08).

| Mechanisme | Doel en moment | Termijn / kwalificatie |
| --- | --- | --- |
| localStorage ws.consent | Expliciete keuze, versie en tijdstippen | Keuze 6 kalendermaanden geldig, gecontroleerd bij starten/statuswijziging; localStorage heeft geen eigen TTL. Verouderde keuze opgeschoond na kennis van API-beleidsversie; toestemmingsvoorkeur |
| sessionStorage ws_auth_token, ws_auth_refresh_token | Aanmelden en verlengen | Tabsessie, maximaal 12 uur na iedere schrijfactie; rotatie is een nieuwe schrijfactie. API: toegang 30 min, refresh 90 dagen vernieuwd bij rotatie. Uitloggen verwijdert de lokale opslag. DEC-08 |
| sessionStorage ws.customer | Lokaal profiel en accountvoorkeuren | Tabsessie, maximaal 12 uur na schrijven; uitloggen/ongeldige sessie verwijdert het profiel. Omvang en noodzaak: DEC-08 |
| sessionStorage ws.lang, ws.activeShop, `ws.deliveryPreference:<client>:<shop>`, ws.accountTab | Taal, winkel, afleverlocatie en accounttab na gebruik | Tabsessie, maximaal 12 uur na schrijven. Aflevervoorkeur en accounttab worden ook bij uitloggen verwijderd. Noodzaak/termijn: DEC-08 |
| sessionStorage ws.pwa.install.laterAt, ws.pwa.install.installed | Installatiemelding uitstellen of installatie onthouden | Tabsessie, maximaal 12 uur na schrijven; uitstel tot 12 uur. De browsermodus wordt ook gebruikt om installatie vast te stellen. DEC-08 |
| sessionStorage `ws.order.token.<ref>`, ws.pendingPay, ws.lastPay | Besteltoegang en betaling hervatten | Tabsessie, afhankelijk van sessieherstel door de browser; gedeeltelijke opschoning na betaling/uitloggen. Transactioneel, geen analyse; DEC-08 |
| sessionStorage ws_handoff_clean | Technische bescherming van contextoverdracht | Tabsessie en verwijdering na verlaten van die modus; DEC-08 |
| PWA-cache / service worker | Middelen, pagina zonder parameters, updates/offline | Navigatie-HTML: maximaal 2 items, grens van 12 uur toegepast tijdens Workbox-cachebewerkingen. Openbare precachebronnen hebben versies en worden bij updates opgeschoond. Geen API- of parameternavigatie. DEC-08/12 |
| Stripe en de betaalinterface | Na openen van gekozen betaling | Namen, termijnen, ontvangers en noodzaak per functie onderzoeken onder DEC-05/08/12. Niet automatisch geheel Stripe/Link vrijstellen |

## 4. Voorgenomen GA4 — momenteel niet actief

| Mechanisme | Doel | Termijn en voorwaarde |
| --- | --- | --- |
| _ga en `_ga_<identificator>` | Browsers/sessies onderscheiden en gebeurtenissen meten; Google, entiteit te bepalen DEC-05/07 | Na toestemming, actieve configuratie en geldig ID. Code begrenst tot maximaal 180 dagen en resterende toestemmingstijd, zonder verlenging bij ieder bezoek. Werkelijk gedrag verifiëren |
| sessionStorage ws.ga4.purchase.* | Meervoudige aankoopverzending beperken | Na verzending met toestemming; tabsessie, opschoning bij intrekking. Extra paginageheugen vervalt bij sluiten |

Voorgenomen gebeurtenissen: page_view, view_item, add_to_cart, begin_checkout, purchase. Het betreft producten, hoeveelheden, EUR-waarden en transactiereferenties, niet contactvelden of opmerkingen. Google kan identificatoren en technische verbindingsgegevens verwerken. Bewaring door Google staat los van cookielevensduur (DEC-07); toestemming voor zes maanden verwijdert niet automatisch alle gegevens na zes maanden.

## 5. Intrekken, opschonen en browserinstellingen

Intrekking blokkeert verdere modulegebeurtenissen, schakelt meting voor de property uit en verwijdert zichtbare/herkende eigen cookies en optionele GA4-markeringen. Aanmeld-, bestel- en betaalgegevens blijven behouden. Bij een mislukte stop verschijnt een vernieuwingsmelding; een lopende bestelling wordt niet automatisch herladen.

Hiermee kunnen cookies van andere domeinen, HttpOnly of verborgen onder andere paden niet worden gewist, noch reeds verzonden gegevens worden teruggenomen. [DEC-05/07/12: effectiviteit met echte diensten toetsen]. In de browser kunt u ook sitegegevens wissen of beperken. Alles wissen kan uitloggen, voorkeuren en hervattingsgegevens verwijderen; het wist geen serverbestellingen. Browserinstellingen vervangen vereiste toestemming niet.

## 6. Andere pagina’s, oude gegevens en wijzigingen

De opschoonlijst bevat ook _gid, _gat*, _gcl_*, _fbp en _fbc; dit bewijst niet dat zij nu worden aangemaakt. B2B-landing en legacy vereisen DEC-12; de aangepaste landing houdt trackers uitgeschakeld. De la_lang-keuze op de landing staat nu in de tabsessie, maximaal 12 uur na schrijven; oude localStorage wordt verwijderd. De landing heeft een afzonderlijke uitrol (DEC-08/12). Infrastructuurcookies en actieve leveranciers moeten op de echte uitrol worden onderzocht.

Een wezenlijke wijziging in doelen of leveranciers kan nieuwe toestemming vereisen. Een beleidsversiewijziging maakt de vorige keuze ongeldig in het voorbereide mechanisme; archivering van versies en bewijzen valt onder DEC-10. Het privacybeleid vult rollen, ontvangers, doorgiften en rechten aan.
