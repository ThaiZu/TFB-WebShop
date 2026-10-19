# Tłumaczenia interfejsu webshopu

Źródłem są `fr.json`, `nl.json` i `pl.json`: płaskie obiekty `klucz: tekst`.
Przeniesiono po 414 kluczy z migracji `0086`–`0114` dotyczących i18n,
z zachowaniem INSERT IGNORE oraz aktualizacji z migracji 0088.
Nie odczytywano bazy: ewentualne późniejsze poprawki wykonane tylko w bazie
nie są zawarte w tych plikach.

Francuski jest ładowany jako fallback, niderlandzki lub polski przy jego wyborze lub
ustawieniu w profilu/butiku. Każdy język jest pobierany raz na otwarcie strony;
kolejne otwarcie/odświeżenie pobiera aktualny plik z `cache: no-store`.
JSON nie jest objęty obecną konfiguracją precache service workera.
Żaden z tych odczytów nie wywołuje API ani bazy danych.

W development edytuj pliki w `public/locales/` i odśwież stronę.
W produkcji podmień `locales/fr.json` lub `locales/nl.json` w katalogu
publikowanego sklepu. Nie wymaga to buildu ani restartu kontenera.
Zachowaj również zmiany w repozytorium, żeby następne wdrożenie ich nie nadpisało.
Jeżeli serwer/CDN wymusza własny cache, wyłącz go dla tej ścieżki lub wyczyść
przy podmianie plików. Wdrożenie samego nowego loadera wymaga jednorazowego buildu.

Zachowuj klucze i parametry, np. `{amount}`. Nowy język wymaga także zmiany
listy obsługiwanych języków i loadera w `webshop-i18n.jsx` oraz buildu.
Nie ma edytowalnego przez klienta ustawienia adresu źródła.

Obecny podział obejmuje cały interfejs sklepu, ponieważ wiele widoków to
modale na jednej stronie. Nie ma jeszcze ładowania słowników per widok.
Nazwy produktów i kategorii pozostają danymi API.

Test ręczny: odśwież stronę, przełącz FR/NL i otwórz koszyk oraz konto.
W Network powinny być żądania `locales/*.json`, bez `/api/v1/i18n`.
Podmień jeden tekst w JSON i odśwież stronę: nowa treść powinna być widoczna.

Polski jest dostępny w przełączniku PL. Słownik PL zawiera wszystkie bieżące
klucze FR/NL, a wybór języka jest zapamiętywany w przeglądarce. Sklep może
ustawić język początkowy, lecz lista języków katalogu nie ogranicza języków
lokalnego interfejsu. API otrzymuje lang_code=pl; brak polskiego aliasu produktu
lub kategorii oznacza wyświetlenie nazwy źródłowej zgodnie z zachowaniem API.
Starsze widoki nadal zawierają teksty wpisane bezpośrednio w JSX/HTML, poza
słownikami. Dodanie PL nie jest pełną migracją tych tekstów do i18n.
