# Webshop UI localisation — 2026-09-09

## Scope and implementation

Reviewed the Vite entry point (`src/main.jsx`) and its customer-facing components/API adapters, plus the standalone invitation registration and password-reset pages copied from `public/`.

The French, Dutch and Polish dictionaries now cover the previously hardcoded form labels, validation, password recovery, profile/company/office sections, promotions and gifts, checkout, delivery restrictions, stock notices, portion labels, accessible allergen descriptions and tooltips. Phone country names use `Intl.DisplayNames`; amounts and dates follow the selected locale. Existing backend identifiers and request payloads remain unchanged.

The main UI waits for its initial dictionary. Switching language waits for the requested dictionary and preserves the current language when loading fails. Explicit browser language choices take precedence over account defaults. Translation keys and parameters are retained for already displayed messages so language changes update them too.

API errors are mapped to customer messages at the display boundary. Known auth, checkout and cancellation codes have specific translations. Unmapped messages have a translated fallback and their original technical details are logged to the console. The diagnostic banner retains its source identifiers and exposes original details through `WSBug.list()`.

Standalone pages use the same runtime, emitted by Vite as `i18n-runtime.js`, and the same JSON dictionaries. Changing language on the password-reset page does not reload the page, lose the token or clear input values.

## Verification

- Node tests: dictionary key/parameter/emphasis parity, referenced literal keys, delayed/failed language loads, persistence, existing-message translation and API-error mapping; existing phone/catalogue tests retained.
- Chromium: FR/NL/PL registration labels and validation, phone country names, password recovery, changing language with a visible API login error, standalone pages and preservation of password-reset state. API responses were stubbed; no real account/order writes.
- Vite production build, including generated standalone runtime and PWA assets.
- Source audit of customer JSX text, string literals, templates and visible attributes. Remaining French source includes comments, phone-country metadata rendered via Intl, technical diagnostics and aliases for backend messages.

## Maintenance and limits

Edit `public/locales/fr.json`, `nl.json`, and `pl.json` together. JSON wording changes do not require rebuilding JavaScript; new code/keys and the emitted runtime do. Dictionary values are plain text with existing rich-text markers where appropriate. Never translate enum values, routes or product IDs.

Product/category descriptions, company and shop names, addresses, and custom marketing content remain supplied by the API. The UI does not invent translations for that content. Known portion/slot/payment labels are localised separately from these data.

Staff/admin pages, legacy design mockups and PHP mail templates are separate entry points, not part of the running Vite customer interface. They were not rewritten. Live registration, order placement, payment and email E2E tests were not performed as part of this localisation change.

Run unit tests with `node --test tests/*.test.mjs`. Run `tests/ui-i18n.cjs` with Playwright available on `NODE_PATH` and access to the local `webshop.tfbuddy.local` vhost. The browser test blocks non-local domains and stubs API calls.
