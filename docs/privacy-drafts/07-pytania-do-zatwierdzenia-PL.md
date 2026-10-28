# Informacje potrzebne do zakończenia wdrożenia

Stan: draft-0.2, 27.10.2026. Kontakt webshop@atelierby.be i rynek belgijski są ustalone. Nie trzeba ponownie ich potwierdzać. GA4 można pozostawić wyłączone.

## Do biznesu i właścicieli umów

1. **Sprzedawcy (DEC-01):** proszę o listę sklepów z pełną nazwą sprzedawcy, adresem, BCE/KBO, VAT i kontaktem. Jak klient rozpoznaje sprzedawcę przed złożeniem zamówienia?
2. **Podział odpowiedzialności (DEC-02):** kto decyduje o koncie klienta, realizacji zamówienia, wspólnych kampaniach i analityce? Kto z ASIMA i poszczególnych sklepów widzi dane oraz w jakim celu? Proszę o odpowiednie umowy/uzgodnienia; sam dostęp do zamówień nie rozstrzyga roli.
3. **Dostawcy (DEC-05/06):** jakie firmy faktycznie obsługują hosting, bazę/kopie, e-mail, SMS i płatności? Czy używane są Stripe Connect/Link, Maps i walidacja VAT? Dla każdej usługi potrzebne są: podmiot z umowy, zakres danych, regiony przetwarzania/dostępu i dokumentacja zabezpieczeń transferów poza EOG. Nie przesyłać kluczy API ani haseł.
4. **Usuwanie danych (DEC-04):** jakie okresy i zdarzenia początkowe obowiązują dla kont, zamówień/faktur, reklamacji, maili/SMS, logów i kopii? Kto wykonuje usunięcie? Księgowość/prawnik powinni wskazać właściwe obowiązki sprzedawców.
5. **Obsługa praw (DEC-09/10):** kto odczytuje skrzynkę, przekazuje sprawy sprzedawcom i realizuje dostęp, eksport, poprawienie lub usunięcie? Czy wyznaczono IOD? Jak archiwizujemy zatwierdzone polityki i dowody działania mechanizmu zgód?
6. **B2B i funkcje dodatkowe (DEC-11):** skąd pochodzą dane pracowników, kto widzi zamówienia i informacje firmowe, czy działa lojalność/profilowanie i jakie dane trafiają w uwagi do zamówień?

## Do oceny prawnej po zebraniu powyższych faktów

- Przypisanie administratora/procesora/współadministratorów dla każdego celu oraz właściwe umowy i informacja dla klientów (DEC-02).
- Podstawy prawne i interesy dla poszczególnych procesów, w tym pracowników B2B, danych z uwag i bezpieczeństwa (DEC-03/11).
- Retencja, odbiorcy, transfery, właściwość organów i ewentualny obowiązek IOD (DEC-04/05/06/09).
- Ocena każdego zapisu w urządzeniu klienta: czy potrzebuje zgody, czy czas i zakres są uzasadnione. Sesja karty i limit 12h nie oznaczają automatycznie zwolnienia (DEC-08).
- Wystarczalność dowodu zgody oraz procedura obsługi praw; centralna baza zgód nie jest automatycznie obowiązkowym rozwiązaniem (DEC-10).
- Zatwierdzenie równoważnych tekstów FR/NL/PL i tożsamości w pierwszej warstwie banera (DEC-12).

## Osobno, jeżeli chcemy uruchomić GA4

Potrzebne: właściciel usługi i G-… ID, zatwierdzony cel/zdarzenia, retencja, odbiorca Google i transfery, ustawienia Signals/Enhanced measurement/Ads links oraz test prawdziwych żądań (DEC-07). Samo doklejenie ID nie oznacza gotowości publikacji.

## Po stronie implementacji i wydania

Po uzyskaniu odpowiedzi uzupełnić polityki, podmiot w banerze i rzeczywiste HTTPS URL w API. Przejrzeć flagi gotowości oddzielnie od uruchomienia GA4. Wykonać testy środowiska wdrożeniowego, rzeczywistego Stripe w trybie testowym, infrastruktury/cache, starej PWA i wszystkich objętych stron (DEC-12). Publikacja wymaga osobnego wydania; niczego nie wdrożono.
