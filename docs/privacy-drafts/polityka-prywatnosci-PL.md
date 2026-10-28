# Polityka prywatności — projekt PL

PROJEKT DO WERYFIKACJI — NIE PUBLIKOWAĆ przed zamknięciem DEC-01–DEC-12. Wersja draft-0.4, stan 28.10.2026. Znaczniki DEC są uwagami redakcyjnymi do usunięcia dopiero po rozstrzygnięciu. Dokument opisuje analizowaną wersję sklepu; przed publikacją trzeba potwierdzić zgodność z wdrożeniem.

## 1. Sklep, podmioty i kontakt

Ta informacja dotyczy https://webshop.atelierby.be, sklepu obsługującego rynek belgijski. Właścicielem sieci jest ASIMA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ, NIP 8971903536, ul. Stanisława Leszczyńskiego 4/29, 50-078 Wrocław, Polska. Kontakt dotyczący prywatności: webshop@atelierby.be.

Sprzedawcą jest osobny franczyzobiorca właściwy dla wybranego sklepu. [DEC-01: wstawić pełne dane sprzedawcy lub działający odnośnik do kompletnej listy oraz wskazać sprzedawcę konkretnego zamówienia]. ASIMA ma dostęp do zamówień i decyduje o wspólnych kampaniach. [DEC-02: wskazać administratora każdego celu oraz ewentualny zakres współadministracji/przetwarzania na zlecenie; jeżeli istnieje uzgodnienie współadministratorów — udostępnić jego istotę]. Nie oznacza to, że wszystkie podmioty pełnią tę samą rolę we wszystkich procesach.

[DEC-09: potwierdzić, czy wyznaczono lub należy wyznaczyć IOD/DPO; dodać jego kontakt tylko wtedy, gdy jest właściwy. Podany adres nie oznacza sam w sobie powołania IOD].

Informacje organizacyjne przekazane przez właściciela projektu: ASIMA decyduje o wykorzystaniu danych kont i celach analityki oraz analizuje sprzedaż dla poprawy produkcji; poszczególni sprzedawcy realizują własne zamówienia. Nie zawarto jeszcze umów dotyczących danych między ASIMA a franczyzobiorcami. To opis działania, nie zatwierdzony podział ról prawnych (DEC-02).

## 2. Dane i ich źródła

Zależnie od użytej funkcji przetwarzane są dane konta i kontaktu, dane uwierzytelnienia, wybrany sklep i język, produkty, ilości, opcje i uwagi do zamówienia, dane odbioru/dostawy, informacje firmy i faktury oraz dane o statusie płatności i zamówienia. Pola uwag nie powinny zawierać informacji wykraczających poza obsługę zamówienia. [DEC-11: ocenić ewentualne dane szczególnych kategorii i nie opierać ich przetwarzania wyłącznie na art. 6 RODO].

Dane pochodzą od Ciebie i Twoich działań w sklepie. W procesach biurowych mogą także pochodzić od osoby zarządzającej biurem lub firmy: np. zaproszenia, członkostwo, adres dostawy i sposób rozliczenia. [DEC-11: ustalić konkretne źródła, zakres widoczności danych i sposób przekazania informacji osobom, które nie podały danych bezpośrednio].

Podczas korzystania z usług powstają również informacje techniczne, takie jak adres IP, czas żądania, dane przeglądarki i logi bezpieczeństwa. [DEC-05: potwierdzić rzeczywisty zakres po stronie serwera i dostawców]. Dane karty podaje się w interfejsie Stripe; sklep obsługuje referencje, kwoty i statusy płatności. Szczegóły aktualnie działającej konfiguracji wymagają DEC-05.

## 3. Cele i podstawy — do zatwierdzenia

Poniższe przyporządkowanie jest propozycją dla DEC-03, a nie automatycznym przypisaniem jednej podstawy wszystkim podmiotom.

| Cel | Dane i proponowana podstawa |
| --- | --- |
| Konto i obsługa zamówienia | Dane konta, kontaktu, produktów i realizacji; art. 6 ust. 1 lit. b RODO, o ile przetwarzanie jest niezbędne do umowy z daną osobą lub działań na jej żądanie |
| Płatność i rozliczenia | Dane transakcji; odpowiednio wykonanie umowy i właściwe obowiązki prawne. [DEC-03: wskazać podmiot i konkretne obowiązki, w tym księgowe/podatkowe] |
| Wiadomości transakcyjne, wsparcie, odzyskiwanie dostępu | Dane kontaktu i zdarzeń; wykonanie żądanej usługi albo uzasadniony interes jej bezpiecznej obsługi. [DEC-03: rozdzielić te sytuacje] |
| Bezpieczeństwo i roszczenia | Dane techniczne i dokumentacja zdarzeń; proponowany uzasadniony interes ochrony usługi, przeciwdziałania nadużyciom i dochodzenia/obrony roszczeń; wymaga oceny niezbędności i równowagi |
| Dostawa/rozliczenie firmowe | Dane biura, pracownika i firmy; podstawa zależy od tego, kto jest stroną umowy. Nie stosować automatycznie art. 6 ust. 1 lit. b do każdego pracownika; rozstrzygnąć DEC-03/11 |
| Opcjonalna analityka | Zgoda na określony pomiar oraz wymagane technologie w przeglądarce; art. 6 ust. 1 lit. a RODO i właściwe przepisy dotyczące urządzenia końcowego |
| Rabaty i lojalność | Jeżeli dana funkcja jest udostępniona: dane zakupów i zasad oferty; potwierdzić cel, podstawę, zakres profilowania oraz retencję w DEC-03/11 |

## 4. Odbiorcy i dostawcy

Dane niezbędne do sprzedaży otrzymują właściwy sprzedawca i osoby uprawnione do obsługi zamówienia. Zakres dostępu ASIMA, pracowników sklepów, biur i firm trzeba określić zgodnie z DEC-02/11. Dostawcy techniczni mogą obsługiwać hosting, bazę i kopie danych, e-maile, SMS, płatności lub włączoną analitykę; dane mogą być udostępniane organom, jeżeli istnieje odpowiednia podstawa prawna.

[DEC-05: uzupełnić faktycznych usługodawców, podmioty umowne i zakresy. Kod zawiera Stripe, SMSAPI i warunkowe funkcje Maps/weryfikacji VAT; sama obecność funkcji nie dowodzi jej używania. Nie przedstawiać każdego dostawcy jako procesora dla wszystkich jego czynności]. Warunki Stripe mogą przewidywać różne role dla różnych celów. Aktualna polityka dostawcy: https://stripe.com/privacy.

Według informacji właściciela projektu OVH obsługuje hosting, bazę, pocztę i kopie. Właścicielem platformy Stripe jest ASIMA, sprzedawcy mają konta połączone. SMSAPI jest wskazanym dostawcą SMS. Dokładne podmioty umowne, regiony, zakresy i warunki pozostają do potwierdzenia (DEC-05/06).

## 5. Opcjonalna analityka

Google Analytics jest obecnie wyłączone w przygotowanej wersji. Planowany pomiar obejmuje wyświetlenie strony, obejrzenie produktu, dodanie do koszyka, rozpoczęcie zamówienia i potwierdzony zakup. Przyszłe uruchomienie wymaga informacji o właściwej usłudze i Twojej uprzedniej zgody.

Planowany zakres obejmuje identyfikatory produktów, ilości, dostępne ceny, wartość w EUR, numer transakcji oraz identyfikatory online i kontekst techniczny działania Google. Nie jest to deklaracja anonimowości. Własne zdarzenia sklepu są ograniczone tak, aby nie przekazywać kontaktów, notatek, tokenów ani parametrów URL. [DEC-07: zweryfikować rzeczywiste żądania Google, podmiot umowny, ustawienia i retencję; zaktualizować stan aktywacji przed publikacją]. Google Ads i Meta nie są aktywowane w tym zakresie.

Odmowa analityki nie blokuje zamówienia ani płatności. Zgodę można wycofać w „Ustawieniach cookies”. Wycofanie nie zmienia zgodności wcześniejszego przetwarzania z prawem i nie oznacza automatycznego usunięcia wcześniej zapisanych danych u odbiorców.

## 6. Transfery poza EOG

Przepływ pomiędzy Belgią a Polską sam w sobie nie jest transferem poza EOG. Korzystanie z międzynarodowych dostawców może jednak wiązać się z takim transferem lub dostępem. [DEC-06: podać rzeczywiste państwa/odbiorców, podstawę transferu i dostęp do informacji o zabezpieczeniach. Nie deklarować decyzji adekwatności, certyfikacji DPF ani standardowych klauzul umownych bez weryfikacji konkretnego odbiorcy i zakresu].

## 7. Przechowywanie

Aktualna decyzja robocza: ASIMA określa zasady wspólnego konta klienta; franczyzobiorcy samodzielnie realizują swoje zamówienia, reklamacje i rozliczenia. Po pięciu latach nieaktywności konto podlega przeglądowi potrzeby dalszego utrzymania, nie automatycznemu usunięciu wszystkich transakcji. Po zamknięciu konta należy usunąć dane zbędne do pozostałych uzasadnionych celów. Proponowane pięć lat dla dokumentów sprzedaży i reklamacji wymaga potwierdzenia przepisów, początku biegu oraz wyjątków dla otwartych spraw (DEC-02/04). Logi: przyjęto sześć miesięcy, a kopie według deklaracji użytkownika rotują po trzech miesiącach; faktyczny zakres logów, ustawienia i odtworzenie wymagają weryfikacji (DEC-04/05).

| Zakres | Okres lub kryterium wymagające uzupełnienia |
| --- | --- |
| Konto i profil | [DEC-04: okres aktywnego konta, kryteria nieaktywności, zamknięcia i niezbędnego dalszego przechowywania] |
| Zamówienia, faktury i reklamacje | [DEC-04: właściwe przepisy i okresy dla rzeczywistych sprzedawców; oddzielić realizację od archiwizacji i roszczeń] |
| E-maile, SMS, logi i kopie | [DEC-04/05: okres, punkt startowy, usuwanie i rotacja kopii u każdego odbiorcy] |
| Dane analityczne | [DEC-07: konkretne ustawienia i inne okresy mające zastosowanie do raportów/agregatów; nie utożsamiać ich z cookies] |
| Urządzenie klienta | Szczegóły w polityce cookies: profil, logowanie i preferencje w sesji karty do 12 godzin od zapisu; dane transakcyjne i cache wymagają odrębnej oceny DEC-08. Nie jest to termin usunięcia danych serwera. |

Ważność tokena, sesji lub zgody nie jest terminem usunięcia całego konta ani bazy zamówień. Przed publikacją należy zastąpić powyższe pola rzeczywistymi okresami lub zrozumiałymi kryteriami.

Nie ustalono ogólnej retencji 15 lat; wcześniejsza wartość była roboczą pomyłką. Automatyczne usuwanie jest częściowe. Przygotowano narzędzie usuwania wygasłych żądań resetu e-mail/SMS, ale nie jest jeszcze wdrożone ani uruchomione cyklicznie. Okres ważności kodu nie jest potwierdzeniem usunięcia rekordu. Kryteria dla kont, zamówień, faktur i korespondencji wymagają zatwierdzenia (DEC-04).

## 8. Obowiązkowość danych i automatyzacja

Niepodanie danych potrzebnych do określonej czynności może uniemożliwić jej wykonanie, np. dostawę, rozliczenie lub odzyskanie dostępu. [DEC-03/11: potwierdzić wymagane pola i to, które wynikają z prawa lub umowy]. Zgoda analityczna jest dobrowolna.

Reguły cenowe, promocje i obsługa bezpieczeństwa mogą działać automatycznie. [DEC-11: ustalić, czy występuje profilowanie lub decyzja wyłącznie automatyczna wywołująca skutki z art. 22 RODO; jeżeli tak, opisać logikę, znaczenie, konsekwencje i zabezpieczenia. Nie dopisywać zapewnienia, że takie decyzje nie istnieją, bez analizy].

## 9. Prawa i kontakt

Na warunkach przewidzianych w RODO możesz żądać dostępu, sprostowania, usunięcia lub ograniczenia przetwarzania, korzystać z przenoszenia danych i prawa sprzeciwu oraz wycofać zgodę. Napisz na webshop@atelierby.be, podając informacje pozwalające rozpoznać sprawę; nie przesyłaj hasła ani pełnych danych karty. W razie uzasadnionych wątpliwości możemy poprosić o proporcjonalne potwierdzenie tożsamości. Co do zasady odpowiedź następuje w miesiąc; dopuszczalne przedłużenie wymaga informacji i uzasadnienia. [DEC-10: wdrożyć obsługę i przekazywanie zgłoszeń do właściwego administratora].

Przysługuje Ci prawo skargi do właściwego organu nadzorczego, w szczególności belgijskiego APD/GBA: https://www.autoriteprotectiondonnees.be/citoyen/agir/contact. Możesz również skorzystać z organu właściwego dla miejsca zwykłego pobytu, pracy lub zarzucanego naruszenia.

## 10. Powiązane informacje i zmiany

Polityka cookies: [DEC-12: rzeczywisty odnośnik w tym języku]. Przy istotnej zmianie celu lub dostawcy wymagającej nowej zgody sklep ponownie poprosi o decyzję. [DEC-10/12: zatwierdzić procedurę informowania i zachować archiwalne wersje polityk oraz mechanizmu zgody].
