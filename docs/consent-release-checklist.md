# Consent release handoff

Current release: docs/privacy-release-2026-10-28.md. The user business-approved
notices; normal builds now emit six public pages and API links are populated.
GA4 remains off (empty ID and explicit review flag). Historical draft requirements
below describe the earlier preparation; use the current handoff for publication.

## Implemented and locally verified

- Updated API/Webshop bases; existing promotion validation retained.
- Analytics-only FR/NL/PL banner, equal buttons, dismissal without consent,
  persistent settings, six-month choice expiry and policy version invalidation.
- No Google before a valid ID, ready configuration and analytics consent.
- Direct GA4 with allowlisted commerce fields and purchase deduplication.
- Withdrawal and first-party cleanup preserve login/payment data.
- Public privacy config, empty GA4 placeholder, Ads/Meta disabled, draft status.
- No external GeoIP request from the locale route.
- Service-worker upgrade/offline checks and no caching of API/query navigation.
- Pinned browser test dependency, repeatable npm commands and CI definitions.

## Browser storage follow-up

Functional records now use bounded tab sessions; legacy permanent records are
removed. See browser-storage.md for exact expiry, upgrade/login impact, tests and
remaining DEC-08 assessment. Policy drafts/manifests were refreshed as draft-0.3, still unapproved.
See privacy-pages.md for the opt-in review pages and guarded publication process.

Expired reset cleanup is implemented but not deployed/scheduled; see API
docs/webshop/auth-retention.md and privacy-drafts/09-retencja-i-domkniecie-PL.md.
The previous blanket 15-year retention assumption is withdrawn.

## Business/legal information needed before activation

1. Supply verified G-... ID for GA4_MEASUREMENT_ID in API WebshopPrivacyConfig.php.
2. Contact resolved by user instruction: webshop@atelierby.be is the designated
   working privacy mailbox and is displayed in the banner. No independent mailbox
   probe was performed.
3. Obtain approved privacy/cookie notices at least FR/NL, with appropriate PL text
   for the supported interface. Enter real HTTPS links in policies.
4. Confirm roles of ASIMA and individual franchisees, seller identities and
   responsibilities for orders/shared analytics. Network ownership alone is not
   a controller determination.
5. Approve actual collected data, purposes, provider contract/entity, recipients,
   transfers, cookie/data retention, rights/contact and consent evidence model.
   The frontend stores a versioned choice; it is not a server-side consent log.
6. Review the real GA4 property: disable Enhanced measurement and Google Signals/
   user-provided-data features not covered by the implementation; check Ads links
   and retention. No Ads/Meta activation is part of this release.

Do not replace missing values with fictional policy URLs or verified=true flags.
Filling in the ID alone does not change status=draft. After review, update the
notice version when purposes/providers change, verify metadata, and explicitly
mark configuration ready as a reviewed release change.

## Technical release sequence

1. Run npm ci, npm run test:unit and build with the real deployment settings.
2. Run consent browser, Stripe fixture and real-service-worker PWA tests.
3. Run the API privacy contract/PHP checks; deploy API to a test environment first.
4. On that environment, verify headers, real GA4 script/collection behavior,
   refusal/withdrawal/expiry, URL sanitization and purchase deduplication.
   This requires the actual property; fake-script tests cannot prove it.
5. Verify a normal purchase and test-mode Stripe with consent refused and granted.
6. Check CSP/network allowlists, HTTPS, no-store config responses and SW update
   headers. Test the real deployed base path and an already-installed old client.
7. Obtain release approval, then publish through the project's normal deployment
   process. No deployment or migrations have been performed in this work.
8. Smoke-test refusal, settings, policy links, checkout and GA4 after publication.

## Rollback

Disable GA4 in API (empty its ID and/or return draft) to prevent further activation
once clients fetch config. For an immediate ongoing loaded session, use the consent
withdrawal controls; server configuration is not pushed to already-open tabs.
A frontend rollback must retain the consent gate: never restore unconditional GTM
or Meta snippets. Existing old tabs require a reload; deleting a script element is
not an unload mechanism for arbitrary third-party code.

## Not performed / still blocked

Real Google-account and real-provider validation, legal approval, hosting deployment checks and production release. CI files are added
but have not run on GitHub because no commit/push was made. Legacy webshop-full.html
and the independently deployed B2B landing are not treated as a completed analytics
rollout: the landing's trackers remain disabled.
