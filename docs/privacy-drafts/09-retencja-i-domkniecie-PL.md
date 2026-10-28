# Retencja i domknięcie wdrożenia — stan po przeglądzie

Stan 28.10.2026. Materiał wewnętrzny do decyzji i wydania, nie polityka do publikacji.

Najnowsze uzupełnienie: 10-konto-i-rankingi-PL.md. Pięć lat dla dokumentów sprzedaży/reklamacji jest propozycją; pięć lat nieaktywności oznacza przegląd konta. Projekty polityk: draft-0.4.

## Ustalenia wycofane i potwierdzone

Użytkownik wycofał wcześniejsze 15 lat jako faktycznie ustaloną retencję. Ten okres
był wpisany z braku wiedzy. Wycofano również ogólne potwierdzenie, że automatyczne
usuwanie działa dla wszystkich danych. Obecny stan: zasady niekompletne, usuwanie
częściowe. Nie stosujemy 15 lat jako domyślnego parametru, opisu klientowi ani
podstawy zbiorczego kasowania danych.

Deklaracje użytkownika, nie weryfikacja umów lub produkcji:

- ASIMA decyduje o wykorzystaniu kont i celach GA; analizuje sprzedaż dla poprawy
  produkcji. Sklepy realizują własne zamówienia. Nie ma umów dotyczących danych
  między ASIMA a franczyzobiorcami. Role wymagają oceny dla poszczególnych celów.
- Sprzedawcy i ich dane są według użytkownika aktualne w bazie/API. Nie odczytano
  bazy; nadal trzeba odróżnić adres sklepu od siedziby i sprawdzić kompletność.
- OVH: hosting/baza, poczta i kopie według deklaracji. Regiony i właściwe podmioty
  umowne pozostają nieustalone. SMSAPI: dostawca znany, właściciel konta niepodany.
- Platforma Stripe należy do ASIMA, sprzedawcy mają konta połączone.
- Sam Verheyden ma dostęp do GA i zatwierdzi polityki. Nie ma IOD. Kontakt praw
  klienta to webshop@atelierby.be; osoba/zespół obsługujący nadal nieokreślony.
- test.tfbuddy.com i Stripe test według deklaracji są dostępne; wdrażanie przez
  GitHub CI/CD, publikację wykonuje pracownik ASIMA. Nie połączono się z serwerami.

## 1. Co działa i co przygotowano

| Mechanizm | Stan potwierdzony w kodzie | Ograniczenie |
| --- | --- | --- |
| Profil/preferencje/logowanie w przeglądarce | Sesja karty, do 12h od zapisu; czyszczenie profilu/dostawy przy wylogowaniu | Przeglądarka może przywrócić sesję; kontrola przy odczycie/start/resume, nie kasowanie przy wyłączonej przeglądarce |
| Wybór cookies | 6 miesięcy kalendarzowych, wersja polityki, kontrola terminu | Nie usuwa zamówień ani całej historii u dostawców |
| Reset e-mail | Token ważny 1 godzinę według kodu | Nowe narzędzie usuwa rekord dopiero po expires_at |
| Reset SMS | Ważność 180 s; ochrona 60 s / 15 min | Nowe narzędzie usuwa tylko po wygaśnięciu i poza 15-minutowym oknem historii |
| Narzędzie resetów API | Gotowy CLI dry-run domyślnie; --execute jawnie; 1–1000 rekordów na tabelę, transakcja | Nie jest wdrożone ani zaplanowane. Brak efektu na produkcji do uruchomienia przez operatora |
| Snapshoty wyceny POS | Istnieje cleanup-automatic-promotion-quote-snapshots.php dla wygasłych niezużytych snapshotów | Nie potwierdzono działania harmonogramu; zużyte snapshoty pozostają |
| Rezerwacje bonów | Istnieje expire-voucher-reservations.php zmieniający stan rezerwacji | Wygaśnięcie stanu nie oznacza usunięcia historii |
| Aktywacja konta | Kod używa rekordów również do oczekującej aktywacji i ponownej wysyłki | Nie usuwać wyłącznie według expires_at bez przebudowy i testów tego procesu |
| Refresh tokeny | Ważność i unieważnianie zaimplementowane | Nie dodano usuwania rekordów rotacji bez oceny zależności i bezpieczeństwa |
| Dane kont/zamówień/faktur, logi i backup | Nie wykazano kompletnego automatu retencji dla całego zakresu | Nie deklarujemy ogólnie ani pełnego usuwania, ani tego, że nic nie jest usuwane |

Nowy kod: TFB-Api/app/Services/Privacy/WebshopAuthRetention.php i
scripts/cleanup-webshop-auth-data.php. Instrukcja operatora:
TFB-Api/docs/webshop/auth-retention.md. Migracja dodaje wyłącznie indeksy wygasania;
nie została wykonana na żadnej bazie aplikacji.

## 2. Propozycja zasad do zatwierdzenia

Poniższe reguły są projektem. Nie zamieniamy brakujących decyzji na fikcyjne lata.
Przy zatwierdzeniu należy wskazać właściciela procesu, początek okresu, termin lub
sprawdzalne kryterium końca i sposób egzekwowania. Potrzeby realizacji, obowiązki
ustawowe i roszczenia rozpatrywać oddzielnie.

| Dane | Proponowana reguła | Co zostało do rozstrzygnięcia/wykonania |
| --- | --- | --- |
| Konto/profil | Obsługa używanego konta; po zamknięciu usunąć dane niepotrzebne innym celom. Oddzielić minimalną historię transakcyjną | Kiedy konto uznajemy za nieaktywne; przegląd/ostrzeżenie/zamknięcie; zależności, wycofanie dostępu i wykonanie usunięcia |
| Zamówienia | Do realizacji i obsługi zamówienia; później ograniczony zakres dla obowiązków i roszczeń | Księgowość/prawnik: konkretne belgijskie okresy i początek biegu dla właściwego sprzedawcy; minimalizacja pól |
| Faktury | Wymagany zakres i okres wynikający z właściwego obowiązku | Potwierdzenie księgowości. Nie usuwać według okresu wygasania konta |
| Reklamacje | Obsługa sprawy i uzasadniony okres roszczeń | Termin, początek i ewentualna blokada usunięcia dla toczącej się sprawy |
| E-maile transakcyjne | Treść/dowód związany z konkretnym celem; techniczne logi wysyłki krócej, jeśli wystarczy | Oddzielne okresy outbox/sent/fail/logi/skrzynka/provider; retry nie może zostać przerwane |
| SMS | Dane resetu zgodnie z techniczną ważnością i limitowaniem; inne wiadomości według ich celu | Uruchomić nowe narzędzie. Osobno potwierdzić historię SMSAPI i ewentualne inne SMS |
| Logi | Okres konieczny do diagnostyki/bezpieczeństwa, ograniczone pola i dostęp | Wcześniejsze 6 miesięcy traktować jako propozycję wymagającą potwierdzenia; wskazać logi, rotację i wyjątki |
| Backup | Ograniczona rotacja; dane usunięte nie mogą wrócić do normalnego użycia po odtworzeniu | Wcześniejsze 3 miesiące zweryfikować w OVH. Opisać przywrócenie i ponowne zastosowanie żądań usunięcia |
| GA4 | Retencja odpowiednia do zatwierdzonego celu i ustawień usługi | ID G-…, ustawienia i rzeczywiste żądania; nie zakładać domyślnych wartości |

Nie ustawiono globalnego kasowania kont, zamówień, faktur lub wiadomości. Taka
operacja bez rozdzielenia powyższych celów mogłaby zniszczyć dane potrzebne do
realizacji zamówień, rozliczeń i ochrony roszczeń.

## 3. Prosta procedura obsługi praw

1. Rejestrować datę otrzymania żądania na webshop@atelierby.be, zakres i osobę
   odpowiedzialną; nie umieszczać danych klienta w publicznych zadaniach.
2. Ustalić właściwego administratora/sprzedawcę i przekazać sprawę uprawnionym osobom.
3. Potwierdzić tożsamość proporcjonalnie do ryzyka; nie żądać domyślnie skanu dowodu
   i nie traktować samej znajomości adresu e-mail jako wystarczającej dla każdej sprawy.
4. Ustalić zakres konta, zamówień, korespondencji i dostawców. Rozdzielić dane, które
   można usunąć, od tych, które muszą pozostać dla konkretnego obowiązku/roszczenia.
5. Uprawniony operator przygotowuje eksport/zmianę/usunięcie przez zweryfikowaną
   ścieżkę. Nie wykonywać zbiorczego DELETE klienta z pominięciem relacji/faktur.
6. Odpowiedzieć co do zasady w ciągu miesiąca; w razie dopuszczalnego przedłużenia
   powiadomić o przyczynie. Zachować minimalny dowód obsługi i kontrolować termin.
7. Przy przywróceniu backupu ponownie uwzględnić wcześniejsze usunięcia/ograniczenia.

To gotowy szkic operacyjny, nie potwierdzenie, że wyznaczono personel i uruchomiono
procedurę. Właściciel skrzynki i uprawniony operator muszą zostać wskazani przez ASIMA.

## 4. Instrukcja wdrożenia porządkowania resetów

- Najpierw wdrożenie testowe i indeksy; potem raport bez --execute.
- Sprawdzić liczbę kwalifikujących się rekordów oraz logowanie/reset/SMS throttling.
- Operator jawnie uruchamia --execute i sprawdza wynik; początkowy backlog czyści
  w ograniczonych partiach. Raport pokazuje partię, nie całą tabelę.
- Dopiero potem ustawić harmonogram, np. co 15 minut, oraz monitoring błędów
  i liczby rekordów. Przykład i ograniczenia w instrukcji API.
- Zatrzymanie harmonogramu wstrzymuje dalsze kasowanie; cofnięcie kodu nie odtwarza
  usuniętych rekordów. Nie wykonano tych czynności na test.tfbuddy.com ani produkcji.

## 5. Co blokuje końcową publikację

1. Sam: ID i konfiguracja rzeczywistego GA4 (retencja/Signals/Enhanced Measurement/
   Ads links, sposób osadzenia) oraz test zgody z prawdziwą usługą.
2. ASIMA/Sam i księgowość/prawnik: zatwierdzenie końcowych kryteriów retencji i ról
   ASIMA/franczyzobiorców, uregulowanie wymaganych relacji. Nie ma jeszcze umów; ASIMA jest roboczo wskazana jako ustalająca zasady wspólnego konta.
3. Operator: kompletne dane sprzedawców, potwierdzone usługi/regiony OVH i SMSAPI,
   działający harmonogram/logi/backups oraz test realnego Stripe i wdrożenia.
4. Po tych ustaleniach: usunąć placeholdery DEC, zatwierdzić FR/NL/PL, wpisać
   rzeczywiste HTTPS linki i potwierdzoną tożsamość. GA4 uruchomić dopiero po testach.

Reszta pracy technicznej w tym kroku jest przygotowana. Nie oznaczamy konfiguracji
jako ready i nie deklarujemy pełnej zgodności lub działającej retencji produkcyjnej.

## 6. Weryfikacja wykonanej pracy

- Jednorazowy MySQL 8 bez sieci zewnętrznej: 21 kontroli, w tym raport bez kasowania,
  limity, ważne tokeny, granica czasu, historia SMS, idempotencja, rollback i
  odrzucenie nietransakcyjnej tabeli. Indeksy sprawdzone na tabelach testowych.
- PHP: kontrola składni, --help i odrzucenie błędnej partii przed konfiguracją,
  17 kontroli kontraktu konfiguracji prywatności.
- Webshop: pełne npm run test:unit (25 plików), build podglądu oraz test sześciu
  stron PL/FR/NL i linków w Chromium przy 1440 i 390 px.
- Nie uruchomiono na bazie aplikacji ani na produkcji. Nie instalowano harmonogramu,
  nie testowano rzeczywistego GA4/Stripe/OVH i pełnej macierzy regresji API. Nowy
  workflow CI został dodany, ale nie uruchomiony na GitHubie; brak commita/push.
