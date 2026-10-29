# Polityka cookies i podobnych technologii

Wersja: 2026-10-28.

## 1. Zakres

Cookies i podobne technologie obejmują także sessionStorage, localStorage i pamięć PWA. O konieczności zgody decyduje cel i niezbędność użycia. Mechanizmy ściśle niezbędne do funkcji, której żądasz, nie wymagają zgody; informujemy o nich poniżej. Nie każda wygodna preferencja staje się przez to niezbędna.

## 2. Twój wybór

Za zasady wspólnego konta i pomiaru odpowiada ASIMA; za zamówienie — sprzedawca wybranego sklepu. Kontakt: webshop@atelierby.be. Opcjonalny Google Analytics uruchamiany jest tylko przy aktywnej konfiguracji i Twojej zgodzie. Jeśli pomiar jest wyłączony, ustawienia pokazują ten stan i nie proszą o zgodę na jego przyszłe uruchomienie. Przy aktywnym pomiarze możesz odmówić, wybrać ustawienia albo zaakceptować analitykę. Zamknięcie banera i dalsze korzystanie nie są zgodą. Wybór jest ważny sześć miesięcy kalendarzowych, chyba że zmiana wersji wymaga nowej decyzji.

## 3. Mechanizmy i czas

| Mechanizm | Cel | Czas i czyszczenie |
| --- | --- | --- |
| localStorage ws.consent | Wybór zgody lub odmowy, wersja i terminy | Ważność sześć miesięcy; kontrola i usunięcie nieaktualnego wpisu przez aplikację. |
| sessionStorage ws.session.v1: — tokeny, profil i preferencje | Logowanie, język, sklep, dostawa, zakładka konta | Sesja karty, maksymalnie 12 godzin od każdego zapisu. Rotacja tokenu jest nowym zapisem. Profil i preferencje dostawy czyszczone przy wylogowaniu. |
| Znaczniki instalacji PWA w sesji | Obsługa i odroczenie prośby o instalację | Do 12 godzin od zapisu, w sesji karty. |
| sessionStorage ws.order.token.*, ws.pendingPay, ws.lastPay, ws_handoff_clean | Dostęp do zamówienia, wznowienie płatności i przekazanie kontekstu | Sesja karty; dodatkowe czyszczenie przy zakończeniu wybranych czynności i wylogowaniu. |
| Cache PWA / service worker | Publiczne zasoby, aktualizacja i dostęp offline | HTML nawigacji: do dwóch wpisów, limit 12 godzin egzekwowany przy obsłudze cache. Zasoby precache wersjonowane i porządkowane przy aktualizacji. API i nawigacje z parametrami są wyłączone z tej reguły cache. |
| Stripe i jego interfejs | Uruchomiona przez klienta płatność | Zapisy i czas zależą od funkcji i konfiguracji Stripe; szczegóły w [polityce Stripe](https://stripe.com/privacy). Dane transakcyjne nie są zgodą na analitykę Google. |

## 4. Google Analytics

Po uruchomieniu usługi za zgodą Google Analytics może używać _ga oraz _ga_<identyfikator>. Konfiguracja modułu ogranicza cookies do maksymalnie 180 dni i pozostałego czasu zgody, bez odnawiania przy każdym odwiedzeniu. Znacznik sessionStorage ws.ga4.purchase.* ogranicza powtórne wysłanie zakupu i jest czyszczony przy wycofaniu. Faktyczny zapis zależy od przeglądarki i dostawcy. Google może otrzymywać identyfikatory i dane techniczne; nie jest to pomiar gwarantowanie anonimowy.

## 5. Wycofanie zgody

W „Ustawieniach cookies” możesz zmienić wybór lub wycofać zgodę. Odmowa i wycofanie nie blokują zamówień ani płatności. Moduł zatrzymuje własne zdarzenia i usuwa rozpoznane, dostępne zapisy opcjonalne; pozostawia dane logowania i płatności. Nie usuwa w ten sposób danych innych domen, HttpOnly, niewidocznych ścieżek ani danych już wysłanych. Gdy zatrzymanie nie powiedzie się całkowicie, pojawi się informacja o potrzebie odświeżenia po zakończeniu zakupu.

## 6. Przeglądarka i zmiany

Sesja może zostać przywrócona przez przeglądarkę lub skopiowana do nowej karty. Limity sprawdzamy przy odczycie, uruchomieniu i powrocie do strony; przeglądarka nie usuwa na polecenie aplikacji danych, gdy jest wyłączona. Przy zablokowanym zapisie aplikacja używa pamięci bieżącej strony. Usunięcie danych witryny w przeglądarce może wylogować i usunąć preferencje oraz dane wznowienia płatności; nie usuwa zamówień na serwerze. Starsze znane trwałe wpisy są porządkowane bez przenoszenia profilu do nowej sesji.
