# Plan wdrożenia Fidelity w Webshopie

Plan obejmuje funkcjonalność Fidelity w obecnym Webshopie. **Decyzja użytkownika: integracja POS jest odłożona do czasu wstępnych testów Webshopu; testy w przeglądarce wykonujemy po ukończeniu implementacji online.** Wspólny silnik pozostaje podstawą późniejszej integracji POS. Użytkownik potwierdził podczas FID-05: **Fidelity działa w Webshopie; latelier-by-pwa jest wyłącznie wzorem funkcji, bez wdrażania osobnej aplikacji PWA.** Punktem odniesienia jest zachowanie opisane w LAtelier-fidelite-webshop-EN-PL.pdf z 23.10.2026 oraz ustalenia z użytkownikiem. Implementacja ma rozszerzać obecną architekturę aplikacji.

## Obowiązujące zasady architektury

- PDF opisuje zachowanie i wygląd; przykładowy kod latelier-by-pwa jest referencją, nie wzorcem architektury.
- Backend powstaje w istniejącym centralnym API, w obecnym podziale kontroler/serwis/repozytorium. Nie tworzymy osobnego backendu Webshopu.
- Wykorzystujemy obecne konta, sesje, katalog, zamówienia, płatności, promocje i POS. Nowe funkcje zachowują konwencje projektu i kompatybilność.
- Aktualny model bazy jest podstawą. Nie kopiujemy tabel pwa_* ani ws_order_lines bez weryfikacji. Nie dodajemy id_brand; produkty identyfikujemy globalnie.
- Migracje przedstawiamy osobno przed zastosowaniem. Dane klientów i istniejące nagrody wymagają inwentaryzacji oraz planu zachowania.
- Zmiany kodu tylko na master, bez szerokich refaktoryzacji i nowych frameworków. Zachowujemy cudze niescommitowane zmiany.
- Nie uruchamiamy produkcyjnych migracji ani deploymentu w ramach tego planowania.

## Zakres i stan wyjściowy

Poniżej opisano stan początkowy po analizie PDF i kodu. Postęp implementacji oraz wyniki testów są zapisane przy poszczególnych etapach.

Webshop ma zakładkę lojalnościową z zapowiedzią, flagę widoczności, wspólnego klienta, centralną wycenę, promocje i cykl voucherów. Zamówienia korzystają z webshop_order, client_order i client_order_product, z dodatkowymi metadanymi oraz powiązaniem transakcji kasowej.

Fidelity zawiera dopasowanie słów kluczowych, naliczanie ze starych zakupów/kawy, tworzenie i wygasanie nagród oraz interfejs kart i QR. W jego repozytorium brakuje SQL, seedów, dokumentacji LOYALTY i testów. W FID-01 odnaleziono lokalne eksporty schematów w agent_db (7 września 2026), w tym struktury kart, pieczątek i nagród; nie są potwierdzeniem aktualnej produkcji. Nie potwierdzono kompletnej realizacji nagród przez POS ani zgodności starszych kontraktów logowania.

Użytkownik potwierdził w FID-01, że Fidelity jest wyłącznie prototypem. Nie przenosimy jego sald ani nagród; aktualne dane klientów i sprzedaży pozostają chronione. Wynik i ograniczenia: [inwentaryzacja Fidelity](fidelity-inwentaryzacja.md).

Ryzyka do usunięcia: zapis podczas odczytu kart, ograniczenie liczby pieczątek do 1–50, konwersja ilości na integer, współbieżne wydawanie nagród, brak źródła obecnych zamówień, deduplikacja z paragonem i poprawny kontekst sklepu zakupu.

Punkty, mnożniki, abonamenty, kawiarnia, gra, opinie oraz Scan & Go nie wchodzą automatycznie do pierwszego wdrożenia kart. Ich przyszła integracja ma korzystać z tej samej architektury; nie oznacza to usunięcia istniejących funkcji Fidelity.

## Zatwierdzone reguły biznesowe

Użytkownik zatwierdził pakiet R01–R15 wersji 1: [reguły biznesowe](fidelity-reguly-biznesowe.md). Obowiązują rekomendowane warianty MVP, nie opisane tam alternatywy:

- Naliczanie za Webshop i POS raz, przy realizacji; przed odbiorem/dostawą tylko prognoza. Kod nowej nagrody po naliczeniu, nie przy potwierdzeniu zamówienia.
- Jedna pełna płatna sztuka = jedna pieczątka. Bez porcji, wagi, menu, dodatków i gratisów; bez mnożników punktowych. Bez kontekstów firmowych w MVP.
- Karty sklepowe na start; system przewiduje konfigurację sieciową. Jedna nagroda na koszyk, bez dodatkowego vouchera/automatycznej promocji, gratis z określonej listy.
- Konfigurowalny próg i ważność, domyślnie 10 i 30 dni; nadwyżka przechodzi dalej. Zdobyte pieczątki nie wygasają.
- Bez zakupów historycznych sprzed startu. Korekty, rezerwacje, wygasanie i ewentualne ujemne saldo według R11–R14.
- Konkretne produkty, sklepy i moment startu wymagają konfiguracji przed aktywacją; nie są powodem do odtwarzania danych prototypu.

## Etapy i kryteria ukończenia

Każdy etap ma własny identyfikator używany również w ClickUp. Status początkowy: do zrobienia. Daty, właściciele i estymacje zostaną ustalone osobno.

FID-01 zakończony w zakresie inwentaryzacji lokalnych źródeł i wykazu braków. FID-02 zaakceptowany w całości przez użytkownika. FID-03: przygotowano [projekt integracji](../../api/docs/fidelity-integration.md), [propozycję SQL](../../api/database/2026_10_29_loyalty_cards_proposal.sql) oraz [preflight](../../api/database/2026_10_29_loyalty_cards_preflight.sql) na podstawie odczytu schematu dev przez MCP. FID-04: zaimplementowano lokalnie konfigurację kart w centralnym API i panelu admin oraz wspólne dopasowanie z opcjonalnymi metadanymi katalogu. Migracje wykonano wyłącznie w odizolowanym, tymczasowym MySQL testowym. Nie zmieniono baz istniejących środowisk ani flagi Fidelity w Webshopie. Wyniki i ograniczenia są w projekcie integracji, sekcja FID-04; status ClickUp: testing.

### FID-01 Zweryfikować schemat bazy i dane istniejącego programu

Zależności: brak.

Uzupełnić brakujące schematy, migracje i dane inicjalne Fidelity. Porównać je z aktualnym modelem centralnego API, zamówień, transakcji i klientów. Ustalić, czy istnieją salda i nagrody wymagające zachowania. Zweryfikować obsługę realizacji przez POS.

Kryteria ukończenia: Udokumentowane źródła danych i powiązania klient–zamówienie–transakcja; wykaz danych do zachowania i braków. Brak domniemania zgodności starej bazy z produkcją.

### FID-02 Uzgodnić reguły biznesowe kart i nagród

Zależności: FID-01.

Rozstrzygnąć moment naliczania (propozycja: realizacja odbioru/dostawy), naliczanie online, realizację nagród online, porcje, wagę, menu, gratisy, zakupy firmowe, zwroty, zakres sklepów, kumulowanie promocji i wiele nagród. Wyjaśnić konflikt PDF: kod przy potwierdzeniu kontra naliczenie przy odbiorze.

Kryteria ukończenia: Tabela zatwierdzonych zasad z przykładami: 8+3 przy progu 10 daje nagrodę i 1 pieczątkę; anulowanie; zwrot po wykorzystaniu nagrody; wielokrotne przekroczenie progu. Propozycje są oddzielone od decyzji.

### FID-03 Zaprojektować centralne API i propozycję migracji

Zależności: FID-01, FID-02.

Zaprojektować kontrakty konfiguracji kart, przypisania produktów, salda, prognozy i cyklu nagrody. Wykorzystać istniejące kontrolery, serwisy, repozytoria, sesje oraz model client_order/client_order_product/webshop_order i powiązanie z transakcją. Przygotować osobną propozycję migracji i zachowania danych; bez jej wykonywania.

Kryteria ukończenia: Opis kontraktów, uprawnień, transakcji, idempotencji i powiązań; propozycja migracji bez id_brand; brak dodatkowego backendu Webshopu. Decyzja o zachowaniu/przekształceniu starych tabel oparta na FID-01.

### FID-04 Dodać konfigurację kart i wspólne dopasowanie produktów

Zależności: FID-03.

Dodać obsługę kart w centralnym API i istniejącym panelu administracyjnym: aktywność, nazwa, grafika, kolory, próg, ważność i zakres sklepu. Jedna funkcja dopasowania pełnych słów/fraz z normalizacją i najdłuższym dopasowaniem; wynik udostępniany katalogowi. Uwzględnić reguły porcji i sklepu ustalone w FID-02.

Kryteria ukończenia: Ten sam produkt i kontekst dają tę samą kartę w katalogu i naliczeniu. Testy pain/pain au chocolat, akcentów, remisów, zmiany sklepu i nieaktywnej karty. Brak karty oznacza brak ikony; próg i ważność nie są zakodowane jako stałe.

Stan 2026-10-29: kod konfiguracji i dopasowania gotowy do przeglądu. PASS: 49 testów Fidelity z MySQL (135 asercji), 10 testów regresji katalogu (99 asercji), 66 kontroli panelu, ochrona sześciu tras API i test Chromium przy 1440/768/360 px. SKIPPED: 3 starsze testy katalogu wymagające PDO SQLite. Pozostaje zastosowanie SQL na docelowym środowisku aplikacji, nadanie `LOYALTY.MANAGE` i pełny test panel–API–baza. Zgodność z rzeczywistym naliczaniem będzie sprawdzona przy FID-06; obecny wspólny matcher i kontrakt snapshotów są przygotowane do wykorzystania. Wynik FID-05 poniżej.

### FID-05 Oprzeć Fidelity na istniejącym koncie i sesji Webshopu

Zależności: FID-03.

Fidelity korzysta bezpośrednio z obecnego WSAuth i `/clients/auth/*`. Bez osobnego logowania, adaptera PHP prototypu ani przenoszenia jego sesji. Zachować jeden identyfikator klienta i istniejące zasady aktywacji konta. Zapewnić izolację odpowiedzi podczas wylogowania i zmiany konta oraz prawidłową obsługę odświeżania.

Kryteria ukończenia: Logowanie, odświeżenie, wylogowanie i błędy sesji działają zgodnie z centralnym API. Odpowiedzi poprzedniego klienta nie mogą odtworzyć jego profilu ani danych kart po zmianie sesji. Stare oczekiwanie pojedynczego pola token nie steruje nową implementacją. Test właściciela kart w bazie należy do FID-07, gdy powstanie endpoint ich odczytu.

Stan 2026-10-29: zaimplementowano ochronę sesji w istniejącym WSAuth, wspólny `authenticatedJson` sprawdzający sesję także po odczytaniu body odpowiedzi, kontrolę spóźnionych logowań/odświeżeń oraz zamykanie widoku konta po utracie sesji. Usunięto automatyczną wymianę starego `handoff` i wymuszony reload; taki parametr jest usuwany z URL, a aktualna sesja Webshopu pozostaje źródłem tożsamości. Funkcje odzyskiwania hasła i aktywacji zachowują obecne centralne kontrakty.

PASS: 16 nowych testów sesji, 18 dotychczasowych testów rejestracji/aktywacji/wylogowania/resetu SMS/przechowywania danych, trzy skrypty regresji odświeżania/VIES/usuwania danych fakturowych; 6 testów API (32 asercje). PASS: build Vite i Chromium na 1440/390 px (klient A → awaria 503 → odrzucenie sesji 401 → logowanie B przez formularz → wylogowanie, bez dostępu do rzeczywistego API). Brak pominiętych przypadków w uruchomionych zestawach. Pełny test z rzeczywistą usługą uwierzytelniania i baza→karty pozostają do wykonania; stan ClickUp: testing. Szczegóły i polecenia w [dokumencie integracji](../../api/docs/fidelity-integration.md), sekcja FID-05. Wynik kolejnego etapu FID-06 opisano poniżej.

### FID-06 Wdrożyć naliczanie pieczątek i tworzenie nagród

Zależności: FID-04.

Naliczanie po uzgodnionym zdarzeniu realizacji, przez centralny serwis. Powiązać zakup Webshopu i paragon jako jedno zdarzenie biznesowe. Zapisać historię naliczeń, wydań nagród i korekt; obsłużyć wiele progów, wykluczenia, zwroty i wygasanie. Odczyt kart nie przelicza i nie zapisuje całej historii zakupów.

Kryteria ukończenia: Testy ponowień i współbieżności nie tworzą duplikatów pieczątek/nagród. Zamówienie i paragon naliczają raz. Poprawne ilości bez limitu 1–50 ze starego kodu, według FID-02. Korekty pozostawiają ślad i nie tworzą niezależnych sald w aplikacjach.

Stan 2026-10-29: **testing**. Zaimplementowano centralny zapis zdarzeń, worker, historię salda, wiele progów, generowanie kodów nagród, wygaśnięcia, korekty, dług i kompensację z zachowaniem historycznych dat. Adaptery podłączono do odbioru Webshopu, opłaconej sprzedaży POS oraz utworzenia/anulowania korekt; są jawnie **wyłączone** do migracji i ukończenia snapshotów wyceny FID-09/10. Nie naliczają jeszcze rzeczywistych zakupów. Nie zmieniano propozycji schematu ani istniejących środowisk.

PASS: 87 testów Fidelity (368 asercji, w tym 38 nowych testów silnika/adapterów), rzeczywisty izolowany MySQL i równoległe procesy; 50 testów regresji (569 asercji). ERROR: 29 starszych testów korekt nie uruchamia scenariuszy z powodu niepoprawnego DDL fixture (`TEXT UNIQUE` w MySQL); nie są zaliczone. Brak SKIPPED w wykonanych zestawach. Jednorazowy niestabilny wynik partii `SKIP LOCKED` nie powtórzył się w późniejszych testach; opisano go w dokumencie integracji.

Przed aktywacją: pełne snapshoty i identyfikacja odbioru w POS, test wycena→odbiór→saldo oraz jednoznaczna alokacja częściowego zwrotu pozycji mieszającej sztuki płatne i gratisy. Obecne dane korekty nie pozwalają jej odgadnąć; adapter odrzuca taką niejednoznaczność, więc wymaga ona dokończenia w FID-09/10. Cykl rezerwacji nagrody i dostawy nadal niewłączone. Szczegóły, kontrakt i polecenia testów: [FID-06 w dokumencie integracji](../../api/docs/fidelity-integration.md#fid-06--silnik-naliczania-i-adaptery-sprzedaży-2026-10-29).

### FID-07 Udostępnić karty, nagrody i historię w obecnym Webshopie

Zależności: FID-05, FID-06.

Endpointy kart, historii i nagród klienta oraz ekran Moje karty w istniejącej strukturze Webshopu. Zgodnie z decyzją z FID-05 nie uruchamiamy osobnej PWA. Obsłużyć pozostałe pieczątki, wiele gotowych nagród, kod/QR, ważność i stany ładowania/błędu/pustej listy.

Kryteria ukończenia: Webshop pokazuje saldo i nagrody centralnego API, wyłącznie aktualnego klienta i właściwego sklepu. Brak danych nie udaje salda zero. QR reprezentuje nagrodę, nie link instalacyjny. Zachowana istniejąca flaga widoczności i lokalizacja.

Stan 2026-10-29: **testing**. Dodano trzy autoryzowane endpointy GET kart/nagród/historii, stronicowanie, odczyty bez zapisu i ekran kart w obecnym koncie Webshopu. Widok pokazuje dług, oczekujące operacje, zakończone wersje, wszystkie stany nagród i rzeczywisty kod/QR. Usunięto z konta stare wejścia do instalacji PWA. Zakładka wymaga jawnej flagi `true`; kody i dane nie przechodzą między klientami/sklepami. Brak osobnego backendu, zmian schematu ani aktywacji programu.

PASS: 102 testy PHP Fidelity (463 asercje; 15 nowych testów FID-07), 27 testów JavaScript, build oraz Chromium 1440/390 px dla nowego ekranu i regresji sesji. Brak SKIPPED w wykonanych zestawach. Pełny Webshop→rzeczywiste HTTP API pozostaje do sprawdzenia po przygotowaniu środowiska. Ograniczenia aktywacji FID-06 pozostają aktualne. [Kontrakty i wyniki FID-07](../../api/docs/fidelity-integration.md). FID-08 opisano poniżej.

### FID-08 Dodać ikony kart i prognozę pieczątek w zakupach

Zależności: FID-07.

Wspólny komponent ikony i dymka w katalogu, szczegółach produktu i koszyku: przyrost ilości, przed→po, nowe pieczątki, prezent, brakująca liczba i link do kart. Prognoza oparta na wspólnych regułach API; uwzględnić kilka pozycji tej samej karty i wiele progów.

Kryteria ukończenia: Prognoza zgadza się z naliczeniem; pieczątki oczekujące są odróżnione od zdobytych. Aktualizacja po zmianie ilości/sklepu i koszyka. Dymek dostępny z klawiatury, zamykany poza nim, nie zasłania akcji na telefonie.

Stan 2026-10-29: **testing**. Dodano wspólną ikonę/dymek w katalogu, szczegółach i koszyku oraz prognozę w istniejącym centralnym endpointcie wyceny (`include_loyalty` → `loyalty_preview`). Wykorzystuje wspólny matcher, faktyczną alokację gratisów kalkulatora i saldo klienta ze zweryfikowanej sesji. Sumuje karty, wiele progów i dług; oznacza operacje oczekujące. Gość nie ma fikcyjnego salda, błąd nie oznacza zera, prognozowana nagroda nie daje kodu do bieżącego zakupu. Obsługa klawiatury/telefonu, zmiany sklepu, ilości i sesji; link do obecnych kart, PL/FR/NL.

PASS: 116 testów PHP Fidelity (514 asercji, 14 nowych), 114 testów regresji (660 asercji), 80 testów JavaScript, build i Chromium 1440/390 px dla zakupów oraz regresji ekranu kart. **SKIPPED: 1 starszy test rabatu dnia tygodnia wymagający PDO SQLite**, nie jest zaliczony. Pozostałe wykonane przypadki zakończone PASS. Nie wykonano pełnego testu rzeczywistego HTTP API z Webshopem; przeglądarka używa kontrolowanych odpowiedzi, porównanie silnika działa na odizolowanym MySQL.

Bez migracji i aktywacji programu. Prognoza nie zastępuje snapshotu kwalifikacji zapisywanego przy przyjęciu zakupu; FID-09/10 i ograniczenia aktywacji FID-06 pozostają aktualne. [Kontrakty, wyniki i polecenia FID-08](../../api/docs/fidelity-integration.md#fid-08--ikony-kart-i-prognoza-zakupów-2026-10-29).

### FID-09 Zintegrować realizację nagród przy kasie

**Odłożone decyzją użytkownika.** Wracamy do tego etapu po wstępnych testach Webshopu. Nie blokuje FID-10; przełącznik POS pozostaje wyłączony.

Zależności: FID-05, FID-06.

Zweryfikować i uzupełnić istniejącą ścieżkę POS: odczyt kodu/QR nagrody, uprawnienia klienta/sklepu, rezerwacja i rozliczenie gratisu w aktualnej wycenie oraz transakcji. Jeden cykl nagrody dla POS i Webshopu, zwolnienie rezerwacji po nieudanej operacji.

Kryteria ukończenia: Odrzucone wygasłe, wykorzystane i nieuprawnione nagrody. Powtórzenie operacji bez podwójnego rozliczenia. Gratis nie nalicza pieczątki według uzgodnionych reguł. Integracja nie obejmuje nowego Scan & Go.

### FID-10 Dodać wykorzystanie nagrody w koszyku online

Zależności: FID-06, FID-08. FID-09 odłożone; nie jest warunkiem implementacji online.

Dodać wybór nagrody do istniejącej wyceny, zamówienia i płatności. Serwer ustala kwalifikujący się gratis, rezerwuje nagrodę i kończy lub zwalnia rezerwację zgodnie z cyklem zamówienia. Obsłużyć reguły promocji, anulowanie, błędy płatności oraz zamówienia za 0 €.

Kryteria ukończenia: Równoczesne próby użycia tej samej nagrody w Webshopie mogą zakończyć się tylko jedną realizacją. Scenariusz między Webshopem a POS sprawdzimy podczas FID-09. Test ponowień, płatności nieudanej, anulowania, ważności nagrody i koszyka 0 €. Nie można wymusić darmowego produktu przez zmianę payloadu.

Stan 2026-10-29: **testing**. Zaimplementowano zapis warunków naliczania, wybór i wycenę nagrody, atomową rezerwację, realizację przy odbiorze, zwolnienie przy anulowaniu, 0 € bez Stripe i ponowienia zapisu. Ukończono także częściowe zwroty mieszane: zgodnie z decyzją użytkownika obsługujący korektę wskazuje sztuki płatne i gratisy w istniejącym panelu. Serwer kontroluje dostępne pule; tylko płatne sztuki zwracają pieniądze i cofają naliczone pieczątki. Anulowanie korekty przywraca dokładnie jej podział, niezależnie od opóźnienia workera. Nie zmieniono aplikacji POS.

**Właściwa baza aplikacji: `atelier_import_check_20261013_v3`, usługa Docker `mysql` (kontener `tfbuddy-mysql-dev-mysql-1`).** Potwierdzono schemat przez MCP `dev`, snapshot `snap_4330e45d56ea4ca099d004e1f9fbadcb` z 2026-10-29 14:19:16 UTC. Definicje trzech tabel korekt są podstawą izolowanych testów. Tabel nowego Fidelity jeszcze w bazie aplikacji nie ma. Nie zastosowano migracji, nie aktywowano flag ani widoczności programu, bez deploymentu/commit/push.

Ostatnia walidacja: PASS pełny zestaw 151 testów Fidelity / 817 asercji i następnie dodatkowy test utrwalenia podziału bez aktywnej karty; PASS 63 testy integracyjne korekt / 224 asercje (w tym 6 nowych scenariuszy Fidelity, również rollback i wyczerpanie puli gratisów). PASS 139 testów regresji Webshopu/kalkulatora/blokad; SKIPPED 1 test wymagający PDO SQLite (zestaw 140 / 816 asercji). PASS renderowanie formularza w PL/EN/FR/NL, transport panelu, wykonanie JS formularza bez przeglądarki oraz PHP lint i diff check. Ogólny test tłumaczeń panelu FAIL na istniejącym braku `pl/email/template/offer.twig:french`; nie zaliczono go. Wcześniej blokowane testy korekt/PDF/raportów teraz wykonano — starsza informacja o 29 niezweryfikowanych przypadkach nie jest aktualnym ograniczeniem.

**Dalej:** osobne przygotowanie i przedstawienie migracji dla właściwej bazy, konfiguracja kart i harmonogram workera, pełne testy HTTP/płatności, następnie przeglądarka. Bufor ponowienia zapisu działa w otwartym checkoutcie; odświeżenie strony i odzyskanie zamówienia z historii wymagają akceptacji całego przepływu. Aktualny raport i polecenia: [częściowe zwroty](../../api/docs/fidelity-integration.md#fid-10--częściowe-zwroty-sztuk-płatnych-i-gratisów-2026-10-29).

### FID-11 Zweryfikować pełne scenariusze i regresje

Zależności: FID-10.

Uruchomić testy jednostkowe, integracyjne bazy i przeglądarkowe odpowiednie do zmian. Sprawdzić koniec do końca naliczanie, prognozę, odbiór/dostawę, zwroty, wygasanie, wiele sklepów i klientów oraz równoczesne operacje.

Kryteria ukończenia: Udokumentowane wyniki i pozostałe braki; SKIPPED nie oznacza PASS. Regresje zamówień, promocji, voucherów, płatności i POS sprawdzone. Weryfikacja przykładów zatwierdzonych w FID-02.

### FID-12 Przygotować migrację danych i plan pilotażu

Zależności: FID-11.

Przygotować instrukcję wdrożenia, ewentualne przeniesienie sald/nagród, porównanie danych przed/po, sposób monitorowania i wycofania. Zaplanować ograniczony pilotaż. Wykonanie produkcyjnych migracji i deployment pozostają osobnym zadaniem.

Kryteria ukończenia: Próba na środowisku testowym, zgodność sald i otwartych nagród albo potwierdzony brak danych do przeniesienia. Gotowa lista kontroli pilotażu i warunki rozszerzenia. Brak uruchomienia produkcyjnego w ramach przygotowania planu.

Stan 2026-10-29: **building — przygotowanie lokalnego uruchomienia gotowe do przeglądu**. Pakiet przygotowano przed FID-11, aby umożliwić pełne testy; nie zamyka to FID-11 ani pilotażu. [Instrukcja](../../api/docs/fidelity-uruchomienie-dev.md) zawiera dwa pliki proponowanej migracji (dziewięć nowych tabel + uprawnienie ADMIN), odczytowe kontrole przed/po, szablon karty do uzupełnienia, konfigurację i harmonogram workera oraz warunki wycofania aktywacji. Prototyp nie ma sald/nagród do przeniesienia — potwierdzenie użytkownika.

Ponownie potwierdzono schemat `atelier_import_check_20261013_v3` przez MCP `dev`, snapshot `snap_9b15dfc6bdde4bacad730778fadc09fd` z 2026-10-29 15:48:06 UTC. Właściwej bazy nie zmieniono. Publiczna konfiguracja API korzysta z jawnej flagi `loyalty.webshop.visible=false`, działającej bez nieobecnej starszej tabeli `ws_param`. Worker wymaga `--database=SCHEMA` i odmawia przetwarzania przy niezgodności; ma odczytowy `--check`. Flagi backendu pozostają false, POS odłożony, harmonogram nie jest zainstalowany.

PASS: 164 testy PHP / 911 asercji, bez pominięć (Fidelity + publiczna konfiguracja), w tym próba DDL na izolowanym MySQL z pustymi definicjami rzeczywistych rodziców i testy CLI. Po końcowej zmianie postflight ponowiono test migracji: PASS 1/25. PASS publiczna konfiguracja Webshopu, 16 testów sesji Fidelity, lint i diff check. Nie wykonano migracji aplikacji, rzeczywistego bootstrapu workera w `dev_app`, HTTP/Stripe ani przeglądarki. Poprzednie ograniczenia SQLite i tłumaczeń panelu pozostają odnotowane; nie powtarzano ich w tym pakiecie.

**Dalej:** zatwierdzić przedstawione SQL, zastosować je na właściwej bazie lokalnej z kontrolą przed/po, pozostawiając flagi false. Uzupełnić rzeczywiste dane karty/sklepu, następnie przygotować aktywację i pełne scenariusze FID-11. Szczegóły i polecenia: [raport przygotowania](../../api/docs/fidelity-integration.md#fid-12--przygotowanie-lokalnego-uruchomienia-2026-10-29).

Synchronizacja statusu FID-12 do ClickUp **niewysłana**: narzędzie zgłosiło dzienny limit MCP 100/100. Powyższy stan lokalny jest aktualny; po odzyskaniu dostępu należy przenieść raport i status building, bez oznaczania ukończenia pilotażu.

Użytkownik przejął wykonanie migracji. Przekazano [jeden plik SQL](../../api/database/2026_10_29_fidelity_install.sql) zawierający wybór właściwej bazy, kontrole przed/po, dziewięć tabel i uprawnienie. Test dokładnie tego pliku na izolowanym MySQL: PASS 1 test / 31 asercji. Wykonanie na bazie aplikacji nie jest jeszcze potwierdzone. Dalsza praca po migracji: kontrola API/workera i konfiguracja pierwszej karty, następnie FID-11; flagi pozostają false.

## Kolejność dostarczenia

1. FID-01–03: dane, reguły i projekt integracji.
2. FID-04–06: konfiguracja, wspólna tożsamość i naliczanie.
3. FID-07–08: karty i prognoza w Webshopie.
4. FID-10: utrwalenie warunków naliczania, następnie realizacja nagród online.
5. FID-11–12: testy całości Webshopu (w tym przeglądarka po implementacji) i przygotowanie pilotażu.
6. FID-09: integracja POS po wstępnych testach Webshopu.

Testy funkcjonalne powstają wraz z implementacją; FID-11 jest walidacją całego przepływu, nie pierwszym uruchomieniem testów. Stosowanie schematu w środowisku testowym wymaga wcześniejszego przedstawienia propozycji migracji z FID-03.

## Śledzenie wykonania

Plan i zasady architektury utrzymujemy w WebShop/docs/fidelity-plan-wdrozenia.md. ClickUp służy do aktualizowania statusów wykonania. Po zmianie zakresu aktualizujemy odpowiedni etap i zadanie; ukończenie wymaga spełnienia kryteriów oraz zapisania wyników testów.

Lista: [AI w przestrzeni TFB](https://app.clickup.com/9005121874/v/li/1500300000002462).
Zadanie nadrzędne: [WebShop / PWA: uzgodnić i wdrożyć karty z pieczątkami](https://app.clickup.com/t/1amgf88y8q7).
Osobny zakres: [WebShop / POS: uruchomić lojalność i Scan & Go](https://app.clickup.com/t/1amgf88y8qa); jego historyczne instrukcje techniczne nie zastępują ustaleń tego planu.

## Źródła w kodzie

- WebShop/api-config.js — centralne API.
- WebShop/webshop-full-bundle.jsx — zakładka i obecne widoki.
- api/app/Services/Auth/ClientAuthService.php — konta i sesje.
- api/app/Services/Webshop/WebshopOrderService.php — zapis zamówień.
- api/app/Services/Webshop/WebshopOrderCollectionService.php — odbiór i transakcje.
- api/app/Services/Webshop/WebshopOrderVoucherService.php — wzorzec cyklu voucherów.
- latelier-by-pwa/public/api/loyalty.php — referencyjne reguły kart.
- latelier-by-pwa/public/api/helpers.php oraz index.php — starsze kontrakty tożsamości.

## Zadania w ClickUp

- [FID-01: Zweryfikować schemat bazy i dane istniejącego programu](https://app.clickup.com/t/1amgf88z4ug)
- [FID-02: Uzgodnić reguły biznesowe kart i nagród](https://app.clickup.com/t/1amgf88z4uh)
- [FID-03: Zaprojektować centralne API i propozycję migracji](https://app.clickup.com/t/1amgf88z4uj)
- [FID-04: Dodać konfigurację kart i wspólne dopasowanie produktów](https://app.clickup.com/t/1amgf88z4uk)
- [FID-05: Oprzeć Fidelity na istniejącym koncie i sesji Webshopu](https://app.clickup.com/t/1amgf88z4um)
- [FID-06: Wdrożyć naliczanie pieczątek i tworzenie nagród](https://app.clickup.com/t/1amgf88z4un)
- [FID-07: Udostępnić karty, nagrody i historię w obecnym Webshopie](https://app.clickup.com/t/1amgf88z4up)
- [FID-08: Dodać ikony kart i prognozę pieczątek w zakupach](https://app.clickup.com/t/1amgf88z4uq)
- [FID-09: Zintegrować realizację nagród przy kasie](https://app.clickup.com/t/1amgf88z4ur)
- [FID-10: Dodać wykorzystanie nagrody w koszyku online](https://app.clickup.com/t/1amgf88z4ut)
- [FID-11: Zweryfikować pełne scenariusze i regresje](https://app.clickup.com/t/1amgf88z4uu)
- [FID-12: Przygotować migrację danych i plan pilotażu](https://app.clickup.com/t/1amgf88z4uv)
