# Źródła i granice weryfikacji

Materiał wewnętrzny. Dostęp/sprawdzenie: 27.10.2026. Nie jest opinią o pełnej zgodności prawnej ani analizą wszystkich obowiązków sprzedaży żywności, konsumenckich, księgowych lub podatkowych.

| Źródło pierwotne | Zastosowanie i ograniczenie |
| --- | --- |
| [RODO, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) | Informowanie, prawa, cele/podstawy, rozliczalność, role i transfery. Weryfikacja na podstawie dostępnego tekstu EUR-Lex; nie wyciągano okresów podatkowych z samego RODO |
| [EDPB 07/2020, wersja finalna](https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf) | Wersja 2.1; kwalifikację ról oprzeć na realnym wpływie na cele i środki, nie wyłącznie na nazwie umowy lub dostępie |
| [APD/GBA — cookies i traceurs](https://www.autoriteprotectiondonnees.be/professionnel/themes/internet/cookies) | Obejmuje również localStorage; wąskie zwolnienia dla ściśle niezbędnych. Strona wskazuje własną datę aktualizacji 17.11.2023; odczytana aktualnie |
| [APD/GBA — check-list cookies](https://autoriteprotectiondonnees.be/publications/checklist-cookies.pdf) | Odczytano bieżący plik czterostronicowy. Pierwsza warstwa, odmowa, wycofanie i archiwizacja. Sześć miesięcy przedstawiane jest jako co do zasady rozsądny okres preferencji, nie uniwersalny czas retencji wszystkich danych. Materiał pomocniczy, niewyczerpujący |
| [APD/GBA — kontakt](https://www.autoriteprotectiondonnees.be/citoyen/agir/contact) | Punkt odniesienia dla belgijskiego organu; nie rozstrzyga organu wiodącego ASIMA ani wyłącznej właściwości |
| [Google — cookies GA4](https://support.google.com/analytics/answer/11397207?hl=en) | Oczekiwane nazwy _ga/_ga_*. Domyślne czasy dostawcy nie są czasami naszej konfiguracji; rzeczywisty wynik trzeba przetestować |
| [Google — retencja](https://support.google.com/analytics/answer/7667196?hl=en) | Ustawienia danych zdarzeniowych/użytkownika różnią się od retencji standardowych raportów zbiorczych i cookies. Nie wpisano fikcyjnej wartości konta |
| [Stripe — polityka](https://stripe.com/privacy) | Odczytana wersja z datą 28.04.2026; strona zapowiada zmianę 20.11.2026. Konieczna ponowna kontrola przy późniejszej publikacji |
| [Stripe — Privacy Center](https://stripe.com/gb/legal/privacy-center) | Podmioty i role zależą od regionu/usługi/celu; nie przypisano automatycznie całej relacji jednemu podmiotowi lub jednej roli |

W checkliście APD wskazano art. 10/2 belgijskiej ustawy z 30.07.2018. Krajową podstawę przywołano poprzez źródło organu; nie uzyskano tutaj pełnej, niezależnie zweryfikowanej konsolidacji prawa belgijskiego. Prawnik powinien potwierdzić aktualne przepisy i ich zastosowanie. Próba otwarcia konsolidacji dyrektywy 2002/58/WE w EUR-Lex napotkała weryfikację JavaScript, dlatego nie oznaczono jej jako odczytanej w całości. Nie opierano projektów na przypadkowych blogach.

## Co sprawdzono i czego nie sprawdzono

Przeczytano bieżące pliki wskazane w manifeście oraz wybrane ścieżki kont, zamówień, wiadomości i integracji. Uwzględniono wyniki wcześniejszych lokalnych testów opisanych w dokumentacji implementacji; przy aktualizacji draft-0.2 uruchomiono testy jednostkowe i kontraktu API oraz przeglądarkowe podglądu stron, zgód i storage. Stripe i PWA były dodatkowo sprawdzone na lokalnych atrapach w poprzednim kroku. Nie są to testy produkcji ani rzeczywistych kont dostawców.

Nie sprawdzano produkcji, faktycznych cookies dostawców, umów, paneli Google/Stripe, logów z danymi klientów, sekretów, .env ani fizycznej lokalizacji baz/kopii. Brak zidentyfikowanego dostawcy lub procesu nie oznacza zapewnienia o jego nieistnieniu. Każda polityka ma 10 sekcji (prywatność) albo 6 sekcji (cookies), z tymi samymi otwartymi decyzjami w PL/FR/NL. Wersje językowe wymagają przeglądu merytorycznego; nie udawano certyfikacji tłumaczenia.

Załącznik biznesowy webshop-cookie-consent-EN-PL.pdf był materiałem pomocniczym. Jego twierdzenia o aktywnej produkcji, adresie IP i implementacji nie zastępują dowodów kodu ani decyzji prawnej.
