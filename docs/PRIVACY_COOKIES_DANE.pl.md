# Dane do polityk prywatności i cookies — wersja zweryfikowana dla API i webshopu

Stan weryfikacji: 28.10.2026. Dokument roboczy wewnętrzny, nie polityka przeznaczona do publikacji. Zastępuje ustalenia z przesłanego PRIVACY_COOKIES_DANE.pl.md w zakresie aktualnego API i webshopu. Nie zmieniono przesłanego oryginału.

## Aktualizacja po wyjaśnieniach użytkownika

Retencja 15 lat została wycofana jako nieustalona. Automatyczne usuwanie działa częściowo. Szczegółowy aktualny stan, deklaracje o OVH/ASIMA/Stripe i szkic zasad: docs/privacy-drafts/09-retencja-i-domkniecie-PL.md. Przygotowano CLI czyszczenia wygasłych resetów z ochroną okna SMS; nie wdrożono go ani harmonogramu. Poprzedni opis poniżej nie jest potwierdzeniem działania usług produkcyjnych.

## 0. Zakres, źródła i znaczenie ustaleń

Pobrano aktualizacje z GitHuba i zaktualizowano obie lokalne gałęzie przez fast-forward. Zachowano lokalną implementację cookies, storage i polityk; jej przywrócenie nie wywołało konfliktów. Pozostawiono kopie zapasowe w stash. Nie wykonano commita, push, wdrożenia ani migracji.

- TFB-WebShop: baza HEAD `95949ac86b0c1d3b4827560a24de5cf25517c526` + lokalne zmiany.
- TFB-Api: baza HEAD `1226d79248c36f7a89f9e9469edb570521da8a86` + lokalne zmiany.
- Aktualny frontend kieruje logowanie i zamówienia do konfigurowanego centralnego API, nie automatycznie do legacy php-api: `TFB-WebShop/api-config.js:6`.
- Repozytorium webshopu nadal zawiera starsze php-api, SQL, back-office i dokumentację. Obecność pliku nie dowodzi wykorzystania przez aktualny frontend lub produkcję.
- Osobne repozytoria landing i consultant_BO nie są dostępne w tym środowisku. Opisy ich gier, newsletterów, Claude, hostingu i słabych punktów bezpieczeństwa z poprzedniego dokumentu nie zostały tutaj potwierdzone.
- Nie odczytywano sekretów, produkcyjnej bazy, paneli dostawców ani logów z danymi klientów.

Oznaczenia: **KOD** — implementacja lokalna; **DEKLARACJA** — informacja od użytkownika; **LEGACY** — starsze źródło, nie dowód obecnej produkcji; **DO USTALENIA** — brak wystarczającego dowodu. Kod nie potwierdza umów ani aktualności danych rejestrowych. Nie znaleziono harmonogramu w sprawdzonym zakresie nie oznacza, że nie istnieje on poza repozytorium.

Nie ma podstaw do stwierdzenia, że poprzedni autor korzystał wyłącznie z mock-upu. Istotny błąd to potraktowanie starszych modułów jako kompletnego opisu obecnej aplikacji.

## 1. Sprzedawcy i właściciel sieci

### 1.1. ASIMA i kontakt — już ustalone w projekcie

**DEKLARACJA + KOD:** właściciel sieci to ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ, NIP 8971903536, ul. Stanisława Leszczyńskiego 4/29, 50-078 Wrocław, Polska. Sklep https://webshop.atelierby.be obsługuje rynek belgijski. Kontakt webshop@atelierby.be został wskazany przez użytkownika jako właściwy i działający; nie wykonywano testu skrzynki. Dane występują w `TFB-Api/app/Services/Webshop/WebshopPrivacyConfig.php:26`.

Nie żądamy ponownie tych samych danych. Nie przypisujemy polskiej spółce automatycznie belgijskiego BCE/KBO. Numer KRS i inne dane potrzebne dla konkretnej informacji prawnej można zweryfikować osobno; nie zostały wymyślone.

Właściciel sieci nie jest automatycznie jedynym administratorem wszystkich danych. `controllerRolesConfirmed=false`; tekst administratora dla FR/NL/PL jest pusty do zatwierdzenia.

### 1.2. Dane sklepów — dostępne źródło, ale do potwierdzenia

Poniższa tabela odzwierciedla **LEGACY seed**, nie aktualną bazę produkcyjną. Źródło: `TFB-WebShop/backend/schema/seed-shops.sql:9`. Nie przenosić identyfikatorów bez sprawdzenia na obecne rekordy API.

| Sklep | ID w legacy seed | Nazwa prawna w seedzie | VAT w seedzie | Adres sklepu w seedzie | E-mail w seedzie |
| --- | --- | --- | --- | --- | --- |
| Halle | 4 | Neutralles SRL | BE1024074728 | Auguste Demaeghtlaan 227, 1500 Halle | halle@atelierby.be |
| Corbais | 2 | Berdiff s.a. | BE0451.766.810 | Grand Route 20, 1435 Corbais | corbais@atelierby.be |
| Gosselies | 3 | Max & Sandra De Cnop | BE0794.645.378 | Rue du Pircha 202, 6041 Gosselies | gosselies@atelierby.be |
| Sombreffe | 5 | Antalramo s.r.l. | BE1011.185.606 | Chaussée de Nivelles 136/D, 5140 Sombreffe | sombreffe@atelierby.be |
| Gembloux | 10, nieaktywny w seedzie | Pascal Wauters | brak | tylko miejscowość Gembloux | gembloux@atelierby.be |

Seed nie aktualizuje wszystkich pól przy duplikacie; nie dowodzi stanu istniejącej bazy (`TFB-WebShop/backend/schema/seed-shops.sql:1`). Pisownia Neutralle w niedostępnym Cockpicie, odmienne domeny @latelierby.be, numery SID landingu i status Wavre pozostają niezweryfikowane.

Imię i nazwisko w nazwie sprzedawcy nie dowodzą same w sobie błędu: sprzedawcą może być osoba prowadząca działalność. Formę prawną trzeba potwierdzić. Nie utożsamiać adresu sklepu z siedzibą. Nie traktować numeru wyprowadzonego z VAT jako sprawdzonego wpisu w rejestrze.

**KOD aktualnego API:** ShopService przygotowuje dane publiczne m.in. `id`, `representative_name`, e-mail, adres, telefon i `vat_number` (`TFB-Api/app/Services/Shop/ShopService.php:32`). Nieprawdziwe jest zatem ogólne twierdzenie, że API w ogóle nie obsługuje danych sprzedawcy. Nadal nie potwierdzono, czy dane są kompletne, aktualne i wystarczająco prezentowane przed zakupem.

**DO USTALENIA:** aktualna lista sprzedawców i identyfikatory API, pełna nazwa i forma prawna, właściwy adres, BCE/KBO/VAT oraz kontakt. Imienna lista danych w seedzie jest wskazówką, nie zamknięciem DEC-01.

### 1.3. Potwierdzenie zamówienia

Obecny API buduje e-mail z nazwą sklepu/reprezentanta, adresem i kontaktem (`TFB-Api/app/Services/Webshop/WebshopOrderEmailOutboxService.php:99`). Stwierdzenie, że każda wiadomość podpisana jest wyłącznie L’Atelier By, jest nieaktualne jako opis całej aplikacji. Nie potwierdzono kompletności danych identyfikacyjnych sprzedawcy w każdym ekranie i szablonie; wymaga to przeglądu finalnego widoku i danych.

## 2. Konta, dostęp i odpowiedzialność

### 2.1. Uwierzytelnianie i konto klienta

**KOD:** obecny ClientAuthService zapisuje `password_hash` i sprawdza hasło przez `password_verify` (`TFB-Api/app/Services/Auth/ClientAuthService.php:91`, `TFB-Api/app/Services/Auth/ClientAuthService.php:131`). Wydaje token dostępu i token odświeżania. Serwerowa ważność: access 30 minut, refresh 90 dni, odnawiany przy rotacji. To nie jest okres przechowywania całego konta lub danych zamówień.

Nie stosować do tego API twierdzenia, że tabela klienta jest wyłącznie kopią bez hasła, a każdy reset i logowanie obsługuje stare zewnętrzne ERP. Integracje legacy trzeba opisać jako oddzielny proces, jeżeli nadal są wdrożone. Logowanie nie wymaga wskazania sklepu; profil zawiera powiązania sklepu głównego/preferowanego. Pełny zakres historii, PWA i handoff wymaga sprawdzenia finalnie wdrożonego zestawu aplikacji.

### 2.2. Kto ma dostęp

**DEKLARACJA:** sprzedawcami są franczyzobiorcy; ASIMA ma dostęp do zamówień i decyduje o wspólnych kampaniach. Nie wskazano imiennej listy osób i konkretnych uprawnień.

**KOD:** obecne API ma mechanizmy kontroli dostępu i testy przekazywania zakresu sklepu, np. `TFB-Api/tests/contract/FranchiseAllRoutesAccessTest.php:47`. To obala ogólne twierdzenie o braku jakichkolwiek testów dostępu w aplikacji, ale nie dowodzi pełnej izolacji wszystkich endpointów. Obecność testu nie oznacza, że uruchomiono go w tej sesji.

Opisy wspólnego admin tokenu, Cockpitu bez logowania, kodu dnia CMS i uprawnień BRAND_ADMIN dotyczą innych/legacy ścieżek. Nie są dowodem autoryzacji aktualnego API. Jeżeli te moduły są dostępne produkcyjnie, wymagają osobnego przeglądu zakresów dostępu.

**DO USTALENIA:** kto decyduje o celach każdego procesu, kto ma faktyczny dostęp i w jakim celu, umowy powierzenia lub uzgodnienia współadministracji, jeśli wynikają z rzeczywistego modelu. Nie wybierać ról wyłącznie według dostępu do bazy lub nazwy marki.

### 2.3. Cele innych aplikacji

Gry Fève d’Or/Galette, zdjęcia uczestników, newsletter z otwarciami, Brand Guard, generowanie odpowiedzi przez Anthropic, CRM prospekcji i media osadzone opisano w dokumencie wejściowym. **DO USTALENIA:** źródła i aktywność tych funkcji w oddzielnych repozytoriach. Nie dopisywać ich wszystkich jako aktywnych odbiorców danych klienta webshopu tylko dlatego, że należą do tej samej sieci. Jeżeli działają i wymieniają dane z webshopem, uzupełnić mapę przepływów i właściwe informacje dla tych celów.

Użytkownik zadeklarował brak współpracy z agencją. Wzmianka o agencji w starszym GA4.md nie potwierdza aktualnej współpracy. Nie tworzymy fikcyjnego odbiorcy „agencja GTM”.

## 3. Usługodawcy i przekazywanie danych

### 3.1. Infrastruktura

**DEKLARACJA UŻYTKOWNIKA:** hosting/baza, poczta i kopie są w OVH. **DO USTALENIA:** konkretne podmioty umowne, konfiguracja, regiony i dostęp. Nie potwierdzono backupów w panelu. IP, DNS, starszy workflow wdrożenia i geolokalizacja IP nie potwierdzają umowy, fizycznej lokalizacji wszystkich danych ani tego, że wszystkie aplikacje działają na jednym serwerze.

Wskazania cyber_Folks/OVH, wspólnej bazy atelierby_db, prywatnych eksportów, /root, Roundcube i braku backupów pochodzą ze starszego/niedostępnego zakresu. W tym przeglądzie nie zostały zweryfikowane. Nie deklarujemy „brak kopii” ani „kopie nigdy nieusuwane”. Brak skryptu w repozytorium nie wyklucza usługi backupu lub zewnętrznego harmonogramu.

GitHub jest źródłem kodu; pobrano referencje obu repozytoriów. To nie potwierdza aktualnego wdrażania GitHub Pages ani przekazywania GitHubowi danych klientów. Cloudflare R2 i inne CDN należy potwierdzić w rzeczywistych żądaniach lub konfiguracji; nie mylić hostingu obrazów z pełną bazą klientów.

### 3.2. E-mail

**KOD:** obecny API obsługuje SMTP konfigurowane dla sklepu (`TFB-Api/app/Services/Webshop/WebshopShopMailer.php:22`), kolejkę potwierdzeń `webshop_order_email_outbox` (`TFB-Api/app/Services/Webshop/WebshopOrderEmailOutboxService.php:23`) i SystemEmailLogRepository (`TFB-Api/app/Repositories/SystemMailer/SystemEmailLogRepository.php:7`). Potwierdzenia zamówień wymagają skonfigurowanej skrzynki sklepu w tej ścieżce. Nie opisujemy obecnego rozwiązania jako wyłącznie PHP mail() bez rejestru wysyłek.

Przetwarzane są m.in. adres odbiorcy, język, referencja zamówienia, status i próby wysyłki. Dostawca transportu oraz retencja wiadomości/logów wymagają potwierdzenia. Wzmianki Brevo/SMTP Cockpitu nie potwierdzają, że te usługi obsługują aktualny webshop.

### 3.3. SMS

**KOD:** SMSAPI jest zaimplementowanym dostawcą resetu hasła; wywołanie https://api.smsapi.pl (`TFB-Api/app/Services/Auth/SmsApiClient.php:47`). API zapisuje żądanie resetu, identyfikator klienta gdy rozpoznany, telefon i adres IP, limituje próby i zwraca `expires_in=180`, `retry_after=60` (`TFB-Api/app/Services/Auth/ClientAuthService.php:485`). Kod obsługuje SMSAPI Authenticator. Nie mylić ważności kodu z retencją rekordów żądań i danych u dostawcy.

**DO USTALENIA:** czy usługa jest uruchomiona na produkcji, właściciel konta i podmiot umowny, retencja i lokalizacje. Nie odczytywano tokenu. Funkcje SMS CRM w legacy nie potwierdzają ich wykorzystania w nowym API ani tego, że żaden inny system sieci nie ma innego dostawcy.

### 3.4. Stripe

**KOD:** obsługiwany jest Stripe Connect, z kontem powiązanym ze sklepem i przekazaniem `stripe_account` (`TFB-Api/app/Services/Webshop/Stripe/WebshopCheckoutGateway.php:20`). Kod obsługuje Checkout osadzony oraz przekierowanie (`TFB-Api/app/Services/Webshop/Stripe/WebshopCheckoutService.php:63`). Bieżąca ścieżka tworzenia sesji jawnie przekazuje `payment_method_types=['card']` (`TFB-Api/app/Services/Webshop/Stripe/WebshopCheckoutService.php:39`). Twierdzenia o jednym wspólnym koncie bez Connect i braku tego parametru są nieaktualne.

To nie potwierdza, że każdy sprzedawca przeszedł onboarding lub że wszystkie te funkcje działają na wdrożeniu. Nie wyciągamy automatycznego wniosku o aktywności Bancontact/Link z tekstu przycisku. Link i faktyczne cookies/odbiorcy SDK wymagają sprawdzenia panelu oraz rzeczywistych żądań. Role Stripe zależą od użytej usługi; nie deklarujemy jednej roli dla całości.

**DEKLARACJA UŻYTKOWNIKA:** platforma należy do ASIMA, a sklepy mają konta połączone. **DO USTALENIA:** podmioty umowne, konfiguracja metod, retencja zdarzeń i transfery. Twierdzenie o ws_stripe_event i limicie 60 000 znaków dotyczy legacy; nie przenosimy go bez dowodu na obecne tabele płatności.

### 3.5. Google, VAT i GeoIP

- **GA4:** przygotowane, ale lokalnie wyłączone: puste ID i status draft (`TFB-Api/app/Services/Webshop/WebshopPrivacyConfig.php:11`). Bez gotowej konfiguracji i zgody nie jest uruchamiane przez przygotowany moduł.
- **Google Ads/Meta:** wyłączone w aktualnej konfiguracji. Usunięto bezwarunkowe GTM/Meta z objętych zmianą wejść webshopu; w stronie B2B tego repozytorium marketing jest wyłączony (`TFB-WebShop/landing/b2b/evenements-b2b.html:5`).
- Domena googletagmanager.com w adapterze oznacza również bezpośredni skrypt gtag GA4. Sama nazwa domeny nie dowodzi uruchomienia kontenera GTM.
- Osobny landing z dokumentu wejściowego nie został zbadany. Nie deklarujemy globalnego wyłączenia trackerów całej sieci.
- **Maps:** OfficeGeoService ma serwerową integrację Google Maps (`TFB-Api/app/Services/Client/OfficeGeoService.php:98`). Obecność funkcji nie potwierdza aktywnego klucza ani wykorzystania we wszystkich formularzach. Konkretny zakres danych i cele ustalić per funkcja.
- **VAT:** poza konfigurowanym transportem VIES kod posiada wtórny transport vatcomply.com (`TFB-Api/app/Services/Client/ClientService.php:645`). Nie opisywać wszystkich zapytań jako wyłącznie bezpośrednich do Komisji Europejskiej.
- **GeoIP:** webshop locale jawnie wyłącza zewnętrzny lookup (`TFB-Api/v1/Routes/Webshop/webshopLocaleRoutes.php:15`). Ogólny resolver nadal ma taką możliwość dla innych wywołań; nie usunięto jej globalnie.

### 3.6. Pozostali potencjalni odbiorcy

Anthropic, Meta Graph API, OpenStreetMap, unpkg, YouTube/Vimeo/Drive i Web Push opisane dla Cockpitu/landingu nie zostały potwierdzone jako aktywne przepływy aktualnego klienta webshopu. Starsza strona B2B może zawierać zewnętrzne zasoby i wymaga odrębnego sprawdzenia wdrożenia. Nie przenosimy całej listy do polityki webshopu bez ustalenia odbiorców, celów i faktycznych wywołań.

Nie wydajemy zapewnienia o globalnym braku TikTok/Hotjar/Sentry/reCAPTCHA/Clarity/Firebase/OpenAI na podstawie ograniczonego przeglądu dwóch repozytoriów.

## 4. Przechowywanie danych i usuwanie

### 4.1. Urządzenie klienta — konkretne obecne parametry

Źródło wspólnego mechanizmu: `TFB-WebShop/public/session-storage.js:5`. Nie jest to ocena prawna automatycznie uznająca wszystko za niezbędne.

| Dane | Mechanizm i okres w kodzie | Czyszczenie i ograniczenia |
| --- | --- | --- |
| Profil, tokeny logowania, język, sklep, dostawa, zakładka konta, znaczniki PWA | sessionStorage z prefiksem ws.session.v1:, maks. 12 godzin od każdego zapisu; odczyt nie odnawia czasu | Kontrola przy odczycie, uruchomieniu i powrocie do strony. Rotacja tokenu jest nowym zapisem. Nie jest to absolutny limit sesji serwera |
| Profil, dostawa, zakładka konta | Jak wyżej | Dodatkowo usuwane przy wylogowaniu/unieważnieniu sesji (`TFB-WebShop/public/session-storage.js:43`, `TFB-WebShop/webshop-auth-api.jsx:436`) |
| Stare trwałe wpisy profilu/tokenów/preferencji | Znane klucze localStorage usuwane bez migracji | Dotychczasowi użytkownicy muszą zalogować się ponownie; nie czyścimy danych innych aplikacji ani wyboru cookies |
| Zapis zgody lub odmowy | localStorage ws.consent, wersja i terminy; 6 miesięcy kalendarzowych | Weryfikacja ważności i wersji przez moduł; brak natywnego TTL localStorage |
| Dane wznowienia płatności i dostępu do zamówienia | Istniejące sessionStorage, odrębne od profilu i zgody | Częściowe czyszczenie przy wylogowaniu/płatności; ocenić zakres i retencję osobno |
| HTML nawigacji PWA | Runtime cache do 2 wpisów, maxAgeSeconds=43200 | Workbox egzekwuje przy operacjach cache; API i nawigacje z parametrami wyłączone z tej reguły |
| Publiczne zasoby precache PWA | Wersjonowane | Porządkowanie przy aktualizacji; nie ustalono uniwersalnego 12h TTL dla wszystkich zasobów |
| Język B2B landingu w tym repozytorium | Sesja karty, do 12h od zapisu | Osobny zakres wdrożenia; nie dowodzi zachowania niedostępnego repo landing |

Przeglądarka może przywrócić sesję lub skopiować ją do karty utworzonej przez inną kartę. Nie gwarantujemy fizycznego usunięcia danych przy wyłączonej przeglądarce. Przy zablokowanym storage działa pamięć bieżącej strony. Oddzielne karty/PWA mogą wymagać osobnego logowania.

### 4.2. Serwer i dostawcy — brakujące okresy

| Rodzaj danych | Co potwierdza kod | Co nadal ustalić |
| --- | --- | --- |
| Konto i profil | Dane klienta oraz skrót hasła w aktualnym API | Aktywność/nieaktywność, zamknięcie, usuwanie i niezbędne dalsze przechowywanie |
| Zamówienia i płatności | Bieżące serwisy zapisują zamówienia, snapshoty i dane płatności | Okresy realizacji, reklamacji, roszczeń i obowiązkowej archiwizacji; nie utożsamiać z tokenami |
| Faktury | Procesy rozliczeniowe wymagają rozdzielenia między sprzedawcę i systemy | Faktyczny wystawca, przepisy i okresy potwierdzone przez księgowość |
| E-mail | Outbox, stan prób i logowanie wysyłek | Retencja kolejki, logów, skrzynki i danych dostawcy |
| SMS | Żądania resetu, telefon/IP i zewnętrzny dostawca | Retencja po wygaśnięciu kodu oraz historia u dostawcy |
| Logi bezpieczeństwa/infrastruktury | W wielu procesach powstają dane techniczne | Konkretny zakres, terminy, rotacja i dostęp |
| Backup | Brak dowodu pełnej konfiguracji zewnętrznej | Harmonogram, retencja, lokalizacje, uprawnienia i odtwarzanie |
| Analiza GA4 | Wyłączona w konfiguracji lokalnej | Ustalenia dopiero przed aktywacją; retencja u Google odrębna od cookies |

Nie wykazano kompletnego zatwierdzonego harmonogramu retencji dla wszystkich tych procesów. Nie oznacza to ustalenia „dane nigdy nie są usuwane”. Nie znaleziono w badanym zakresie kompletnej ścieżki samoobsługowego eksportu/usunięcia danych klienta; to nie dowodzi braku procedury organizacyjnej. Obowiązek obsługi praw nie wymaga automatycznie publicznego przycisku do każdej czynności.

## 5. Kontakt, prawa i dokumenty

- Kontakt webshop@atelierby.be jest obecny w API i projektach polityk. Sprawność skrzynki wynika z deklaracji użytkownika, nie testu technicznego.
- **DO USTALENIA:** kto obsługuje zgłoszenia, jak przekazuje je właściwemu sprzedawcy, jak weryfikuje tożsamość i dotrzymuje terminów, kto realizuje dostęp/eksport/usunięcie.
- Nie nazywać adresu kontaktowego IOD/DPO bez faktycznego wyznaczenia. Czy wyznaczenie jest potrzebne, zależy od realnych procesów, nie samego posiadania sklepu.
- Moduł cookies zapisuje wersjonowany wybór po stronie klienta; w tym module nie dodano centralnego dziennika zgód (`TFB-WebShop/public/cookie-consent.js:6`). Nie przesądza to automatycznie niezgodności; dobrać wystarczający sposób wykazania działania i zgody bez zbędnego zbierania IP.
- Polityki PL/FR/NL istnieją jako draft-0.2, ze znacznikami DEC, a podgląd jest dostępny wyłącznie po jawnym włączeniu trybu review. Normalny build z draft nie publikuje tych stron (`TFB-WebShop/scripts/privacy-pages.mjs:43`). URL polityk w API pozostają puste.
- Baner ma odnośniki z konfiguracji, podglądowe linki w trybie review, informację o wycofaniu w pierwszej warstwie oraz obsługę potwierdzonego tekstu administratora. Sam tekst administratora czeka na ustalenie ról (`TFB-WebShop/webshop-cookie-consent.jsx:66`).
- Rejestracja nadal ma tekst łączący akceptację warunków i polityki (`TFB-WebShop/public/locales/fr.json:693`); należy przygotować prawdziwe odnośniki po zatwierdzeniu dokumentów i oddzielić informowanie o prywatności od zgód wymaganych dla konkretnych celów. Nie utożsamiać zapoznania się z polityką ze zgodą na analitykę.

## 6. Rozstrzygnięcie uwag z poprzedniego dokumentu

| Poprzednie ustalenie | Status po sprawdzeniu |
| --- | --- |
| 1. Landing/B2B ładuje trackery bez zgody | B2B tego repo: marketing wyłączony. Osobny landing: niezweryfikowany; osobny przegląd przed jego wydaniem |
| 2. Webshop nie ma stron ani linków do polityk | Częściowo nieaktualne: strony review i linki istnieją; finalne publiczne URL jeszcze niezatwierdzone |
| 3. Wszystkie wymienione narzędzia trzeba dodać do polityki | Dodać odbiorców rzeczywistych dla właściwego procesu. Nie dodawać automatycznie całej listy innych aplikacji |
| 4. lp_legal ma dane przykładowe | Niedostępny zakres. Jeżeli nadal takie są, zastąpić ustalonymi danymi, nie przyjmować 3 lat jako zatwierdzonej retencji |
| 5. Nazwy/domeny/VAT są rozbieżne | Seed potwierdzony, dane aktualnych rekordów i rejestrów wymagają ustalenia. Nie wybierać pisowni i domeny przez zgadywanie |
| 6. Profil zostaje po wylogowaniu | Nieaktualne: sesja karty, limit i czyszczenie profilu/preferencji |
| 7. Wspólny admin token/Cockpit bez logowania/hasło DB w PHP | Nie wydajemy globalnego potwierdzenia. Zweryfikować oddzielne/legacy moduły; przy potwierdzeniu ujawnionych sekretów zaplanować rotację bez publikowania ich treści |
| Brak Connect i tylko jedno konto Stripe | Sprzeczne z obecnym API Connect |
| Tylko redirect Stripe, brak jawnych metod | Sprzeczne z embedded Checkout i payment_method_types w API |
| Brak hasła w lokalnym koncie | Sprzeczne z password_hash aktualnego API |
| Tylko mail(), brak historii wysyłki | Sprzeczne z SMTP, outbox i logowaniem wiadomości |
| Brak webshop@ i danych ASIMA | Sprzeczne z konfiguracją i deklaracjami użytkownika |
| Brak jakichkolwiek testów dostępu | Nieaktualne dla API; nadal nie udowodniono pełnej izolacji wszystkich ścieżek |
| Hosting, brak backupów, dane nigdy nieusuwane | Za mało dowodów; zastąpić precyzyjnym opisem braku potwierdzenia |
| Agencja prowadzi GTM | Niepotwierdzone; sprzeczne z deklaracją użytkownika o braku agencji |

## 7. Co jest rzeczywiście potrzebne do zakończenia

### 7.1. Najkrótsza rozsądna ścieżka dla webshopu bez analityki

1. Pozostawić GA4/Ads/Meta wyłączone; nie zbierać zgód na nieokreślone przyszłe cele.
2. Potwierdzić administratora/administratorów właściwych celów i sprzedawcę konkretnego zamówienia. Uzupełnić potwierdzoną tożsamość w konfiguracji/banerze.
3. Zweryfikować urządzenie klienta i rzeczywiste Stripe/infrastrukturę: wyłącznie technologie ściśle niezbędne mogą korzystać ze zwolnienia. Limit 12h lub sesja nie wystarcza sam w sobie.
4. Uzupełnić zwięzłe prawdziwe informacje: cele, odbiorców, okresy/kryteria, kontakt, prawa i ewentualne transfery. Wskazać ustalonego dostawcę SMTP/SMS/hostingu, bez całej niepotwierdzonej listy innych aplikacji.
5. Zatwierdzić FR/NL i odpowiedni tekst PL dla obsługiwanego interfejsu, opublikować strony, podłączyć URL, dopracować odnośniki przy rejestracji.
6. Przeprowadzić test środowiska testowego: odmowa, płatność, wycofanie, logowanie, stare PWA, cache i faktyczne żądania. Następnie osobne wydanie i kontrola po publikacji.

Jeżeli po inwentaryzacji rzeczywiście działają wyłącznie ściśle niezbędne technologie, nie potrzeba zgody na nie ani rozbudowanego banera „akceptuj wszystko”. Nadal trzeba informować o ich użyciu. Nie zdecydowano tutaj o usunięciu banera: najpierw sprawdzić rzeczywiste usługi.

### 7.2. Minimum informacji do uzyskania poza kodem

- Aktualni sprzedawcy i ich dane; potwierdzony podział odpowiedzialności ASIMA/franczyzobiorców dla konkretnych celów.
- Faktyczni dostawcy i strony umów, zakresy usług, regiony i ewentualne transfery poza EOG.
- Okresy lub zrozumiałe kryteria przechowywania, z rozdzieleniem realizacji, obowiązków prawnych i roszczeń.
- Osoba/zespół obsługujący wskazany kontakt oraz praktyczna ścieżka realizacji praw.
- Zatwierdzenie końcowych informacji w odpowiednich językach.

Nie trzeba powtarzać danych ASIMA ani adresu kontaktowego, które użytkownik już podał. Nie trzeba teraz identyfikatora GA4. Nie trzeba na potrzeby samego banera tworzyć centralnej bazy zgód, IOD, rozbudowanego panelu compliance lub audytować wszystkich niezwiązanych aplikacji sieci. Konieczność konkretnych obowiązków organizacyjnych zależy od procesów i właściwego prawa; nie można z góry zwolnić całego sklepu z RODO.

### 7.3. Prace szersze niż sam baner

Retencja bazy i backupów, procedury praw, bezpieczeństwo i kontrola dostępu, role franczyzodawcy i sklepów to obowiązki związane z przetwarzaniem danych, nie tylko z cookies. Należy je rozwiązywać proporcjonalnie do rzeczywistych procesów, ale nie ukrywać ich braku w polityce. Osobne landing/Cockpit mogą być oddzielnym zadaniem, o ile ich trackery i dane nie należą do wdrażanej ścieżki webshopu.

## 8. Czy cała dokumentacja jest konieczna

Nie ma ogólnego wymogu posiadania dokładnie tego pliku, tej liczby stron, trzech oddzielnych polityk językowych w każdym biznesie ani zestawu identycznego z naszym audytem. Ten dokument to pomoc wewnętrzna do zebrania faktów; nie należy publikować go klientom w całości.

Wymagana informacja dla klienta ma być zrozumiała i odpowiadać działaniu usługi. Cookies niekonieczne co do zasady wymagają wcześniejszej ważnej zgody, realnej odmowy i łatwego wycofania. Ściśle niezbędne technologie mogą być zwolnione ze zgody, ale pozostają objęte informowaniem. Reguły dotyczą również podobnych sposobów zapisu/odczytu, nie tylko plików nazwanych cookies.

Polityka prywatności dotyczy dodatkowo kont, zamówień, kontaktów i płatności. Dane administratora, cele/podstawy, odbiorcy, retencja, prawa i właściwe informacje o transferach nie mogą być fikcyjne. Nie trzeba każdego technicznego pliku i każdej wewnętrznej procedury wkładać do banera. Publiczne informacje można ułożyć warstwowo, a robocze dowody i ustalenia zostawić wewnętrznie.

Mała prosta strona może nie mieć kont, zakupów, wielu sprzedawców ani analityki — jej zakres jest mniejszy. Widoczny u innych krótki baner nie dowodzi, że mają albo nie mają procedur i nie potwierdza zgodności. Nasz sklep obsługuje dane transakcyjne i wielu sprzedawców; stąd potrzeba większej liczby ustaleń, niezależnie od rozmiaru samego banera.

Źródła pierwotne sprawdzone 28.10.2026:
- [Belgijski APD/GBA — cookies i zwolnienia](https://www.autoriteprotectiondonnees.be/citoyen/themes/internet/cookies).
- [APD/GBA — checklista cookies](https://autoriteprotectiondonnees.be/publications/checklist-cookies.pdf): pierwsza warstwa, odmowa, wycofanie i archiwum wersji. Lista jest pomocnicza i niewyczerpująca, nie stanowi osobnej nowej ustawy.
- [RODO — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj), w szczególności art. 5, 7, 12–14 i przepisy o prawach. W tej sesji strona pełnego tekstu zwróciła blokadę JavaScript; nie oznaczamy jej jako ponownie odczytanej w całości.

To określenie zakresu prac i materiał do zatwierdzenia, nie potwierdzenie pełnej zgodności prawnej wdrożenia.

## 9. Weryfikacja i ograniczenia

Wykonano przegląd źródeł po aktualizacji GitHuba i porównanie z załącznikiem. Po scaleniu zmian przeszła pełna lokalna komenda npm run test:unit (25 plików testowych, bez błędów) oraz produkcyjny build. Osobno sprawdzono przeglądarkowy scenariusz zgód i sesji po aktualizacji. Pozostałych testów API, integracyjnych MySQL, Stripe, PWA i nowych scenariuszy promocji nie uruchamiano ponownie w tym zadaniu; wcześniejsze wyniki nie są nowym testem po scaleniu. Nie testowano usług live, infrastruktury produkcyjnej, rzeczywistych kont Google/Stripe/SMS/SMTP ani niedostępnych landing/Cockpit. Nie ujawniono sekretów i nie uznano danych seed za aktualne dane rejestrowe.
