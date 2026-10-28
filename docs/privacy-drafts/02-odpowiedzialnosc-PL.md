# Robocza matryca odpowiedzialności

PROJEKT DO WERYFIKACJI — NIE PUBLIKOWAĆ. Warianty w tej tabeli nie są ustaleniem ról prawnych ani treścią uzgodnienia z art. 26 RODO. Zbadać rzeczywisty podział decyzji i umowy (DEC-02).

| Proces | Fakt | Kierunek analizy, nie ostateczna rola | Co ustalić |
| --- | --- | --- | --- |
| Konto wspólnej platformy | Kod obsługuje profil, logowanie i kontekst sklepów/biur | ASIMA jako administrator własnego celu platformowego lub określony zakres wspólnych decyzji ze sprzedawcami | Kto ustala obowiązkowe pola, czas życia konta, wspólną identyfikację i uprawnienia sklepów |
| Zamówienie i odbiór/dostawa | Sprzedawcą jest wybrany franczyzobiorca; w bazie są zapisane kontakty i snapshoty zamówienia | Sprzedawca zwykle analizowany jako administrator realizacji sprzedaży; rola ASIMA zależy od jej własnych celów i instrukcji | Czy ASIMA tylko przetwarza na zlecenie w danym zakresie, czy współdecyduje lub wykorzystuje dane do własnych celów |
| Wspólna analityka | Użytkownik potwierdził decyzje ASIMA o wspólnych kampaniach; GA4 jeszcze wyłączone | ASIMA jako kandydat na administratora tego celu; udział franczyzobiorców wymaga ustalenia | Kto wybiera zdarzenia, konto, odbiorców, retencję i zastosowania wyników |
| Faktury i księgowość | Kod obsługuje dane faktury; osobni sprzedawcy | Administrator właściwych obowiązków podatkowych musi odpowiadać faktycznemu wystawcy/odbiorcy | Czyje faktury, jakie prawo, retencja i dostęp centrali |
| Stripe Connect | Integracja posługuje się kontem połączonym sklepu; dane karty zbiera interfejs Stripe | Role sprzedawcy, platformy i odpowiednich podmiotów Stripe mogą się różnić zależnie od celu | Umowy i podmioty konta platformy/sprzedawcy, Link, antyfraud i obowiązki Stripe |
| E-mail/SMS | Kod ma wiadomości transakcyjne i SMSAPI dla resetu dostępu | Zleceniodawca komunikacji jako administrator; rola dostawcy według faktycznej usługi | Podmioty umowne, dostarczyciele, logi, treść, retencja i transfery |
| Dostawa B2B i zaproszenia | Występują biura, firmy, członkostwa i rozliczenie firmowe | Dodatkowo przeanalizować pracodawcę/administratorów biura jako źródło i/lub odrębnego administratora | Kto podaje dane pracownika, kto widzi jego zamówienia, informowanie z art. 14 i podstawa przetwarzania |
| Bezpieczeństwo i wsparcie | Tokeny, reset dostępu i dane techniczne | Zakres własnego celu bezpieczeństwa każdego podmiotu może być inny niż obsługa zamówienia | Dostęp, logi/IP, rozliczalność, retencja oraz obsługa żądań |

## Wybór modelu dla każdego zakresu

- Odrębni administratorzy: opisać własne cele, podstawy, ujawnienia i punkty kontaktu każdego podmiotu.
- Współadministratorzy: jeżeli faktycznie wspólnie określają cele i środki, uzgodnić obowiązki, realizację praw i informowanie; udostępnić istotę uzgodnienia. Samo wspólne narzędzie, dostęp lub korzyść gospodarcza nie rozstrzygają sprawy.
- Administrator–procesor: tylko w zakresie rzeczywistego działania na udokumentowane instrukcje, przy odpowiedniej umowie i kontroli podwykonawców. Własne cele ASIMA/dostawcy trzeba analizować odrębnie.

Kontakt webshop@atelierby.be może być wspólnym operacyjnym punktem odbioru, lecz nie zmienia ról ani nie wyłącza prawa kontaktu z właściwym administratorem. Nie jest automatycznie kontaktem IOD/DPO.

## Pytania do podpisania przez biznes

Kto jest stroną umowy konta? Czy sklep widzi klientów innych sklepów? Czy centrala może używać danych do nowych celów? Kto ustala retencję i zamyka konta? Kto prowadzi Google/Stripe/SMTP/SMS? Kto usuwa dane z bazy, kopii i u odbiorców? Jak biura i pracodawcy przekazują dane? Kto odpowiada na żądanie dotyczące kilku sklepów?
