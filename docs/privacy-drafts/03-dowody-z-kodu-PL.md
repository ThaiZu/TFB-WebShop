# Audyt faktów i ślady w kodzie

PROJEKT DO WERYFIKACJI — materiał wewnętrzny, nie polityka dla klienta. Stan 27.10.2026. Analiza obejmuje bieżące niezacommitowane pliki. Manifest SHA-256 umożliwia rozpoznanie wersji, nie jest dowodem wdrożenia na produkcji.

Aktualizacja draft-0.3: dodano porządkowanie wygasłych resetów e-mail/SMS w API. CLI domyślnie raportuje; uruchomienie --execute, indeksy i harmonogram wymagają wydania przez operatora. Nie usuwa kont ani zamówień. Wycofano robocze 15 lat; szczegóły w 09-retencja-i-domkniecie-PL.md.

## Ustalenia

1. Puste GA4 ID, status draft, wyłączone Ads/Meta są faktami konfiguracji lokalnej. Testy na atrapach nie wykazują rzeczywistego stanu kont Google/Stripe ani hostingu.
2. Zdarzenia własne ograniczają pola do danych handlowych. To nie dowodzi anonimowości Google ani braku jego metadanych technicznych.
3. API przechowuje snapshoty kontaktu, dostawy, faktury i wyceny zamówienia. Są to procesy odrębne od analityki.
4. Uwierzytelnienie ma access 30 min i refresh 90 dni odnawiane przy rotacji. Zapisy klienta korzystają teraz z sesji karty, maks. 12h od każdego zapisu. Nie zmieniono retencji serwera; szczegóły w ../browser-storage.md.
5. SMSAPI jest wskazane w kodzie; reset obejmuje telefon i IP. Nazwa podmiotu umownego, aktywność, retencja i transfery wymagają potwierdzenia, podobnie SMTP.
6. Google Maps/vatcomply występują w modułach biur/klientów. Nie przypisano ich bez dowodu wszystkim odwiedzającym ani do celu GA4. Ustalić wywołania produkcyjne i zakres usługi.
7. Webshop locale jawnie wyłącza zewnętrzny GeoIP. Metoda z ipwho.is pozostaje w ogólnym resolverze dla innych wywołań; nie pisać, że została globalnie usunięta.
8. Nie znaleziono w przeanalizowanym zakresie kompletnej, zweryfikowanej polityki retencji lub automatycznego harmonogramu kasowania wszystkich danych. To brak dowodu w tym audycie, nie dowód braku procedur w całej organizacji.
9. Back-office legacy i strony osobno wdrażane nie są automatycznie objęte wynikiem testu głównego webshopu.
10. Dane ASIMA, sprzedawcy-franczyzobiorcy i działający kontakt wynikają z deklaracji użytkownika; nie przeprowadzono weryfikacji rejestrów firm ani skrzynki.

## Odnośniki do wersji audytowanej

| Plik i linia | Kotwica |
| --- | --- |
| `TFB-WebShop/public/cookie-consent.js:6` | `const KEY` |
| `TFB-WebShop/public/cookie-consent.js:10` | `function sixMonthsAfter` |
| `TFB-WebShop/public/cookie-consent.js:21` | `function cleanCookies` |
| `TFB-WebShop/public/cookie-consent.js:42` | `function stopAdapter` |
| `TFB-WebShop/public/cookie-consent.js:139` | `status: value.status` |
| `TFB-WebShop/public/cookie-consent.js:142` | `localStorage has no native TTL` |
| `TFB-WebShop/webshop-ga4.js:2` | `createGa4Adapter` |
| `TFB-WebShop/webshop-ga4.js:6` | `const keyPrefix` |
| `TFB-WebShop/webshop-ga4.js:17` | `send_page_view` |
| `TFB-WebShop/webshop-ga4.js:20` | `cookie_expires` |
| `TFB-WebShop/webshop-ga4.js:38` | `script.referrerPolicy` |
| `TFB-WebShop/webshop-ga4.js:60` | `sanitizeGa4Event` |
| `TFB-WebShop/webshop-analytics.js:4` | `analyticsItems` |
| `TFB-WebShop/webshop-analytics.js:15` | `analyticsPurchase` |
| `TFB-WebShop/webshop-analytics.js:1` | `observedPurchases` |
| `TFB-WebShop/webshop-cookie-consent.jsx:76` | `contact?.verified` |
| `TFB-WebShop/webshop-cookie-consent.jsx:64` | `aria-modal` |
| `TFB-WebShop/webshop-cookie-consent.jsx:84` | `save({ analytics: true` |
| `TFB-WebShop/webshop-auth-api.jsx:22` | `const TOKEN_KEY` |
| `TFB-WebShop/webshop-auth-api.jsx:23` | `const REFRESH_TOKEN_KEY` |
| `TFB-WebShop/webshop-auth-api.jsx:434` | `async logout` |
| `TFB-WebShop/webshop-i18n.jsx:22` | `const LS_LANG` |
| `TFB-WebShop/webshop-i18n.jsx:23` | `const LS_CUSTOMER` |
| `TFB-WebShop/webshop-i18n.jsx:367` | `function signOut` |
| `TFB-WebShop/webshop-orders-api.jsx:53` | `sessionStorage.setItem('ws.order.token.` |
| `TFB-WebShop/webshop-orders-api.jsx:56` | `sessionStorage.setItem('ws.pendingPay'` |
| `TFB-WebShop/webshop-pwa-install.jsx:8` | `WS_PWA_LATER_KEY =` |
| `TFB-WebShop/webshop-pwa-install.jsx:9` | `WS_PWA_INSTALLED_KEY =` |
| `TFB-WebShop/webshop-pwa-install.jsx:10` | `WS_PWA_DELAY_MS =` |
| `TFB-WebShop/webshop-delivery-preference.js:2` | `const key =` |
| `TFB-WebShop/webshop-delivery-preference.js:16` | `window.WSSessionStorage.setItem` |
| `TFB-WebShop/webshop-shop-router.jsx:12` | `const KEY =` |
| `TFB-WebShop/webshop-full-bundle.jsx:3226` | `const ACCOUNT_TAB_LS` |
| `TFB-WebShop/webshop-full-bundle.jsx:5565` | `const CLEAN_FLAG` |
| `TFB-WebShop/webshop-full-bundle.jsx:5815` | `analyticsEvent('begin_checkout` |
| `TFB-WebShop/vite.config.js:158` | `globPatterns:` |
| `TFB-WebShop/vite.config.js:160` | `importScripts:` |
| `TFB-WebShop/vite.config.js:173` | `urlPattern:` |
| `TFB-WebShop/vite.config.js:179` | `cacheName:` |
| `TFB-Api/app/Services/Webshop/WebshopPrivacyConfig.php:11` | `GA4_MEASUREMENT_ID =` |
| `TFB-Api/app/Services/Webshop/WebshopPrivacyConfig.php:24` | `'status' =>` |
| `TFB-Api/app/Services/Webshop/WebshopPrivacyConfig.php:33` | `'contact' =>` |
| `TFB-Api/app/Services/Webshop/WebshopPrivacyConfig.php:34` | `'controllerRolesConfirmed' =>` |
| `TFB-Api/app/Services/Webshop/WebshopPrivacyConfig.php:46` | `'integrations' =>` |
| `TFB-Api/app/Services/Auth/ClientAuthService.php:19` | `ACCESS_TTL =` |
| `TFB-Api/app/Services/Auth/ClientAuthService.php:20` | `REFRESH_TTL =` |
| `TFB-Api/app/Services/Auth/ClientAuthService.php:485` | `requestSmsPasswordReset` |
| `TFB-Api/app/Services/Auth/ClientAuthService.php:501` | `smsResetRepository->create` |
| `TFB-Api/app/Services/Auth/SmsApiClient.php:47` | `https://api.smsapi.pl` |
| `TFB-Api/app/Services/Webshop/WebshopOrderService.php:176` | `'contact' =>` |
| `TFB-Api/app/Services/Webshop/WebshopOrderService.php:177` | `'delivery' =>` |
| `TFB-Api/app/Services/Webshop/WebshopOrderService.php:178` | `'invoice' =>` |
| `TFB-Api/app/Services/Webshop/WebshopOrderService.php:182` | `'items' =>` |
| `TFB-Api/app/Services/Webshop/WebshopOrderService.php:385` | `INSERT INTO webshop_order` |
| `TFB-Api/app/Services/Webshop/WebshopOrderEmailOutboxService.php:14` | `class WebshopOrderEmailOutboxService` |
| `TFB-Api/app/Services/Webshop/Stripe/WebshopCheckoutService.php:55` | `'line_items'` |
| `TFB-Api/app/Services/Webshop/Stripe/WebshopCheckoutService.php:56` | `'metadata'` |
| `TFB-Api/app/Services/Client/OfficeGeoService.php:98` | `https://maps.googleapis.com` |
| `TFB-Api/app/Services/Client/OfficeGeoService.php:60` | `local_reference` |
| `TFB-Api/app/Services/Client/ClientService.php:645` | `https://api.vatcomply.com` |
| `TFB-Api/v1/Routes/Webshop/webshopLocaleRoutes.php:15` | `resolve($_SERVER, null, false)` |
| `TFB-WebShop/landing/b2b/evenements-b2b.html:5` | `Optional marketing disabled` |
| `TFB-WebShop/landing/b2b/webshop-landing-b2b.js:69` | `sessionStorage.getItem('la_lang'` |
| `TFB-WebShop/landing/b2b/webshop-landing-b2b.js:122` | `sessionStorage.setItem('la_lang'` |
| `TFB-WebShop/php-api/bo/guard.php:60` | `43200` |
| `TFB-WebShop/php-api/bo/guard.php:63` | `setcookie` |
| `TFB-WebShop/public/session-storage.js:5` | `const MAX_AGE` |
| `TFB-WebShop/public/session-storage.js:38` | `function sweep` |
| `TFB-WebShop/public/session-storage.js:43` | `function clearCustomer` |
| `TFB-WebShop/scripts/privacy-pages.mjs:43` | `export function policyPages` |
| `TFB-WebShop/scripts/privacy-pages.mjs:71` | `export function privacyPagesPlugin` |
| `TFB-WebShop/privacy-policies.json:2` | `"version"` |
| `TFB-WebShop/privacy-policies.json:3` | `"status"` |
| `TFB-Api/app/Services/Privacy/WebshopAuthRetention.php:12` | `public function run` |
| `TFB-Api/app/Services/Privacy/WebshopAuthRetention.php:22` | `INTERVAL 15 MINUTE` |
| `TFB-Api/scripts/cleanup-webshop-auth-data.php:7` | `$execute = false` |
| `TFB-Api/scripts/cleanup-webshop-auth-data.php:11` | `--execute` |
| `TFB-Api/database/2026_10_28_webshop_auth_retention_indexes.sql:3` | `ALTER TABLE client_password_reset_token` |
| `TFB-Api/app/Services/Privacy/WebshopAccountReview.php:10` | `public function batch` |
| `TFB-Api/app/Services/Privacy/WebshopAccountReview.php:22` | `review_candidate` |
| `TFB-Api/scripts/review-webshop-accounts.php:6` | `--output=/private/new-file.json` |
| `TFB-Api/app/Services/Panel/ShopInsightService.php:22` | `private const METRICS` |
| `TFB-Api/app/Services/Panel/ShopInsightService.php:143` | `rankingList[]` |
| `TFB-WebShop/docs/privacy-published/privacy-pl.md:1` | `# ` |
| `TFB-WebShop/docs/privacy-published/cookies-pl.md:1` | `# ` |
| `TFB-WebShop/docs/privacy-published/privacy-fr.md:1` | `# ` |
| `TFB-WebShop/docs/privacy-published/cookies-fr.md:1` | `# ` |
| `TFB-WebShop/docs/privacy-published/privacy-nl.md:1` | `# ` |
| `TFB-WebShop/docs/privacy-published/cookies-nl.md:1` | `# ` |
| `TFB-WebShop/webshop-policy-links.jsx:3` | `export function PolicyLinks` |
| `TFB-WebShop/public/policy-links.js:4` | `function render` |
| `TFB-WebShop/webshop-policy-links.js:1` | `export function policyLinks` |

## Braki wymagające zmiany kodu lub oceny wdrożenia

- DEC-08: zapisy preferencji, profilu i PWA są ograniczone do sesji karty i 12h od zapisu. Nadal ocenić niezbędność, zakres i zasadność okresu; nie uznawać ich automatycznie za zwolnione ze zgody.
- DEC-12: pierwsza warstwa aktualnego banera nie zawiera jeszcze potwierdzonej tożsamości administratora; informacja o wycofaniu jest już także w pierwszej warstwie. Uzupełnić potwierdzoną tożsamość i prawdziwe odnośniki po rozstrzygnięciu ról. Przykłady w 05-teksty-interfejsu.md nie zostały wdrożone.
- DEC-07/12: rzeczywisty GA4 i Stripe (w tym cookies/Link) oraz dodatkowe skrypty serwera/CDN wymagają badania wdrożenia. Zachować rozróżnienie Basic Consent Mode, flagi wyłączenia i rzeczywistego ruchu.
- DEC-10: ustalić archiwum wersji i wystarczalność dowodu zgody; nie tworzono nowej bazy zgód/IP wyłącznie dla tego dokumentu.
