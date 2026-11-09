# Reguły biznesowe kart Fidelity

Status: zaakceptowane przez użytkownika w całości słowami „Akceptuje. Możesz implementować”. Wersja 1. Obowiązują R01–R15 w rekomendowanym wariancie MVP: pełne sztuki bez porcji/wagi, bez kontekstu firmowego, start z kartami sklepowymi, jedna nagroda na koszyk bez dodatkowego vouchera/promocji. Opisane alternatywy nie zostały wybrane. Akceptacja reguł nie oznacza zastosowania migracji ani uruchomienia programu.

## Ustalenia potwierdzone

- PDF i kod Fidelity są opisem zachowania i materiałem referencyjnym. Implementacja rozszerza istniejący Webshop, centralne API oraz mechanizmy POS.
- Konta, sesje, zamówienia, katalog i wycena pozostają wspólne. Nie tworzymy dodatkowego backendu Webshopu.
- Fidelity jest prototypem, bez rzeczywistych sald i nagród do migracji. Nie importujemy danych demonstracyjnych.
- Zmiany bazy wymagają osobnej propozycji migracji dopasowanej do aktualnego schematu.

## Zaakceptowany pakiet zasad

### R01 Uczestnictwo i początek programu

Karty są przypisane do osoby posiadającej konto klienta. Przy kasie klient musi być rozpoznany przed zakończeniem sprzedaży; w Webshopie korzystamy z zalogowanego konta. Brak klienta nie blokuje zwykłej sprzedaży, ale oznacza brak pieczątek. W MVP nie dopisujemy później anonimowych paragonów.

Naliczamy zakupy zrealizowane od jawnie ustawionego momentu uruchomienia programu, bez odtwarzania wcześniejszej historii. Zamówienie złożone wcześniej, ale wydane po starcie, kwalifikuje się według reguł pokazanych w aktualnym podglądzie. Przed startem program nie obiecuje naliczania. Obecny tekst „dzisiejsze zakupy również będą się liczyć” wymaga dostosowania do rzeczywistej daty startu.

### R02 Moment zdobycia pieczątek

Webshop nalicza po faktycznym wydaniu zamówienia lub potwierdzeniu dostawy. Płatność Stripe, przyjęcie zamówienia i zakończenie przygotowania nie wystarczają. W POS zwykła sprzedaż kwalifikuje się po zakończeniu opłaconej transakcji. Odbiór zamówienia i jego paragon są jednym zakupem i naliczają tylko raz.

Dostawy można włączyć dopiero po wskazaniu wiarygodnego zdarzenia potwierdzającego realizację. Nie zastępujemy go płatnością ani planowanym terminem.

Przed realizacją pokazujemy prognozę. Kod i QR nowej nagrody pojawiają się dopiero po zdobyciu wymaganych pieczątek. To proponowane rozstrzygnięcie sprzeczności między stroną 4 PDF (kod z potwierdzeniem) a stroną 7 (naliczanie przy odbiorze).

### R03 Produkty i jednostki naliczania

Rekomendacja dla pierwszej wersji: jedna kupiona pełna sztuka kwalifikującego się produktu to jedna pieczątka. Nie ma mnożników punktowych ani limitu 50 sztuk odziedziczonego z prototypu. Ilość musi przejść normalną walidację sprzedaży.

Porcje mniejsze niż pełny produkt i sprzedaż wagowa są na początek wyłączone. Nie zaokrąglamy ich do jednej pieczątki. Alternatywa do decyzji: naliczanie proporcjonalne dla porcji według istniejących przeliczników, np. pół produktu daje pół pieczątki. Taki wariant wymaga również prezentacji częściowego postępu. Waga potrzebuje osobnej podstawy, np. ustalonej masy za pieczątkę; nie wynika ona z PDF.

Menu, jego składniki, dodatki, dopłaty za personalizację oraz dostawa nie naliczają pieczątek. Samodzielny pełny produkt z personalizacją może naliczyć jedną pieczątkę za bazowy produkt; dopłaty nie zwiększają liczby.

### R04 Dopasowanie do karty

Jeden produkt kwalifikuje się do najwyżej jednej karty w danym sklepie. Zachowujemy dopasowanie pełnych słów/fraz bez różnic wielkości liter i akcentów; wygrywa najdłuższa pasująca fraza. Remis rozstrzyga jawna kolejność kart, a następnie stały identyfikator. Brak aktywnej pasującej karty oznacza brak ikony i naliczenia.

Reguła jest wspólna dla katalogu, prognozy i naliczania. Uwzględnia ograniczenia R03, a nie samą nazwę produktu. Konfiguracja startowa wymaga przeglądu rzeczywistego asortymentu; nie generujemy automatycznie listy kwalifikowanych produktów tylko na podstawie sześciu nazw rodzin z PDF.

### R05 Rabaty a zdobywanie pieczątek

Produkt po rabacie nadal nalicza pełną pieczątkę, jeżeli dana sztuka pozostaje płatna. Gratis za kartę lub inną promocję nie nalicza pieczątek. Przy „2 kupione + 1 gratis” naliczamy dwie. Zbiorczy rabat nie może ukryć podziału na płatne i darmowe sztuki — serwer korzysta z wyniku obecnej wyceny promocji.

### R06 Zakupy firmowe

Rekomendacja MVP: nie naliczać ani nie realizować nagród w kontekście oferty biurowej/firmowej lub rozliczenia na firmę. Zwykły zakup prywatny osoby, która należy również do biura, pozostaje kwalifikowany. Oceniany jest kontekst zakupu, nie samo członkostwo.

Alternatywa wymaga wskazania beneficjenta: osoba kupująca albo płatnik firmowy. Nie przypisujemy pieczątek automatycznie według klienta z transakcji, gdy zamówienie wskazuje inną osobę.

### R07 Sklepy i zakres karty

System ma obsłużyć karty wspólne dla sieci oraz ograniczone do sklepu, zgodnie z konfiguracją. Rekomendacja na start: karta i jej nagrody obowiązują w sklepie zakupu. Klient widzi sklep na karcie i nagrodzie. Zmiana sklepu nie przenosi salda.

Alternatywa: wspólne pieczątki i realizacja w uczestniczących sklepach sieci. Wymaga biznesowej akceptacji tego, że nagrodę może wydać inny sklep niż ten, w którym klient kupował. W obu wariantach Webshop i POS tego samego zakresu korzystają ze wspólnego salda.

### R08 Progi i wiele nagród

Próg jest konfigurowalny; proponowana wartość startowa to 10. Pełna seria tworzy jedną nagrodę i rozpoczyna kolejną kartę z nadwyżką. Jeden zakup może utworzyć kilka nagród; wszystkie są dostępne na koncie. Nie kasujemy nadwyżki po zdobyciu nagrody.

### R09 Co klient otrzymuje gratis

Nagroda daje jedną pełną sztukę z jawnej listy produktów/porcji dopuszczonych do odbioru dla tej karty. Lista może być węższa niż produkty naliczające pieczątki i musi być skonfigurowana przed aktywacją karty. Sama etykieta „1 chleb gratis” nie uprawnia do dowolnego produktu o dowolnej cenie.

Klient wybiera dostępny produkt. Gratis pokrywa jego bieżącą cenę bazową w danym sklepie, bez wypłaty gotówki, reszty i pokrywania dopłat za personalizację. Cena z makiety (np. 2,50 €) jest przykładem, nie stałą wartością bonu. Niedostępny produkt nie zużywa nagrody; można wybrać inny dopuszczony produkt.

### R10 Realizacja online i łączenie korzyści

Nagrodę docelowo można wykorzystać w POS i Webshopie. Propozycja MVP: najwyżej jedna nagroda na zamówienie/transakcję, z wyłączeniem dodatkowego vouchera i automatycznej promocji w tym koszyku. Pozostałe nagrody zostają na koncie. Zdobywanie pieczątek według R05 pozostaje niezależną operacją.

Przed wyborem nagrody klient widzi nową cenę i informację, które korzyści zastępuje. Nie zmieniamy globalnych zasad istniejących promocji. Rezygnacja z nagrody przywraca zwykłą wycenę. Zamówienie zawierające tylko gratis może mieć 0 € i nie jest kierowane do płatności Stripe; nadal przechodzi normalną kontrolę dostępności i realizacji.

### R11 Rezerwacja nagrody

Sama ikona i podgląd nie blokują nagrody. W Webshopie rezerwujemy ją przy skutecznym utworzeniu zamówienia, w POS zgodnie z istniejącym etapem rezerwacji przed finalizacją. Ponowna walidacja przed zapisem może odrzucić nagrodę wykorzystaną wcześniej w drugim kanale.

Rezerwacja Webshopu trwa do realizacji albo skutecznego anulowania zamówienia. Błąd pojedynczej próby płatności nie zwalnia jej, jeśli zamówienie nadal umożliwia ponowienie płatności. Wycofanie nieopłaconego zamówienia musi korzystać z istniejącego cyklu anulowania; nie wprowadzamy niezależnego, nieuzgodnionego czasu kasowania zamówień. Rezerwacja POS korzysta z obowiązujących zasad jej wygasania/zwalniania.

Nagroda jest ostatecznie wykorzystana przy zakończeniu sprzedaży/wydaniu gratisu. Jedna nagroda nie może być skutecznie użyta dwukrotnie. QR identyfikuje nagrodę, ale nie omija sprawdzenia klienta, sklepu, ważności i statusu.

### R12 Ważność

Propozycja: zdobyte pieczątki nie wygasają, nagrody wygasają po 30 dniach od zdobycia. Oba interfejsy pokazują tę samą datę i godzinę końca ważności; 30 dni oznacza 30 × 24 godziny od zdarzenia zdobycia. Okres nagrody jest konfigurowalny, również bez wygaśnięcia, i zapisany dla wydanej nagrody.

Nagrodę wolno zarezerwować wyłącznie przed końcem ważności i na realizację przypadającą nie później niż jej termin. Zmiana terminu poza ważność wymaga usunięcia nagrody z zamówienia i ponownej wyceny. Jeśli sklep opóźni już przyjętą realizację, zachowujemy ważność tej konkretnej rezerwacji. Zwolnienie rezerwacji po terminie daje nagrodę wygasłą, nie przedłuża jej.

### R13 Anulowanie i zwroty

Anulowanie przed wydaniem nie wymaga odejmowania pieczątek, bo były wyłącznie prognozą. Rezerwacja nagrody zostaje zwolniona z zachowaniem pierwotnej ważności.

Zwrot kwalifikującej się sztuki po realizacji odejmuje pieczątkę; czysto kwotowa korekta bez zmiany ilości nie odbiera jej, o ile sztuka pozostaje płatna. Gdy korekta czyni ją gratisem, należy cofnąć naliczenie zgodnie z R05. Operacje pozostają w historii.

Jeśli cofnięcie naliczenia odbiera prawo do wydanej nagrody: niewykorzystaną i niezarezerwowaną nagrodę unieważniamy, przywracając pozostały postęp. Gdy nagroda została wykorzystana albo jest związana przyjętym zamówieniem, zachowujemy rozliczenie/przyjęte zamówienie, a brakujące pieczątki stanowią ujemne saldo do odrobienia przy kolejnych zakupach. Nie żądamy automatycznie zwrotu pieniędzy za gratis. Ujemny stan musi być jawnie wyjaśniony klientowi.

Doprecyzowanie zaakceptowane przez użytkownika 2026-10-29: przy częściowym zwrocie linii mieszanej obsługujący zwrot wskazuje osobno liczbę sztuk płatnych i gratisowych. Serwer sprawdza obie pozostałe pule, również po wcześniejszych korektach i ich anulowaniu. Płatna sztuka zwraca przypadającą na nią część historycznej kwoty płatnej linii i cofa przypisaną pieczątkę; gratis zwraca 0 € i nie cofa pieczątki. Przy zwrocie całej pozostałej linii lub gdy pozostała tylko jedna pula podział jest jednoznaczny i może go ustalić serwer. Nie wybieramy automatycznie kolejności „płatne najpierw” ani „gratisy najpierw”.

Zwrócony już wydany gratis nie daje wypłaty ani automatycznie nowej nagrody. Reklamacja i ewentualna rekompensata korzystają z istniejącego procesu. Szczegółowe powiązanie korekt z seriami nagród i zwolnieniem rezerwacji musi zachować jeden wynik ekonomiczny przy dowolnej kolejności zdarzeń.

### R14 Zmiany konfiguracji i historia

Wyłączenie karty zatrzymuje nowe naliczanie i ikony. Historia i dotychczasowe nagrody pozostają widoczne, a już wydane nagrody zachowują swoje warunki. Zmiana progu/listy nagród nie może przeliczać historii ani odbierać obiecanej nagrody.

W MVP karta z naliczeniami nie pozwala zmienić progu, zakresu sklepów i warunków nagrody; nowy wariant wymaga nowej wersji karty z jawną datą startu. Przy zmianie powiązań produktów niezrealizowane zamówienia zachowują utrwalone warunki kwalifikacji z momentu przyjęcia. Warunki te są propozycją biznesową; sposób zapisu należy do FID-03.

### R15 Prognoza i dostępność programu

Koszyk sumuje przyrost ze wszystkich kwalifikowanych pozycji danej karty. Dymek pokazuje przyrost swojej pozycji i łączny wynik koszyka; nie sumuje ponownie prognoz innych otwartych zamówień. Prognoza nie uprawnia do użycia jeszcze niezdobytej nagrody w bieżącym zamówieniu.

Osoba niezalogowana widzi informację, że produkt uczestniczy w programie, oraz zachętę do logowania; nie widzi fikcyjnego salda. Awaria nie jest prezentowana jako zero pieczątek. Zwykły zakup może być zrealizowany, a naliczenie nadrobione po zapisanym zdarzeniu; wykorzystanie nagrody wymaga skutecznej walidacji. Nie zastępujemy nieudanej realizacji nagrody cichym obciążeniem pełną ceną.

## Przykłady odbiorowe dla proponowanych zasad

| Przypadek | Oczekiwany wynik |
| --- | --- |
| 8 pieczątek, odbiór 3 kwalifikowanych pełnych produktów, próg 10 | Jedna nagroda i 1 pieczątka nowej karty. |
| 8 pieczątek, przyjęcie i opłacenie tych samych 3 produktów | Nadal 8 zdobytych; prognoza nagrody i 1 pieczątki. Bez nowego kodu. |
| Anulowanie przed odbiorem tych 3 produktów | Pozostaje 8; usunięta prognoza. |
| Powtórzenie zdarzenia odbioru lub późniejszy paragon | Wynik bez zmian; brak drugiego naliczenia. |
| 8 pieczątek i zakup 25 pełnych produktów | 3 nagrody i 3 pieczątki. |
| Dwie pozycje tej samej karty po 2 sztuki, start 7 | Łącznie jedna nagroda i 1 pieczątka; każda pozycja pokazuje +2. |
| 2 sztuki płatne i 1 promocyjny gratis | +2 pieczątki, nie +3. |
| 2 połówki albo 0,5 kg w rekomendowanym MVP | Brak pieczątek; brak obietnicy +1 na ikonie. Wariant proporcjonalny wymaga zmiany R03. |
| Zakup rozliczany na firmę | Brak naliczenia i realizacji w rekomendowanym wariancie R06. |
| Karta sklepowa zdobyta w A, realizacja w B | Odmowa z wyjaśnieniem zakresu; karta sieciowa jest odrębną konfiguracją. |
| 8 pieczątek + zakup 3; następnie zwrot 2, nagroda dostępna | Unieważnienie nagrody, 9 pieczątek postępu. |
| Ten sam zwrot 2 po wykorzystaniu nagrody | Saldo -1, bez odzyskiwania wydanego gratisu; kolejny kwalifikowany zakup daje 0. |
| Jedna nagroda używana równocześnie w POS i Webshopie | Tylko jedna operacja skuteczna, druga dostaje aktualny status. |
| Rezerwacja przed wygaśnięciem, planowany odbiór po terminie | Odmowa zastosowania; klient zmienia termin albo usuwa nagrodę. |
| Anulowanie rezerwacji już po wygaśnięciu | Nagroda wygasła, bez nowego terminu. |
| Darmowy produkt jako jedyna pozycja | 0 € bez Stripe; brak pieczątki za gratis. |
| Błąd płatności, zamówienie czeka na ponowienie | Nagroda nadal zarezerwowana; zwolnienie po skutecznym anulowaniu. |
| Niedostępność API kart | Komunikat o niedostępności, bez fikcyjnego salda i bez bezwarunkowego rabatu. |

## Konfiguracja potrzebna przed uruchomieniem

PDF wymienia Pain, Viennoiseries, Pâtisseries, Café, Sandwichs i Cookies. Dla każdej aktywowanej karty trzeba podać rzeczywisty zakres produktów/porcji, słowa kluczowe, dopuszczone gratisy, grafikę, kolory, sklepy, próg, ważność i datę startu. Brak tych danych nie blokuje projektu kontraktu, lecz blokuje uruchomienie danej karty. Nie należy traktować przykładowych nazw jako zatwierdzonego seeda.

## Rejestr decyzji

Użytkownik zaakceptował R01–R15 oraz przykłady jako cały pakiet, bez zmian. FID-02 zakończony. Występujące w treści słowa „propozycja” i „rekomendacja” wskazują wybrany wariant pierwotnej specyfikacji; alternatywy pozostają poza MVP. Proporcjonalne porcje, B2B i start sieciowy wymagają przyszłej zmiany decyzji.

Wybrane warunki: naliczanie przy realizacji; pełne sztuki; bez zakupów firmowych; karta sklepowa na start; gratis z listy, bez łączenia z voucherem/automatyczną promocją; zwroty zgodnie z R13. Ograniczenia MVP są decyzją użytkownika na podstawie propozycji, nie wymaganiami narzuconymi przez PDF. Konfiguracja konkretnych produktów, sklepów i daty startu nadal jest wymagana przed aktywacją.

Podstawy techniczne: `api/app/Support/ProductPortionEquivalent.php`, `api/app/Services/Webshop/WebshopCartQuoteService.php`, `api/app/Services/Sales/PosCartQuoteService.php` oraz [inwentaryzacja](fidelity-inwentaryzacja.md). Proponowane reguły nie są opisem już działającej funkcji. Testów aplikacji nie uruchamiano; powyższe scenariusze są kryteriami przyszłej implementacji.

[Plan wdrożenia](fidelity-plan-wdrozenia.md) · [FID-02 w ClickUp](https://app.clickup.com/t/1amgf88z4uh)


## Zmiana zatwierdzona 2026-10-30: potwierdzenie zapłaty

Wcześniejszy warunek odebrania zamówienia zostaje zastąpiony potwierdzeniem zapłaty. Opłacone zamówienie może zdobywać pieczątki przed odbiorem i bez odbioru, jeśli nie nastąpił zwrot zakupu. Przy płatności online podstawą jest potwierdzenie dostawcy po stronie backendu; przy płatności w sklepie zapis faktycznej zapłaty. Powtórzenia potwierdzeń i późniejszy odbiór nie naliczają drugi raz. Zwrot przez istniejące korekty cofa odpowiednie pieczątki, także przed odbiorem. Saldo nadal rozlicza worker na podstawie zdarzenia zapisanego w momencie płatności. Samo zapisanie zamówienia i powrót z bramki płatniczej nie są potwierdzeniem zapłaty.

## 2026-10-31 — opcjonalny odbiór gratisu w checkout

Panel „Nagroda Fidelity” pojawia się dopiero po odczytaniu własnych nagród READY, które nie wygasły i pasują do pełnej sztuki lub dozwolonej porcji produktu obecnego w koszyku. Nagrody zarezerwowane, wykorzystane, cofnięte, wygasłe i niepasujące do koszyka nie tworzą opcji wyboru. Odczyt uwzględnia kolejne strony kart i nagród; karta bez gotowych nagród nie wymaga dodatkowego zapytania o historię nagród. Błąd odczytu nie tworzy pozornej dostępności ani nie blokuje zwykłego zakupu.

Klient ma jeden opcjonalny wybór nagrody/produktu, pogrupowany nazwą programu; nie musi najpierw wybierać karty. Domyślnie „Nie wykorzystuj nagrody”. Można zapłacić bez odbioru gratisu, nawet jeśli klient ma pasującą nagrodę. Wybór nie jest automatyczny. Wcześniej wybraną nagrodę można usunąć również wtedy, gdy opcje przestały być dostępne. Aktualne warunki i rezerwację nadal sprawdza API w wycenie i przy zapisie zamówienia.

Przycisk przechodzenia przez checkout i finalizacji ma standardową obsługę kliknięcia z `type="button"`, zamiast `wsTap` i jego lokalnego filtrowania kolejnych zdarzeń. Funkcja przejścia pokazuje komunikat nieaktualnej wyceny zamiast cichego zakończenia. Zachowano walidację terminu, płatności i wyceny, idempotencję zamówienia oraz oddzielną ścieżkę zamówienia o wartości zero. Nie zmieniono serwera, płatności Stripe ani naliczania pieczątek.

Testy: `node --test tests/loyalty-checkout.test.mjs tests/loyalty-reward.test.mjs tests/stripe-checkout.test.mjs`. Scenariusz z rzeczywistym buildem i przechwyconym HTTP: `FIDELITY_BUILD=/tmp/fidelity-checkout-build node tests/ui-loyalty-checkout.cjs`; sprawdza brak nagrody, statusy niepozwalające na odbiór, produkt spoza nagrody, nagrodę na kolejnej stronie, opcjonalną rezygnację, zwykłe płatne zamówienie i zamówienie zerowe. Test nie tworzy realnych zamówień ani sesji Stripe.

Nie odtworzono jednoznacznie zgłoszonego zatrzymania przycisku w rzeczywistej sesji klienta. Kontrolowana ścieżka bez nagród działała również przed zmianą przycisku; dlatego usunięcie filtra zdarzeń nie jest dowodem rozpoznania przyczyny konkretnego zgłoszenia. Użytkownik wskazał `https://webshop.tfbuddy.local/?shop=2&category=group%3A25`. Potwierdzono, że lokalny Vite montuje bieżący katalog WebShop i serwuje nowy kod przycisku oraz wyboru nagrody. Bez migracji i wdrożenia na produkcję.

Wyniki końcowe: trzy pliki testów jednostkowych checkout/nagrody/Stripe PASS; build PASS. Bezpośrednio na lokalnym adresie Webshopu, z całkowicie przechwyconym HTTP API: 6 scenariuszy PASS (1440/390, bez nagrody, dobrowolna rezygnacja z dostępnej nagrody — klawiatura Enter, wybrany gratis i zamówienie zerowe; desktopowe kliknięcie i mobilny dotyk). Kontrola braku panelu dla nagród zarezerwowanych, wygasłych i produktu spoza nagrody: PASS na buildzie 1440; zamówienie zerowe: osobny build-test PASS 1440/390, również z nagrodą pobraną z kolejnej strony. Wstępny wieloscenariuszowy przebieg na buildzie zatrzymywał się niestabilnie podczas przygotowania strony/sesji, więc nie jest raportowany jako pełny PASS. Nie wykonano pełnego zestawu testów repozytorium, realnego zamówienia ani rzeczywistej płatności klienta.

Po aktualizacji lokalnej strony wykonać pełne odświeżenie (Ctrl+F5), aby usunąć stare natywne nasłuchy zachowane w DOM podczas hot reloadu. Można następnie przejść checkout bez wyboru gratisu. Liczba pieczątek nie jest wymagana do zwykłego zakupu.
