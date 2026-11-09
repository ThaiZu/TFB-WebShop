# Inwentaryzacja Fidelity i punktów integracji

Wynik FID-01: dostępny kod i lokalne schematy wystarczają do uzgodnienia reguł oraz zaprojektowania integracji z centralnym API. Użytkownik potwierdził, że Fidelity jest wyłącznie prototypem: nie ma rzeczywistych sald ani niewykorzystanych nagród do przeniesienia. Nie należy importować demonstracyjnych klientów, zakupów ani nagród.

Zakres tego etapu to inwentaryzacja. Nie wykonano zmian aplikacji, migracji ani połączeń z produkcją. Fakty o schemacie poniżej dotyczą lokalnych eksportów i kodu, a nie potwierdzonego stanu działającej bazy.

## Źródła i ich ograniczenia

| Źródło | Ustalenie | Ograniczenie |
| --- | --- | --- |
| `agent_db/atelierby_db_current.sql` | Schemat `atelier_20260330`, eksport 7 września 2026 o 11:58. Zawiera klienta, zamówienia, transakcje, korekty i vouchery. | Brak INSERT-ów i tabel kart Fidelity. Nie obejmuje późniejszych zmian Webshopu. |
| `agent_db/atelierby_db_webshop.sql` | Schemat `atelierby_db`, eksport zakończony 7 września 2026 o 12:07:02. Zawiera stare tabele `pwa_loyalty_*` i zakupów PWA. | Brak INSERT-ów. AUTO_INCREMENT nie dowodzi liczby rekordów ani obecności danych klientów. |
| `api/database` i aktualny kod `api/app` | Rozszerzenia modelu Webshopu, płatności, porcji, personalizacji i realizacji zamówień. | Obecność pliku migracji nie dowodzi jej zastosowania. |
| `latelier-by-pwa/public` | Reguły i interfejs prototypu. | Brak SQL, seedów, dokumentacji LOYALTY i testów w dostarczonym projekcie. Lokalne eksporty uzupełniają kontekst struktury, nie dane inicjalne. |
| Odpowiedź użytkownika podczas FID-01 | Fidelity jest wyłącznie prototypem. | Nie dotyczy danych klientów i sprzedaży istniejących aplikacji, które muszą pozostać zachowane. |

Nie odtwarzano baz z eksportów. Eksport webshop zawiera DROP TABLE i nie jest migracją do zastosowania. Przed FID-03 trzeba porównać projekt z aktualnym, autoryzowanym schematem środowiska docelowego; wystarczy eksport struktury bez rekordów i sekretów.

## Potwierdzony model obecnych zamówień

| Pojęcie | Źródło w aplikacji | Znaczenie dla Fidelity |
| --- | --- | --- |
| Konto | `client`, `ClientAuthService`, `/clients/auth/*` | Jeden identyfikator klienta, istniejące sesje i uprawnienia. |
| Zamówienie | `client_order` + `webshop_order.id_client_order` | `webshop_order` dodaje kanał, referencję, płatność i snapshoty; nie tworzymy osobnego systemu zamówień. |
| Pozycja | `client_order_product.id_order` | Produkt, porcja, ilość, waga, kwoty i rabaty stanowią podstawę kwalifikacji. |
| Menu i personalizacja | `webshop_order_line_metadata`, snapshoty wyceny | Nie przenosimy filtra `ws_order_lines.parent_line_id` z PDF. Wykluczenia muszą wynikać z aktualnych danych. |
| Klient kupujący i płatnik | `client_order.id_client`, `id_billing_client` | W B2B pieczątek nie wolno bez decyzji przypisywać według płatnika. |
| Sprzedaż | `transaction`, `transaction_product` | `client_order.id_transaction` i `transaction.order_ref` łączą sprzedaż z zamówieniem. |
| Pozycje sprzedaży przy collect | `transaction_product.pos_line_key = web-order-<id pozycji>` | Istniejący ślad powiązania w tej ścieżce; nie zakładać identycznego klucza dla każdego starszego klienta POS. |
| Korekty | `transaction_correction`, `transaction_correction_item.id_transaction_product`, zdarzenia korekt | Korekty lojalności muszą korzystać z obecnego przepływu korekt, nie usuwać bez śladu zapisów. |
| Vouchery | `voucher_code`, `voucher_campaign`, `voucher_redemption` | Dostępny wzorzec rezerwacji i realizacji. Nie jest jeszcze połączeniem z nagrodami prototypu. |

Źródła: `api/database/2026_09_08_webshop_order_channel.sql`; `api/app/Services/Webshop/WebshopOrderService.php` (insertOrderLines, insertLineMetadata); `api/app/Services/Webshop/WebshopOrderCollectionService.php` (transitionSource, collectSource, insertTransaction, insertTransactionLines); `api/app/Repositories/Client/Order/OrderRepository.php` (attachTransactionForCollection).

## Różnice względem schematu prototypu

| Tabela prototypu | Potwierdzone właściwości | Konsekwencja integracyjna |
| --- | --- | --- |
| `pwa_loyalty_card` | Kod unikalny, kolory, obraz, próg, ważność, słowa kluczowe, kategorie kawy i opcjonalny sklep. | Warto zachować funkcje konfiguracji. Strukturę i relację sklepu zaprojektować zgodnie z obecnym systemem. |
| `pwa_loyalty_stamp` | Jeden rekord na sztukę; UNIQUE(source, source_ref); źródła enum purchase/cafe/manual; reward_id. | Nie obsługuje wprost aktualnego Webshopu ani korekt. Klucz źródła nie deduplikuje zamówienia i jego paragonu. |
| `pwa_loyalty_reward` | ready/redeemed/expired; kod unikalny; daty; redeemed_by jako tekst. | Brak stanu rezerwacji i relacji do obecnego zamówienia/transakcji. Tekst redeemed_by nie zastąpi powiązania rozliczenia. |
| `pwa_purchase_items` | Nazwa, całkowita ilość, cena, identyfikator zakupu. | Brak identyfikatora produktu/porcji z obecnego katalogu. Nie tworzymy kopii paragonów tylko dla pieczątek. |
| `pwa_purchases` | Klient, purchase_code, sklep jako tekst, daty. | Brak jawnej relacji do obecnej transakcji i id_shop. Dopasowanie po nazwie sklepu jest niewystarczające. |
| `pwa_client_loyalty`, config, multiplier, tiers, voucher, reward_catalog | Punkty, poziomy, mnożniki i wymiana punktów stanowią osobny mechanizm. | Nie przenosimy ich automatycznie w zakresie kart; nie mieszamy punktów z pieczątkami. |

W starym schemacie pieczątki i nagrody mają CASCADE przy usuwaniu karty; nie ma wykazanych FK klienta ani FK stamp.reward_id. Nowy model musi jawnie chronić historię i referencje. Typy starych identyfikatorów są unsigned, więc zgodność FK z aktualnymi tabelami trzeba zweryfikować, a nie zakładać.

## Naliczanie i integralność

`latelier-by-pwa/public/api/loyalty.php` potwierdza:

- `loyalty_card_for`: pełne słowa/frazy, normalizacja, najdłuższe dopasowanie; dla kawy priorytet kategorii. Remis zachowuje pierwszą kartę w kolejności.
- `loyalty_cards_sync`: stare zakupy i opłacone zamówienia kawowe, integer ilości oraz ograniczenie 1–50; brak ceny/sklepu pozycji w danych przekazywanych do kwalifikacji. Nie przenosić tych ograniczeń do aktualnego katalogu.
- Synchronizacja ponownie odczytuje historię; wykorzystuje INSERT IGNORE i tworzy nagrody w transakcji. Wybór pieczątek do nagrody nie zawiera FOR UPDATE. Współbieżne wydawanie wymaga osobnego projektu blokad i testu, nie samego przeniesienia funkcji.
- Data zdobycia wynika z ostatniej pieczątki, a ważność liczy się od niej. Historyczne naliczenie może od razu wydać wygasłą nagrodę. Potrzebna decyzja o starcie programu i zakupach historycznych.
- `repo_loyalty_cards` wywołuje synchronizację podczas odczytu i tłumi jej wyjątki. Nowy odczyt nie powinien niejawnie zmieniać salda ani ukrywać błędu naliczania.
- Scope kart pochodzi z wybranego/preferowanego sklepu, a pobierane zakupy obejmują klienta bez sklepu każdej transakcji. Naliczanie powinno rozpatrywać sklep rzeczywistego zakupu.

## Punkty integracji do projektu FID-03

1. Zdarzenie realizacji zamówienia: `WebshopOrderCollectionService.transitionSource/collectSource`. Rozróżnić przygotowanie (`completed`), wydanie (`picked_up`) oraz płatność. Sama transakcja płatnicza nie potwierdza wydania produktu.
2. Sprzedaż POS: `PosTransactionFinalizationService.finalize/commitPaidSale`, z istniejącą idempotencją i wyceną serwerową. Deduplikacja musi obejmować również przypadek, gdy POS zapisuje transakcję przed powiązaniem jej z zamówieniem.
3. Powiązanie starszego POS: `attachTransactionForCollection` sprawdza sklep, płatnika, powiązania i zgodność pozycji. Nie omijać tej walidacji w lojalności.
4. Nagrody: `WebshopOrderVoucherService` i `VoucherReservationService` pokazują wzorzec blokowania, rezerwacji, zwalniania oraz rozliczenia. O tym, czy rozszerzyć wspólny mechanizm, czy dodać serwis domenowy korzystający z tej infrastruktury, rozstrzyga FID-03.
5. Zwroty/korekty: `TransactionCorrectionCreateService` i istniejące zdarzenia; należy zachować relację do pierwotnych pozycji i audyt zmian.
6. Tożsamość: `/clients/auth/*`; Fidelity używa starszych `/auth/*` i pojedynczego `token`. Dostosować do centralnego kontraktu oraz odświeżania sesji.

W przeszukanych trasach i serwisach centralnego API oraz dostarczonym Fidelity nie znaleziono realizacji `pwa_loyalty_reward` przy kasie. Istnieją `/vouchers/validate`, `/reserve`, `/release`, `/redeem`, `/reverse`, lecz nie stanowią dowodu obsługi nagród kart. Przegląd obejmuje backend POS w tym workspace; nie potwierdza działania zewnętrznego klienta kasowego ani skanera.

## Dane do zachowania i kwestie otwarte

- Dane prototypu Fidelity: brak migracji sald i nagród, zgodnie z odpowiedzią użytkownika. Nie usuwa to potrzeby ochrony aktualnych klientów, zamówień, transakcji i voucherów.
- Konfigurację kart trzeba ustalić w FID-02. PDF opisuje sześć rodzin, ale nie dostarcza kompletnej listy słów kluczowych ani zweryfikowanego seeda. Nie przedstawiać wymyślonej konfiguracji jako istniejącej.
- Przed wykonaniem migracji: aktualna struktura docelowa, sprawdzenie kolizji nazw, typów kluczy i obecności ewentualnych tabel prototypu. Starsze eksporty są kontekstem, nie potwierdzeniem produkcji.
- Reguły B2B, porcji, wagi, menu, gratisów, zwrotów, zakresu sklepów i historycznych zakupów pozostają w FID-02. Nie wdrażać arbitralnego zaokrąglania ani przypisania do płatnika.
- Dostawy potrzebują wskazania wiarygodnego zdarzenia realizacji. Nie utożsamiać opłacenia zamówienia z dostarczeniem.

## Wynik weryfikacji

Zweryfikowano statycznie DDL obu eksportów, brak instrukcji INSERT, wskazane punkty zapisu i odczytu oraz aktualne nazwy tras i serwisów. FID-01 dostarcza mapę źródeł oraz wykaz braków; brak rzeczywistych sald prototypu potwierdził użytkownik.

Testów jednostkowych, integracyjnych i przeglądarkowych nie uruchamiano: w tym etapie nie zmieniano kodu wykonawczego. Nie zweryfikowano żywej bazy, współbieżności ani urządzenia POS. Następny etap planu to FID-02; FID-01 nie zatwierdza migracji ani reguł biznesowych.

[Plan wdrożenia](fidelity-plan-wdrozenia.md) · [FID-01 w ClickUp](https://app.clickup.com/t/1amgf88z4ug)
