# Pakiet do oceny: prywatność i cookies webshopu

AKTUALIZACJA draft-0.4: tabele PL/FR/NL, inwentaryzacja i manifest zostały odświeżone po ograniczeniu storage. Limit 12h od zapisu nie rozstrzyga niezbędności. DEC-08 i pozostałe ustalenia pozostają otwarte. Krótka lista pytań: 07-pytania-do-zatwierdzenia-PL.md. Patrz także ../browser-storage.md.

PROJEKT DO WERYFIKACJI — NIE PUBLIKOWAĆ przed zamknięciem wskazanych braków.
Data analizy i źródeł: 27.10.2026. Wersja dokumentów: draft-0.4.
Zakres: https://webshop.atelierby.be, rynek belgijski, interfejs FR/NL/PL.

Najnowsze ustalenia: 09-retencja-i-domkniecie-PL.md. Wycofano robocze 15 lat i ogólne twierdzenie o pełnym automatycznym usuwaniu. Narzędzie czyszczenia resetów jest przygotowane lokalnie, ale nie jest aktywne na serwerze. Polityki FR/NL/PL nadal są projektami.

Nowe ustalenia: 10-konto-i-rankingi-PL.md. Dodano tylko raport kandydatów do przeglądu po pięciu latach; brak automatycznego zamykania/usuwania kont.

## Jak czytać

1. Najpierw przeczytaj 01-decyzje-i-ryzyka-PL.md i 02-odpowiedzialnosc-PL.md.
2. Oceń polityka-prywatnosci-PL.md i polityka-cookies-PL.md.
3. Wersje FR/NL mają ten sam zakres oraz te same identyfikatory DEC. Nie są tłumaczeniem przysięgłym; przed publikacją sprawdzić terminologię z prawnikiem i osobą biegle władającą danym językiem.
4. inwentaryzacja.csv i 03-dowody-z-kodu-PL.md pokazują fakty techniczne, a nie obserwację produkcji.
5. 04-zrodla-i-weryfikacja-PL.md opisuje źródła oraz granice audytu. 05-teksty-interfejsu.md zawiera propozycje warstwy informacyjnej po zamknięciu braków.

## Co jest ustalone

- Właściciel sieci: ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ, NIP 8971903536, ul. Stanisława Leszczyńskiego 4/29, 50-078 Wrocław, Polska.
- Użytkownik wskazał webshop@atelierby.be jako właściwy, działający kontakt. Nie wykonywano próby dostarczenia wiadomości ani kontroli organizacji obsługi zgłoszeń.
- Sprzedawcami są osobni franczyzobiorcy. ASIMA decyduje o wspólnych kampaniach i ma dostęp do zamówień. To nie rozstrzyga automatycznie ról prawnych we wszystkich procesach.
- W analizowanej, niezacommitowanej implementacji opcjonalna analityka jest wyłączona: ID GA4 puste, status konfiguracji draft. Ads i Meta wyłączone; kontener GTM usunięty z objętych zmianą stron.
- Wybór zgody/odmowy: sześć miesięcy. Działające konta, płatności i zamówienia są odrębnymi procesami od opcjonalnej analityki.

## Ważne wnioski

Sama polityka nie naprawi retencji ani klasyfikacji storage. Profil i preferencje są w sesji karty do 12h od zapisu; dane transakcyjne i publiczny precache wymagają osobnej oceny. Refresh token po stronie API ma ważność 90 dni odnawianą przy rotacji. Ich kwalifikacja i retencja wymagają rozstrzygnięcia DEC-08, ewentualnie zmiany kodu.

Nie ustalono jeszcze tożsamości wszystkich sprzedawców i usługodawców, umów, retencji serwerowej, konfiguracji Google i Stripe ani mechanizmów transferów. Polityki celowo zawierają znaczniki DEC zamiast fikcyjnych danych. Nie stanowią potwierdzenia zgodności ani zgody na publikację.

## Granica wykonanych prac

Przeprowadzono analizę kodu i źródeł publicznych. Nie odczytywano .env/sekretów, danych klientów, produkcji ani kont usługodawców. Przy draft-0.2 dodano podgląd stron i informację o wycofaniu w banerze oraz uaktualniono dokumenty po ograniczeniu storage. Nie ustawiono flag ready, publicznych URL polityk ani aktywnej analityki. Niczego nie wdrożono.
