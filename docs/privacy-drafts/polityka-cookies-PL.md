# Polityka cookies i podobnych technologii — projekt PL

PROJEKT DO WERYFIKACJI — NIE PUBLIKOWAĆ przed zamknięciem DEC-01–DEC-12. Wersja draft-0.4, stan 28.10.2026. Poniższa lista opisuje kod lokalnej implementacji, nie pomiar produkcji. Znaczniki DEC są uwagami redakcyjnymi.

## 1. Zakres i odpowiedzialność

Dotyczy https://webshop.atelierby.be. Właścicielem sieci jest ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ, NIP 8971903536, ul. Stanisława Leszczyńskiego 4/29, 50-078 Wrocław, Polska. Kontakt: webshop@atelierby.be. [DEC-01/02: wskazać właściwego administratora lub administratorów dla danych celów oraz rolę wybranego sprzedawcy]. Polityka prywatności: [DEC-12: odnośnik PL].

Cookies są małymi zapisami przeglądarki. Podobne zasady mogą dotyczyć localStorage, sessionStorage, pikseli i innych sposobów zapisu/odczytu informacji na urządzeniu. Sklep korzysta także z cache PWA. O kwalifikacji decyduje rzeczywisty cel i niezbędność, nie sama nazwa technologii.

## 2. Kategorie i Twój wybór

Mechanizmy ściśle niezbędne służą przekazaniu komunikacji lub funkcji, której wyraźnie żądasz. Zwolnienie ze zgody trzeba ocenić osobno; nie oznacza ono braku obowiązku informowania. Trwałe preferencje nie są automatycznie niezbędne (DEC-08).

Opcjonalna analityka służy ocenie korzystania ze sklepu. Google Analytics jest obecnie wyłączone; Ads, Meta i GTM nie są aktywowane w opisanym zakresie. Przyszłe włączenie GA4 wymaga uprzedniej informacji, właściwej konfiguracji i zgody. Nie traktujemy go jako anonimowego ani koniecznego do zakupów.

Przyciski pozwalają odrzucić opcjonalny pomiar, wybrać ustawienia albo zaakceptować analitykę. Zamknięcie banera lub dalsze korzystanie nie stanowi zgody. Zamówienia i płatności działają przy odmowie. W „Ustawieniach cookies” możesz w każdym momencie zmienić wybór; odrzucenie wycofuje zgodę. [DEC-12: potwierdzić nazwy i widoczność kontrolek w docelowym wdrożeniu].

## 3. Mechanizmy w analizowanym kodzie

O ile nie wskazano dostawcy zewnętrznego, są to zapisy własnej aplikacji. Kategorie wymagające DEC-08 nie mogą zostać bez sprawdzenia opublikowane jako zwolnione ze zgody.

Zapisy funkcjonalne wymienione poniżej korzystają z kluczy sessionStorage z prefiksem `ws.session.v1:`. Limit 12 godzin jest liczony od każdego zapisu; odczyt nie odnawia czasu. Kontrola odbywa się przy odczycie, uruchomieniu i powrocie do strony. Przywracanie kart przez przeglądarkę może zachować sesję, a karta utworzona przez inną kartę może otrzymać jej kopię. Nie gwarantujemy fizycznego usunięcia danych przy wyłączonej przeglądarce. Gdy zapis jest zablokowany, dane pozostają jedynie w pamięci bieżącej strony. Stare znane wpisy localStorage są usuwane bez migracji; dotychczasowi użytkownicy muszą zalogować się ponownie. Niezależne karty lub okna PWA mogą wymagać oddzielnego logowania. To ograniczenie techniczne, nie rozstrzygnięcie zwolnienia ze zgody (DEC-08).

| Mechanizm | Cel i moment użycia | Czas / kwalifikacja |
| --- | --- | --- |
| localStorage ws.consent | Zapis jawnej zgody lub odmowy, wersji i czasu decyzji | Wybór ważny 6 miesięcy kalendarzowych. Sprawdzany przy uruchomieniu/zmianie stanu; localStorage nie ma własnego TTL. Usunięcie nieaktualnego rekordu po poznaniu wersji polityki z API; zapamiętanie preferencji zgody |
| sessionStorage ws_auth_token, ws_auth_refresh_token | Logowanie i odnowienie dostępu | Sesja karty, maks. 12 godzin od zapisu; rotacja jest nowym zapisem. API: access 30 min, refresh 90 dni odnawiane przy rotacji. Wylogowanie usuwa zapis lokalny. DEC-08 |
| sessionStorage ws.customer | Lokalny profil i preferencje konta | Sesja karty, maks. 12 godzin od zapisu; wylogowanie/błąd sesji usuwa profil. Zakres i niezbędność: DEC-08 |
| sessionStorage ws.lang, ws.activeShop, `ws.deliveryPreference:<client>:<shop>`, ws.accountTab | Język, sklep, miejsce dostawy i zakładka konta, po użyciu danych funkcji | Sesja karty, maks. 12 godzin od zapisu. Preferencje dostawy i zakładka konta usuwane także przy wylogowaniu. Niezbędność i czas: DEC-08 |
| sessionStorage ws.pwa.install.laterAt, ws.pwa.install.installed | Odroczenie komunikatu lub zapamiętanie instalacji | Sesja karty, maks. 12 godzin od zapisu; odroczenie do 12 godzin. Tryb instalacji jest również wykrywany z przeglądarki. DEC-08 |
| sessionStorage `ws.order.token.<ref>`, ws.pendingPay, ws.lastPay | Dostęp do zamówienia i wznowienie płatności | Sesja karty, z uwzględnieniem przywracania sesji przez przeglądarkę; częściowe czyszczenie po płatności/wylogowaniu. Dane transakcyjne, nie analityka; DEC-08 |
| sessionStorage ws_handoff_clean | Techniczna ochrona przekazania kontekstu | Sesja karty i usunięcie po wyjściu z danego trybu; DEC-08 |
| Cache PWA / service worker | Zasoby aplikacji i strona bez parametrów, obsługa aktualizacji/offline | HTML nawigacji: maks. 2 wpisy, limit 12 godzin egzekwowany przy obsłudze cache przez Workbox. Publiczne zasoby precache wersjonowane i czyszczone przy aktualizacji. Bez API i nawigacji z parametrami. DEC-08/12 |
| Stripe i mechanizmy jego interfejsu płatności | Po uruchomieniu wybranej płatności | Nazwy cookies, czasy, odbiorcy i niezbędność poszczególnych funkcji do sprawdzenia w DEC-05/08/12. Nie obejmować automatycznym zwolnieniem całego Stripe/Link |

## 4. Planowane GA4 — obecnie nieaktywne

| Mechanizm | Cel | Czas i warunek |
| --- | --- | --- |
| Cookies _ga oraz `_ga_<identyfikator>` | Rozróżnianie przeglądarek/sesji i pomiar zdarzeń GA4; odbiorca Google, właściwy podmiot do ustalenia w DEC-05/07 | Dopiero po zgodzie, aktywnej konfiguracji i poprawnym ID. Kod ogranicza ważność do maks. 180 dni i pozostałego czasu zgody, bez odnawiania terminu przy każdej wizycie. Rzeczywiste działanie sprawdzić z usługą Google |
| sessionStorage ws.ga4.purchase.* | Ograniczenie wielokrotnego wysłania zakupów | Dopiero po wysłaniu zdarzenia za zgodą; sesja karty, usunięcie przy wycofaniu. Dodatkowa pamięć bieżącej strony znika z jej zamknięciem |

Planowane zdarzenia: page_view, view_item, add_to_cart, begin_checkout, purchase. Dotyczą produktów, ilości, wartości w EUR i referencji transakcji, a nie pól kontaktowych lub notatek. Google może przetwarzać identyfikatory i techniczne dane połączenia. Retencja u Google to odrębna kwestia od żywotności cookies (DEC-07); sama zgoda na sześć miesięcy nie oznacza usunięcia wszystkich danych po sześciu miesiącach.

## 5. Cofnięcie, czyszczenie i ustawienia przeglądarki

Po wycofaniu moduł blokuje dalsze przekazywanie zdarzeń, ustawia wyłączenie pomiaru danej usługi i usuwa dostępne, rozpoznane cookies własnej domeny oraz własne opcjonalne znaczniki GA4. Nie usuwa danych logowania, zamówienia i płatności. Jeżeli zatrzymanie narzędzia się nie powiedzie, pojawia się komunikat o odświeżeniu; sklep nie przeładowuje automatycznie bieżącego zamówienia.

Nie możemy w ten sposób usunąć cookies innych domen, HttpOnly ani niewidocznych pod inną ścieżką, ani cofnąć już wysłanych danych. [DEC-05/07/12: potwierdzić skuteczność z rzeczywistymi dostawcami]. Przeglądarka pozwala osobno usuwać dane witryny lub ograniczać ich zapisywanie. Usunięcie wszystkich danych może wylogować, usunąć preferencje i informacje do wznowienia płatności; nie usuwa automatycznie zamówień z serwera. Ustawienia przeglądarki nie zastępują wymaganej zgody.

## 6. Pozostałe strony, starsze zapisy i zmiany

Lista czyszczenia obejmuje także _gid, _gat*, _gcl_*, _fbp i _fbc. Nie oznacza to, że aktualna wersja je tworzy. Landing B2B i legacy wymagają potwierdzenia zakresu DEC-12; na objętym zmianą landingu trackery pozostają wyłączone. Klucz la_lang landingu jest teraz zapisywany w sesji karty z limitem 12 godzin od wyboru; stary wpis localStorage jest usuwany. Wdrożenie landingu pozostaje osobnym zakresem DEC-08/12. Cookies infrastruktury oraz aktywnych dostawców trzeba ustalić badaniem rzeczywistego wdrożenia.

Zmiana istotnych celów lub dostawców może wymagać ponownej zgody. Zmiana wersji polityki unieważnia poprzedni wybór w przygotowanym mechanizmie; archiwum wersji i dowodów działania wymaga DEC-10. Podstawa ról, odbiorców, transferów i praw znajduje się także w polityce prywatności.
