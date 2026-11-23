# Automatyczne wdrożenie Webshop TEST

Workflow `Deploy Webshop TEST` uruchamia się po pushu do `main` oraz ręcznie
dla tej gałęzi. Publikuje wynik Vite do `/opt/tfbuddy/apps/test-webshop/` na
VPS. Ten katalog jest już zamontowany w `test-webshop_app`. Konto SSH
potrzebuje prawa zapisu do katalogu i dostępnego polecenia `rsync`.

W GitHub w **Settings → Secrets and variables → Actions → Repository secrets**
ustaw dostęp SSH do VPS:

- `SSH_HOST` – host VPS.
- `SSH_USER` – użytkownik wdrożeniowy.
- `SSH_PRIVATE_KEY` – prywatny klucz konta wdrożeniowego.
- `SSH_KNOWN_HOSTS` – wpis hosta SSH zweryfikowany z administratorem VPS.

Domena to `https://test-webshop.tfbuddy.com`. Router Traefika dla `/api/v1`
musi wskazywać `test@docker`. Końcowy test porównuje stronę i konfigurację
API z przesłanym buildem i sprawdza JSON listy sklepów. Wygasły certyfikat
zablokuje końcowy test po wysłaniu buildu.

Osobny workflow `deploy-sftp.yml` również reaguje na push do `main`, jeśli
`DEPLOY_ENABLED=true`. Publikacja GitHub Pages ma własny workflow.
