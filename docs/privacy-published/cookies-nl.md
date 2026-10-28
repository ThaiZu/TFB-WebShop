# Cookiebeleid en vergelijkbare technologie

Versie: 2026-10-28.

## 1. Toepassing

Cookies en vergelijkbare technieken omvatten ook sessionStorage, localStorage en PWA-cache. Doel en strikte noodzaak bepalen toestemming. Strikt noodzakelijke technieken voor een uitdrukkelijk gevraagde functie zijn vrijgesteld, met onderstaande informatie. Niet elke handige voorkeur is automatisch noodzakelijk.

## 2. Uw keuze

ASIMA bepaalt de regels van gezamenlijk account en meting; de gekozen verkoper behandelt de bestelling. Contact: webshop@atelierby.be. Vrijwillige Google Analytics vereist actieve configuratie en toestemming. Als meting uitstaat, tonen de instellingen dit zonder toestemming voor toekomstig gebruik te vragen. Bij actieve meting kunt u weigeren, instellingen kiezen of analyse accepteren. Sluiten of doorgaan is geen toestemming. Uw keuze geldt zes kalendermaanden, tenzij een nieuwe versie opnieuw kiezen vereist.

## 3. Mechanismen en termijnen

| Mechanisme | Doel | Termijn en opschoning |
| --- | --- | --- |
| localStorage ws.consent | Keuze, versie en datums | Zes maanden geldig; controle en verwijdering van verouderde keuze door de app. |
| sessionStorage ws.session.v1: — tokens, profiel, voorkeuren | Aanmelding, taal, winkel, levering, accounttab | Tabsessie, maximaal 12 uur na iedere schrijfactie. Tokenrotatie is een nieuwe schrijfactie. Profiel en aflevervoorkeur worden bij uitloggen verwijderd. |
| PWA-installatiemarkeringen in sessie | Installatie en uitstelbericht | Tot 12 uur na schrijven, binnen de tabsessie. |
| sessionStorage ws.order.token.*, ws.pendingPay, ws.lastPay, ws_handoff_clean | Ordertoegang, hervatten betaling en contextoverdracht | Tabsessie; aanvullende opschoning na bepaalde handelingen en uitloggen. |
| PWA-cache / service worker | Openbare middelen, updates, offlinegebruik | Navigatie-HTML: maximaal twee items, grens 12 uur toegepast bij cachebewerkingen. Precachebronnen hebben versies en worden bij updates opgeschoond. API- en parameternavigatie vallen buiten deze cacheregel. |
| Stripe en betaalinterface | Door klant gestarte betaling | Gegevens en duur hangen af van functie/configuratie; zie [Stripe](https://stripe.com/privacy). Transactiegegevens zijn geen Google Analytics-toestemming. |

## 4. Google Analytics

Na activering en toestemming kan Google Analytics _ga en _ga_<identificator> gebruiken. De module beperkt cookies tot maximaal 180 dagen en de resterende toestemmingstijd, zonder verlenging bij elk bezoek. sessionStorage ws.ga4.purchase.* beperkt dubbele aankoopverzending en wordt bij intrekken opgeschoond. Werkelijke opslag hangt af van browser en dienstverlener. Google kan identificatoren en technische context ontvangen; anonimiteit wordt niet gegarandeerd.

## 5. Intrekken

Via ‘Cookie-instellingen’ kunt u wijzigen of intrekken. Weigeren en intrekken blokkeren bestellingen of betalingen niet. De module stopt eigen gebeurtenissen en verwijdert herkende, toegankelijke optionele gegevens, met behoud van aanmelding en betaling. Dit wist geen gegevens van andere domeinen, HttpOnly, onzichtbare paden of reeds verzonden gegevens. Bij onvolledig stoppen verschijnt een verzoek om na de aankoop te vernieuwen.

## 6. Browser en wijzigingen

De browser kan een sessie herstellen of naar een nieuw tabblad kopiëren. Grenzen worden bij lezen, starten en terugkeren gecontroleerd; de app kan bij gesloten browser niets wissen. Bij geblokkeerde opslag wordt alleen paginageheugen gebruikt. Sitegegevens wissen kan uitloggen en voorkeuren/betaalhervatting verwijderen, zonder serverorders te wissen. Bekende oude permanente records worden zonder profielmigratie opgeschoond.
