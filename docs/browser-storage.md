# WebShop browser session — 2026-11-04

The browser refresh token is an opaque, rotating token stored in the host-only
`__Secure-ws_refresh` cookie. It is Secure, HttpOnly, SameSite=Lax, scoped to
`/api/v1/clients/auth`, and expires 60 days after login or successful rotation.
The corresponding server record has the same 60-day lifetime. Access JWTs keep
their existing 30-minute lifetime and remain in page memory. Profiles are fetched
from `/clients/auth/me` and are no longer persisted to browser storage.

## Transport and deployment

The browser opts in with `X-Webshop-Session: cookie` and application/json.
Login, refresh and logout require a trusted Origin and reject cross-site requests.
The browser response never exposes its refresh token in JSON. Other API clients
without that header keep the existing token-pair contract and 90-day refresh TTL.
Cookie authentication is used only for refresh/logout; ordinary API endpoints
continue requiring Authorization: Bearer. No database migration is needed.

Production must expose `/api/v1` on the WebShop hostname and build with
`VITE_SAME_ORIGIN_API=1`. The previous direct API connection between
`webshop.atelierby.be` and `atelierby.tfbuddy.com` is cross-site and cannot be used
for this Lax cookie flow. Use the existing proxy configuration described in
`../API-CONNECTION.md`. Deploy backend and frontend together; HTTPS is required.

## Startup, rotation and logout

Startup calls refresh even after the page/tab/browser was closed; the browser
attaches its cookie. A rejected refresh stops background retries for that page.
Network/server failures retain the possibility of recovery. Existing tab refresh
tokens are exchanged once for a cookie and then removed from sessionStorage.
Old permanent token/profile keys are still removed rather than migrated.

Cookie mutations are queued locally and use the Web Locks API across tabs where
available. BroadcastChannel invalidates account views after login/logout in
another tab. Server-side cookie rotation locks the old refresh-session row within
a transaction, so concurrent reuse cannot issue two replacement sessions.

Logout immediately clears the local account view, then revokes the refresh token
and expires the cookie. The non-secret `ws.auth.loggedOut` localStorage marker
prevents automatic login after reopening if logout was performed offline. It is
removed by a successful explicit login. Without working localStorage this offline
marker cannot survive a reload. Server revocation requires network connectivity.
Existing access JWTs retain their normal short expiry, as before.

## Shop and remaining preferences

`ws.activeShop` uses localStorage key `ws.preference.v1:ws.activeShop`, with an
explicit 60-day expiry from each write. A new visit/selection writes it again.
A `?shop=` link still takes precedence. Logout preserves the selected shop.
Only this preference and the non-secret logout marker become persistent.

Language, delivery preferences, account tab and PWA prompt markers retain their
12-hour tab-session envelopes. Customer profiles are memory-only. Existing
checkout/payment continuation records and cookie consent are unchanged.
Expired/corrupt entries are removed on access/startup/focus/pageshow; storage
failures fall back to page memory. Browser clearing/private browsing may remove
cookies and preferences earlier than their configured lifetime.

## Validation

- Node tests: cookie restoration, legacy migration, expiry, blocked storage,
  account isolation during delayed responses, offline logout and shop retention.
- PHPUnit: origin/header/JSON checks, cookie attributes, rejected refresh,
  legacy contract, server expiry and transactional token rotation.
- `npm run test:storage:browser`: local PHP/Chromium fixture with real Set-Cookie,
  close/reopen, concurrent tabs, logout and CSRF. No production connections.
- `npm run build`: production Vite/PWA bundle.

The existing full unit suite also has failures in menu-composition, office-context
and personalization tests (`Cannot use import statement outside a module`),
reproduced against the unchanged workspace. Those tests are outside this change.
Actual MySQL integration, live reverse proxy, payment-provider and deployed PWA
upgrade tests have not been run. Public storage disclosures must describe this
new retention when this implementation is published.


## Selected promotion baskets

Standard baskets containing a manually selected promotion survive a reload in
this tab using `WSSessionStorage` key `ws.promotionBasket` (the existing 12-hour
expiry). The saved shop must match the active shop. Removing the last selected
promotion or completing the order removes this record. Office carts are not
restored. Cached product labels and prices are display data only: a fresh API
quote is required before showing payable totals or enabling checkout.
