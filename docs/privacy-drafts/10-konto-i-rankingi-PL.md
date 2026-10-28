# Wspólne konto, przegląd po pięciu latach i rankingi — aktualizacja

Stan 28.10.2026, draft-0.4. Materiał roboczy, nie zatwierdzenie publikacji.

## Przyjęte decyzje

- ASIMA roboczo ustala zasady wspólnego konta klienta. To aktualizuje wcześniejsze
  „nie”; ostateczny podział ról prawnych wymaga zatwierdzenia i odpowiednich ustaleń.
- Franczyzobiorca odpowiada za własne zamówienia, reklamacje i rozliczenia.
- Po pięciu latach nieaktywności konto podlega przeglądowi. To nie oznacza zgody na
  automatyczne usunięcie konta i całej historii sprzedaży.
- Przy zamknięciu konta usuwać dane zbędne pozostałym uzasadnionym celom. Nie
  wdrożono tutaj samoobsługowego zamknięcia ani zbiorczego DELETE klientów.
- Pięć lat dla dokumentów sprzedaży i reklamacji jest propozycją biznesową,
  wymagającą potwierdzenia księgowości, początku biegu i wyjątków dla otwartych spraw.
- Sześć miesięcy logów jest świadomą decyzją użytkownika, a trzy miesiące kopii OVH
  potwierdzono deklaracją. Nie sprawdzono panelu OVH ani całej konfiguracji rotacji.
- Skrzynkę i obsługę praw zapewnia pracownik ASIMA; odpowiedzialność przypisać
  wewnętrznie, bez konieczności publikowania imiennej listy personelu.

## Raport przeglądu kont — gotowy lokalnie

Nowe pliki API:
- app/Services/Privacy/WebshopAccountReview.php
- scripts/review-webshop-accounts.php
- docs/webshop/account-review.md

Narzędzie jest wyłącznie odczytowe i nie ma opcji --execute. Korzysta z istniejącej
bazy i nie wymaga nowej kolumny aktywności. Nie odtworzy historii, której wcześniej
nie zapisywano. Dane do sprawdzenia obejmują: ostatnie logowanie, utworzenie i
ważność sesji oraz utworzenie/realizację zamówienia webshopu.

Klasyfikacja:
- recent_evidence: znany ślad w ostatnich pięciu latach lub aktywna sesja;
- unknown: brak wiarygodnej daty logowania i brak nowszych śladów;
- invalid_clock: data logowania w przyszłości;
- review_candidate: starsze logowanie bez znalezionego nowszego śladu.

Dokładną granicę pięciu lat traktujemy ostrożnie jako nowszy ślad. Brak daty nie
jest dowodem pięcioletniej nieaktywności. Inne aplikacje, POS i importy mogą mieć
ślady poza tym raportem — kandydat wymaga oceny przed zamknięciem konta.

Raport działa partiami do 1000 kont, z kursorem ID. Zwykłe wyjście pokazuje tylko
zbiorcze wyniki. Opcjonalny raport z ID kandydatów zapisuje się do NOWEGO pliku
0600 w prywatnym katalogu poza aplikacją. Plik jest danymi osobowymi i trzeba go
usunąć po zakończeniu przeglądu. Bezpośredniego publicznego endpointu nie dodano.

Przykłady dla uprawnionego operatora na zweryfikowanym środowisku:

    php scripts/review-webshop-accounts.php --help
    php scripts/review-webshop-accounts.php --batch-size=500
    php scripts/review-webshop-accounts.php --output=/private/review-001.json

Katalog raportów musi istnieć i być dostępny tylko właścicielowi (np. 0700).
Kontynuację --after-id=N odczytać z prywatnego raportu; nie publikować plików w CI,
repozytorium lub katalogu serwowanym WWW. W tym zadaniu nie czytano bazy aplikacji.

## Co faktycznie pokazują rankingi

ShopInsightService przygotowuje benchmark z minimum trzema sklepami z danymi.
Odpowiedź wybiera agregaty i nie przekazuje pól kontaktowych klientów ani
rzeczywistych identyfikatorów innych sklepów w tym widoku. Test sprawdza, że nawet
jeśli źródło statystyk zawiera dodatkowy e-mail lub client_id, projekcja ich nie ujawnia.

Nie są to tylko kwoty: metryki obejmują obrót, liczbę transakcji, średni paragon
oraz średnią liczbę produktów. Liczba transakcji nie oznacza liczby unikalnych osób.
Nie certyfikujemy pełnej anonimowości z samego usunięcia identyfikatorów sklepu:
możliwość wnioskowania zależy od grupy, szczegółowości i dodatkowej wiedzy.

CampaignBriefStorage ma odrębny ranking kampanii zawierający shop_id, ilości,
cele, realizację i wzrost. Nie wykazano w tym zadaniu pełnego zakresu jego ekspozycji
poszczególnym rolom. Nie zmieniono kontraktów ani nie usunięto tych metryk w ciemno.
To osobny temat do doprecyzowania, jeżeli wymogiem jest wyłącznie ranking kwotowy.
Nie przenosimy opisu jednego widoku na wszystkie rankingi sieci.

## Weryfikacja i wydanie

Na sztucznych danych sprawdzono granicę pięciu lat, puste i przyszłe daty, sesje,
zamówienia, kursor, pomijanie gości oraz brak mutacji. Oddzielny test sprawdza
projekcję benchmarku. Regresja czyszczenia resetów: 21 kontroli MySQL. Test kontraktu
prywatności: 17 kontroli. Sprawdzono składnię PHP, pomoc CLI i odrzucenie --execute.

Webshop: pełne testy jednostkowe (25 plików) i build podglądu. Testy stron PL/FR/NL
na 1440/390 px stanowią dodatkową kontrolę renderowania, nie test produkcji.
Nie uruchamiano pełnej regresji API/MySQL wszystkich procesów, live GA4/Stripe,
serwera produkcyjnego ani samego raportu na bazie aplikacji. Nowe testy są dopisane
do CI, ale GitHub CI nie zostało uruchomione. Brak commita, push i wdrożenia.

Potwierdzenie użytkownika o uruchomieniu poprzedniego porządkowania resetów
pozostaje deklaracją operatora; nie wskazano jeszcze środowiska, częstotliwości ani
zbiorczego wyniku. Nie oznacza uruchomienia tego nowego raportu lub pełnej retencji.

## Do finalizacji

1. Uzupełnić G-… w API WebshopPrivacyConfig.php, sprawdzić konfigurację usługi i
   rzeczywiste żądania. Nie trzeba czekać z pozostałą implementacją.
2. Księgowość potwierdza dokumenty sprzedaży/reklamacje: właściwy okres, start i
   wyjątki. Wybór pięciu lat nie jest sam w sobie weryfikacją obowiązku prawnego.
3. Potwierdzić właściwy podział ról i wymagane ustalenia ASIMA/franczyzobiorców,
   dane sprzedawców i odbiorców, zatwierdzić FR/NL/PL oraz realne URL polityk.
4. Operator testuje raport i narzędzia na środowisku testowym, potwierdza rotację
   logów/kopii, wykonuje kontrolę Stripe/GA4, a potem przeprowadza osobne wydanie.

Status konfiguracji nadal draft. Nie ma jeszcze podstaw do deklaracji gotowości
produkcyjnej wyłącznie na podstawie ukończenia kodu raportu.
