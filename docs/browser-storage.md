# Browser storage revision 2026-10-27

This is a technical retention reduction, not a legal determination of necessity.

## Implemented

The main Vite storefront, legacy entry and standalone translated account pages
load `public/session-storage.js` before reading browser preferences. It removes
only known legacy localStorage keys (auth tokens, customer profile, language,
active shop, delivery preferences, account tab and PWA prompt markers). It does
not migrate these values. Consent and other applications' keys remain intact.

Those functional records now use versioned sessionStorage envelopes with a maximum
age of 12 hours **from each write**. Reads do not extend the deadline; token
rotation/profile updates are new writes. Browser sessions normally end with the
tab; browser restore and opener-created tabs can retain/copy sessionStorage.
Expiry checks therefore run on access, startup, pageshow and focus. This is not
a guarantee of physical deletion while a browser is closed or suspended, nor an
absolute 12-hour server login limit. Server token validity remains unchanged
(access 30 minutes, refresh 90 days). No remember-me feature is introduced.

Storage failures fall back to page memory only. A reload then needs a new login.
Existing permanent sessions are deliberately invalidated locally during upgrade;
users must sign in again. Reloads and payment returns in the same tab retain
valid records. Independent tabs do not share sign-in; installed PWA windows can
also require a separate login or the existing handoff flow.

Logout/session invalidation additionally removes the session profile, account tab
and all customer/shop delivery preferences. Locale and active-shop selection
remain until session expiry. PWA prompt dismissal/installation markers are now
session-scoped, at most 12 hours, instead of a permanent installation marker or
seven-day persistent reminder. Installation is still detected from browser mode.

The B2B landing independently deletes legacy la_lang and stores an explicit
language choice in its own 12-hour session envelope. It needs separate deployment.

Navigation HTML runtime cache has maxEntries=2 and maxAgeSeconds=43200, enforced
by Workbox during cache activity. API and query navigation remain excluded.
Precached application assets remain versioned, cleaned on service-worker upgrade;
they are public resources, not customer profiles. No periodic offline deletion is
claimed. Existing transactional sessionStorage keys (order access/payment resume)
are unchanged to preserve checkout; they still need separate purpose/retention
review. GA4 deduplication remains conditional on analytics consent.

## Still open

DEC-08 remains open for legal necessity, reasonable durations and PWA/Stripe /
transactional storage assessment. Twelve hours is an implementation choice,
not a prescribed statutory period. Changing storage does not fix server/database
retention, revoke old refresh tokens on the server, or replace provider review.

The privacy-drafts folder now contains draft-0.2 with updated storage tables,
code anchors and SHA manifest. These remain unapproved; refresh the snapshot
again if code changes before final publication. Earlier Word/ZIP exports and
the original ChatGPT Page snapshot are historical and must not be published.

## Validation

Unit suite, production build, auth refresh test and local Chromium scenarios cover
migration, expiry/corruption, blocked storage, login/reload, independent tabs,
logout, consent retention, embedded Stripe fixtures and old-worker/offline PWA.
No live provider, production or deployment tests; CI is configured but not run on
GitHub. Other browser scenarios have updated seed formats but were not all run.
