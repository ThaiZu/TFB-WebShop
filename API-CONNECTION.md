# Połączenie webshopu z centralnym API

Webshop wywołuje bezpośrednio istniejącą aplikację `api`, wspólną dla admin,
panel i pozostałych aplikacji. Adres ustawia osoba wdrażająca aplikację przez
`VITE_API_BASE_URL`. Nie jest to ustawienie dostępne w interfejsie sklepu.

## Development

Lokalny compose `/home/szymon/projects/compose/docker-compose.webshop.yml`
uruchamia Vite z ustawieniami:

```sh
SITE_BASE=/ VITE_API_BASE_URL=https://tfb.tfbuddy.local/api/v1 npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Frontend jest dostępny pod `https://webshop.tfbuddy.local`.
Zmiany kodu obsługuje Vite; zmiana zmiennej w compose wymaga odtworzenia
kontenera Vite. Routing API spod domeny webshopu został usunięty.
Kontener legacy PHP nie jest wystawiony przez Traefik.

## Build produkcyjny

Po zainstalowaniu zależności przez `npm ci`:

```sh
SITE_BASE=/ VITE_API_BASE_URL=https://atelierby.tfbuddy.com/api/v1 npm run build
```

Należy opublikować cały katalog `dist`, w tym `api-runtime-config.js`,
na serwerze statycznym dla `https://webshop.atelierby.be`.
Strony zaproszenia i resetowania hasła korzystają z tego wygenerowanego pliku;
aplikacja React otrzymuje ten sam adres podczas kompilacji.
Zmiana adresu API wymaga nowego buildu. Również automatyzacja wdrożenia musi
przekazać tę zmienną; brak lub nieprawidłowy adres zatrzyma start/build.

Adres jest publiczny i nie może zawierać sekretów. Musi być pełnym adresem
HTTP(S) zakończonym `/api/v1`, bez danych logowania, parametrów i fragmentu.

### Reverse proxy wymagany w produkcji

`webshop.atelierby.be/api/v1/*` musi być przekazywane przez Traefik do usługi
API. Bez tego przeglądarka łączy się bezpośrednio z drugim hostem API, a nowe
wersje Chromium mogą wyświetlić prośbę o dostęp do lokalnych aplikacji i usług.

Gotowy fragment etykiet znajduje się w
[`deploy/traefik-same-origin-api.yml`](deploy/traefik-same-origin-api.yml).
Dodaj go do usługi webshopu i zachowaj wyższy priorytet routera API niż routera
obsługującego całą domenę webshopu. Usługa `tfb@docker` jest istniejącą usługą
API w bieżącej konfiguracji Traefik; jeżeli na produkcji ma inną nazwę, podmień
wyłącznie jej nazwę w ostatniej etykiecie.

**Dopiero po potwierdzeniu, że `https://webshop.atelierby.be/api/v1/shops`
zwraca `200`, zbuduj frontend z poniższą dodatkową zmienną:**

```sh
SITE_BASE=/ VITE_API_BASE_URL=https://atelierby.tfbuddy.com/api/v1 \
  VITE_SAME_ORIGIN_API=1 npm run build
```

`VITE_API_BASE_URL` pozostaje rzeczywistym adresem API dla proxy Vite i walidacji
konfiguracji. `VITE_SAME_ORIGIN_API=1` zmienia wyłącznie adres używany przez
przeglądarkę na `/api/v1`.

## CORS i zakres zmian

API musi zezwalać na origin frontendu. Istniejące reguły dopuszczają lokalną
domenę; w kodzie API dodano dokładny origin `https://webshop.atelierby.be`.
Zmiany kodu API trzeba wdrożyć razem z uruchomieniem sklepu na produkcji.
Nie wykonywano wdrożenia ani zapytań do produkcyjnego API.

Ta konfiguracja wybiera serwer API. Nie dostosowuje jeszcze kontraktów
endpointów odziedziczonych po `WebShop/php-api`. Obsługa katalogu, logowania,
koszyka i zamówień wymaga osobnej weryfikacji i migracji do centralnego API;
odpowiedzi 404 dla brakujących endpointów nie oznaczają błędu konfiguracji URL.
Nie jest potrzebna lokalna konfiguracja bazy danych dla webshopu.

## Domeny produkcyjne .be

Adres główny: `https://webshop.atelierby.be`.
Alias: `https://www.webshop.atelierby.be` — przekierowanie 301/308 na adres główny
z zachowaniem ścieżki i query string (ważne dla zaproszeń i powrotów Stripe).
Oba hosty wymagają DNS i certyfikatu TLS; certyfikat dla `*.atelierby.be` sam
nie obejmuje zagnieżdżonej nazwy `www.webshop.atelierby.be`.
API dopuszcza oba dokładne originy HTTPS. Ustawienia URL sklepu dla zaproszeń
i powrotów płatności powinny wskazywać adres główny bez `www`.
Adres API i parametr buildu `SITE_BASE=/` pozostają bez zmian.
