# Cookie consent implementation

Scope: storefront consent state and UI, not activation of Google/Meta services.
Target: https://webshop.atelierby.be, Belgian market. FR/NL/PL texts are drafts
pending legal approval. Do not publish as a completed compliance implementation.

## State and integration contract

`public/cookie-consent.js` runs synchronously before the application, exposes
`window.WSConsent`, and never loads third-party code. `ws.consent` in localStorage
contains version, policy, scope (`atelierby`), two independent booleans and timestamps.
Choices expire after six calendar months (UTC), equally for acceptance and rejection;
month-end dates clamp to the last day of the target month.
Invalid/expired records fail closed. Storage denial keeps an explicit choice only in
memory; the UI warns that it will not persist. Clearing storage or changing choice
in another same-origin tab updates subscribers and stops adapters. Each origin has
its own storage; no cross-domain consent sharing is implemented.

Use `get`, `allows`, `save`, `reject`, `subscribe`, `open`. An audited integration
can register `{category: 'analytics'|'advertising', start, stop, track}` via
`register(id, adapter)`. Start must cooperate with its abort signal; stop must be synchronous, idempotent and own cleanup,
and must prevent future network requests on revocation. Do not register adapters
that cannot actually stop. Start receives {signal, id, isAllowed}. Async loaders must check isAllowed() again
on completion and must not insert a script or send a request after cancellation.
Rejected asynchronous starts are handled; an unsuccessful stop latches the adapter
off until reload and exposes a UI warning. The module cannot stop arbitrary
third-party timers on its own; each real adapter still needs browser verification.
Do not put personal data, tokens or full page URLs into tracking payloads.
`webshop-analytics.js` maps view_item/add_to_cart/begin_checkout/purchase to the
analytics adapter only; no advertising adapter is registered. No events before consent are replayed.

GTM and Meta bootstrap tags, including noscript, have been removed from the storefront
and the B2B events landing. Only the direct GA4 adapter is registered; its empty API identifier and draft
configuration keep it disabled. Accepting a category does not activate unverified services. The B2B landing currently has no consent UI and no
optional tracking; a later integration must add equivalent controls before enabling
its trackers. Legacy webshop-full.html is not part of the tested Vite build.

## UI

Equal-style reject/settings/accept buttons. Options start unchecked, can be changed
through a persistent settings button. Closing/Escape does not grant or change consent.
The nonmodal dialog keeps shopping usable. `?cookies=1` reopens detailed settings.
No privacy-policy URLs are invented; reviewed policies and their links are required
before publication. Current footer button positioning needs browser/device review
against basket, payment and PWA overlays.

## Configuration decisions and outstanding publication work

Network owner: ASIMA sp. z o.o., NIP 8971903536, ul. Stanisława Leszczyńskiego 4/29,
50-078 Wrocław, Poland. User-designated working privacy contact: webshop@atelierby.be.
Individual franchisees are sellers. ASIMA determines shared campaigns and accesses
orders; controller/joint-controller roles require legal review. There is no public
claim here that ASIMA is the sole controller.

Still required for publication: approved notices and controller/seller roles;
verified GA4 identifier; GA4 property/retention review; actual-provider
network/cookie checks on a test environment. No central consent log was added:
choices and notice versions remain in the browser; legal review must confirm the
chosen evidence model. Login, customer and payment storage remains intact.

## Validation and repository state

Webshop is synchronized to main e95b913; API to master 151fdeb. Local consent changes
were reapplied with upstream promotion validation retained. A backup stash and patch
were kept before synchronization. No commit, push, deployment, production access or
migration was performed.

Use npm run test:unit, npm run test:consent:browser and npm run test:consent:stripe.
Playwright 1.57.0 is pinned. Run npx playwright install chromium, or specify
CHROMIUM_PATH for an installed browser. The new consent CI workflow installs Chromium
and runs these checks with fake APIs/Google/Stripe. The API workflow runs the public
contract and PHP syntax checks without a database.

## Public API configuration

The Vite entry asynchronously fetches `/api/v1/webshop/privacy-config` (using the
existing configured API base), omits credentials and cache, and aborts after 5s.
A failed request, invalid JSON or incompatible contract disables all registered
integrations. Local choice and checkout remain independent. The runtime requires
both a ready configuration with validated provider IDs and an explicit category
consent. Adapter IDs are ga4, googleAds and meta; category must match the provider.
The GA4 adapter is registered but disabled without a verified identifier. Draft API responses cannot activate
tracking even after acceptance. Policy links must be HTTPS and are rendered only
for the active language when actually configured. A response cannot alter the
fixed six-month/basic/scope contract: mismatches fail closed. A valid new policy
version requires a fresh choice before any integration can restart.

API settings are currently versioned in code, not persisted by a settings editor.
Tests: `node tests/privacy-config.test.mjs` covers transport/JSON/contract failures;
`node tests/cookie-consent.test.mjs` also verifies configuration gates, revocation,
policy mismatches and URL sanitization.

## Withdrawal and cookie cleanup

Revocation first aborts the loader and stops the relevant adapter. Its tracking
channel is disabled before stop() is called. Changed measurement identity restarts
only after aborting the previous loader. A failed stop marks reloadRequired and
prevents restart until reload; UI does not force a reload during checkout.

Only visible known optional first-party cookies are expired: _ga, _ga_*, _gid,
_gat/_gat_*, _gcl_au/aw/dc/gs/gb and _fbp/_fbc (provider-specific). Cleanup tries
host-only/current host/atelierby.be (only within that domain), root and current
path ancestors. It runs for refused categories and configured disabled providers.
No storage.clear(), authentication-cookie deletion or payment-storage deletion is
used. Expiry/new policy removes only ws.consent. Rejecting stores a six-month
negative choice rather than repeatedly prompting the user.

HttpOnly, third-party and cookies hidden under other paths are outside this cleanup.
No claim of complete removal is made. Audited adapters must declare any additional
identifiers and cleanup. Visible cleanup failure produces a browser-settings hint;
manual deletion of all site data also logs users out, which the hint discloses.
Cross-tab synchronization accepts only localStorage events; tabs still running an
older policy fail closed until refreshed. Brand scope remains atelierby only; shop
changes within this network do not invalidate a network-level choice. Another
brand requires a separate server scope model and consent isolation.

## Production-build browser regression harness

Build against the intercepted test API (never a production API):

```
VITE_API_BASE_URL=https://api.tfbuddy.local/api/v1 npm run build
node tests/ui-cookie-consent.cjs
CHROMIUM_PATH=/usr/bin/chromium STRIPE_STATIC_BUILD="$PWD/dist" node tests/ui-stripe-embedded.cjs
```

Playwright is a pinned dev dependency installed by npm ci. All browser tests accept
CHROMIUM_PATH, otherwise they use the Playwright-installed Chromium. Both static-build scenarios block service workers and
intercept API calls and assets. Stripe.js is an in-memory fixture; no payment or
order reaches a real system. A separate real-service-worker localhost test covers PWA/offline and migration;
real hosting headers and deployment behavior still require release verification.

The cookie scenario covers desktop/mobile, dismissal without consent, all/partial
choices, persistence, cross-tab rejection, visible first-party cookie removal,
preserved essential storage, adding a product after refusal, FR/NL/PL, policy
change, API failure, no optional external requests and horizontal overflow.
The Stripe scenario exercises refusal, pending-quote blocking, order creation,
embedded payment, form teardown, return-URL recovery and server-confirmed status.

Browser checks found a mobile collision between the persistent cookie-settings
button and the cart navigation. The button now sits above navigation up to the
1024px breakpoint, with stacking below modal drawers and payment dialogs.

## Direct GA4 (identifier may remain empty)

Set GA4_MEASUREMENT_ID in API app/Services/Webshop/WebshopPrivacyConfig.php once the
verified G-... identifier is available. An empty/invalid value produces enabled=false
and id=null. Google Ads and Meta stay disabled. Filling in the ID alone does not
bypass status=draft: notices, responsibilities and release review remain required.
No GTM container is used. The public configuration remains versioned in API code.

Events: page_view on permitted GA4 activation, view_item on product detail opening,
add_to_cart after a real basket mutation, begin_checkout with an API quote, purchase
from saved order confirmation or API-confirmed Stripe payment. Pending, failed and
cancelled payments are not purchases. Polling does not duplicate a transaction.
Order observations before readiness/consent are not queued or replayed in the same
page. The adapter additionally deduplicates sent transaction IDs in memory and
optional sessionStorage (ws.ga4.purchase.*). Revocation removes only those optional
keys. Google also deduplicates purchase transaction_id; cross-device delivery is
not guaranteed by this frontend implementation.

Only numeric product IDs, quantities, available prices, EUR values and validated
WEB order references are sent. Product/customer names, notes, form data, coupons,
addresses, tokens and raw URLs/referrers/titles are excluded. Monetary values are
gross amounts, not a new accounting/tax report. Incomplete item metadata is omitted;
a purchase can still contain its verified total and reference. GA4 is isolated on
wsGa4Layer, uses explicit send_to and send_page_view=false. It sends one explicit
page_view with a fixed canonical URL/title and empty referrer. No SPA URL/history
listener or retrospective browsing replay is installed.

Revocation first sets ga-disable-ID=true, clears pending layer commands and removes
the script element. After completed loading, regrant reuses the same runtime. If
revocation interrupts loading, restart is latched off until reload to avoid duplicate
loaders; the UI explains this without reloading checkout automatically. IDs cannot
be switched inside an already loaded GA4 adapter; reload after changing a property.
No pre-consent Google request is made. Real Google runtime behavior still requires
verification with the actual property, beyond the intercepted test script.

Before activation, turn off Enhanced measurement and Google Signals/user-provided
data collection in the GA4 property, review any existing tags and Ads links, and
agree retention. The code disables advertising signals but cannot administer the
Google account. Cookie lifetime is capped at 180 days and remaining consent time;
cleanup limitations for third-party/HttpOnly/path-hidden cookies still apply.

Tests: node tests/ga4.test.mjs; node tests/analytics-events.test.mjs. To exercise
browser commerce with fake Google and Stripe scripts, add GA4_TEST_ID=G-TEST123 to
the static-build Stripe test command. No data goes to Google or Stripe in this test.

## Finalization changes

The visible banner now requests analytics only and always stores advertising=false.
Ads and Meta remain disabled in API; adding them later requires reviewed purposes,
notice version change, UI and adapter work. The generic state module still supports
separate categories for tests/future adapters, without silently enabling them.
Late configuration does not overwrite unsaved checkbox edits or reopen a dismissed
banner. Stale localStorage records are pruned after the server policy is known.

The locale endpoint explicitly disables external GeoIP lookup: proxy country hints
remain supported and missing hints fall back to French. Manual FR/NL/PL selection
is unchanged. The generic resolver retains legacy behavior for other callers.

PWA caches only query-free shell navigations in ws-html-consent-v1, not API or
parameterized pages. Locale dictionaries are precached. An activation hook removes
only legacy ws-html; unrelated origin caches are preserved. It cannot retroactively
stop scripts in an already-open old application: refresh after upgrade is required.
No automatic reload interrupts an order.

For the PWA test, build with SITE_BASE=/ VITE_SAME_ORIGIN_API=1 and output to
work/consent-pwa-build, then run npm run test:consent:pwa (or set PWA_BUILD).
The test upgrades a real old worker, checks legacy/unrelated caches, rejects
API/query caching, and reloads offline with consent and payment state preserved.


The user has designated webshop@atelierby.be as the appropriate working contact.
API marks it verified based on that instruction; the banner renders the mailto link.
This is a user-supplied operational assumption, not an independent mailbox check.
