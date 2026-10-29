# Decyzje i ryzyka do zamknięcia

PROJEKT DO WERYFIKACJI — NIE PUBLIKOWAĆ. Każdy identyfikator DEC oznacza nierozstrzygniętą kwestię; dotyczy wszystkich trzech wersji językowych. Status na 27.10.2026: OTWARTE.

| ID | Potrzebna odpowiedź / dowód | Właściciel decyzji | Skutek |
| --- | --- | --- | --- |
| DEC-01 | Pełne dane każdego sprzedawcy: firma, adres, BCE/KBO, VAT, kontakt; jak wskazywany jest klientowi przed zamówieniem | Biznes / franczyzobiorcy | Blokuje publikację ostatecznej informacji o administratorach i sprzedawcy |
| DEC-02 | Kto dla każdego procesu decyduje o celach i istotnych środkach; zakres dostępu ASIMA, wspólne konta, umowy instrukcji lub uzgodnienie współadministracji | ASIMA + franczyzobiorcy + prawnik | Blokuje ostateczne przypisanie ról. Nie wpisywać ASIMA jako jedynego administratora ani wszystkich jako współadministratorów bez analizy |
| DEC-03 | Zatwierdzić podstawę prawną dla każdego celu, w tym dane pracowników B2B, bezpieczeństwo, kontakt i rabaty; wskazać obowiązki ustawowe i interesy/LIA | Prawnik / właściciele procesów | Proponowane podstawy w projektach są warunkowe |
| DEC-04 | Retencja kont, zamówień, faktur, maili/outbox, SMS/IP, logów, reklamacji i kopii zapasowych; konkretne okresy, punkt startowy i procedura usuwania | Biznes + księgowość + IT + prawnik | Blokuje publikację pustej tabeli retencji; TTL tokena nie jest retencją bazy |
| DEC-05 | Faktyczni dostawcy i usługi: hosting/DB/backup/SMTP/SMS, Stripe Connect/Link, Maps, walidacja VAT; umowy, role, lokalizacje, podwykonawcy | IT + właściciele umów | Kod pokazuje możliwości, nie aktywność każdej integracji. Uzupełnić odbiorców i przepływy |
| DEC-06 | Czy i dokąd występują transfery poza EOG; właściwy instrument, zakres, aktualny status certyfikacji jeśli stosowana, ocena i zabezpieczenia | Właściciele umów + prawnik | Nie deklarować „tylko UE” ani automatycznie DPF/SCC |
| DEC-07 | Właściciel i ID GA4, cel, retencja w usłudze, Google Signals, Enhanced measurement, Ads links; rzeczywiste cookies/requesty i wycofanie zgody | Biznes + IT + prawnik | Blokuje aktywację GA4 i ostateczny opis aktywnej analityki |
| DEC-08 | Każdy zapis lokalny (obecnie profil/preferencje/logowanie w sesji karty do 12h od zapisu): czy jest ściśle niezbędny dla wyraźnie żądanej funkcji, dlaczego taki czas, czy potrzebuje zgody/TTL/sesji/usunięcia | IT + prawnik | Blok techniczno-prawny. Dotyczy m.in. ws.lang, ws.customer, ws.activeShop, preferencji dostawy, zakładki konta, PWA i trwałego logowania. Nie naprawiać wyłącznie zmianą tekstu |
| DEC-09 | Czy wymagany/wyznaczony jest IOD/DPO; jeżeli tak — jego kontakt. Ustalić właściwość organów według faktycznej organizacji, nie samego adresu siedziby | Zarząd + prawnik | Nie przedstawiać zwykłej skrzynki jako DPO. Prawo skargi do APD/GBA pozostaje opisane |
| DEC-10 | Obsługa praw: odbiór i przekazywanie zgłoszeń, weryfikacja tożsamości, usuwanie/eksport, terminy; wystarczalność dowodów zgody i archiwum wersji | ASIMA + franczyzobiorcy + prawnik | Brak centralnego logu nie przesądza automatycznie o niezgodności, ale trzeba umieć wykazać zgodę i działanie mechanizmu |
| DEC-11 | Dane pośrednie B2B, zaproszenia, rachunek pracodawcy, lojalność/rabaty i pola uwag; czy faktycznie występują dane zdrowotne/profilowanie/istotne decyzje automatyczne | Biznes + prawnik | Art. 6 ust. 1 lit. b nie pokrywa automatycznie danych pracownika, który nie jest stroną umowy. Potencjalnych danych szczególnych kategorii nie pokrywa sam art. 6 |
| DEC-12 | Finalny zakres publikowanych stron, base path, cookies infrastruktury i Stripe, nagłówki/cache, stara PWA; kompletność tłumaczeń, tożsamość administratora i prawo wycofania w pierwszej warstwie banera oraz spójność dat/wersji | IT + właściciel publikacji | Lokalny test na atrapach nie dowodzi stanu produkcji. Landing i legacy wymagają osobnego potwierdzenia zakresu |

## Co zrobić kolejno

1. Zebrać listę sprzedawców, umowy z dostawcami i opis dostępu do danych (DEC-01/02/05).
2. Ustalić cel, podstawę i retencję każdego procesu, w tym storage i B2B (DEC-03/04/08/11).
3. Sprawdzić transfery, kontakty i obsługę praw (DEC-06/09/10).
4. Uzgodnić, czy GA4 ma pozostać wyłączone czy ma być uruchomione. Dopiero potem zweryfikować konto i prawdziwe żądania (DEC-07).
5. Poprawić kod tam, gdzie retencja/klasyfikacja nie odpowiada uzgodnionemu modelowi; nie pisać polityki wbrew kodowi.
6. Zaktualizować wszystkie języki, usunąć znaczniki DEC dopiero po ich faktycznym zamknięciu i zatwierdzić wersję (DEC-12).

## Szczególne uwagi

- Polskie ASIMA i belgijski klient nie oznaczają same w sobie transferu poza EOG; dostawcy mogą jednak powodować takie transfery.
- W dokumentacji Stripe obowiązującej 27.10.2026 wskazano różne role zależnie od usługi i zapowiedziano zmianę polityki na 20.11.2026. Sprawdzić ponownie, jeśli publikacja nastąpi po tej dacie.
- Lista czyszczonych cookies w kodzie nie jest listą cookies faktycznie tworzonych. _gid/_gat/_gcl/_fbp/_fbc mogą dotyczyć pozostałości wcześniejszych wersji.
- Zwolnienie dla niezbędnych technologii nie obejmuje automatycznie całego localStorage ani wszystkich mechanizmów Stripe.
