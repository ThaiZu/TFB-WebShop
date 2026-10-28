# Privacy release handoff 2026-10-28

Prepared locally, not deployed, committed or pushed. Fresh GitHub bases merged
without conflicts; local privacy changes preserved and backup stashes retained.
API base 24a547d; webshop base 977644b. Repositories must be released separately.

## Included

- Approved public PL/FR/NL notices in docs/privacy-published, real /privacy URLs,
  approved controller text for shared account/measurement and seller's orders.
- API privacy config ready, GA4 ID empty and GA4_REVIEWED=false; Ads/Meta off.
- Checkout shows the seller name, address and VAT/contact when supplied by API;
  no seed values or invented registered address are inserted.
- Functional public links in banner, persistent footer, React registration and
  standalone account pages; privacy information separate from service acceptance.
- No request for future analytics consent when measurement is unavailable.
- Stable privacy scripts are revalidated through the Apache header rules; hashed
  bundles stay immutable. This needs mod_headers/AllowOverride on the real host.
- Retention tools remain scoped to expired reset cleanup and read-only account
  review; no automatic removal of invoices, complaints or customers after 5 years.

## Configuration to check before triggering deployment

Set the non-secret GitHub repository variable VITE_API_BASE_URL to the intended
absolute central API URL ending /api/v1. Both existing webshop build workflows
now pass this variable explicitly. SITE_BASE must be / for webshop.atelierby.be;
VITE_SAME_ORIGIN_API=1 only if the reverse proxy actually serves /api/v1 on that
host. No fallback to the legacy php-api is invented.

The existing webshop SFTP workflow also uploads legacy PHP files. It is not the
central TFB-Api deployment. Run/review the API project's test/production pipeline
separately; uploading only webshop is insufficient. No pipeline was triggered.

## Target release sequence

1. Review final diff and approvals, commit/push through the normal process and
   require consent/privacy CI. CI definitions in this work have not run on GitHub.
2. On staging, publish frontend assets and the six notices before the API ready
   configuration that links to them; coordinate this as one release. Keep old
   assets through the worker transition. Test API route availability/no-store.
3. Confirm real seller information, OVH/mail/SMS/Stripe settings, log rotation,
   backup restoration handling and the designated privacy-request operator.
   Prepared notices are not evidence these operational settings were verified.
4. Verify links FR/NL/PL, signup without analytics, no Google requests while off,
   a normal order and Stripe test-mode flow, old PWA upgrade and offline refusal.
5. Apply only the retention indexes actually needed through the normal migration
   process; confirm reset cleanup schedule and reports on the chosen target.
   Account-review tool never deletes. No migration is executed in this task.
6. GA4 can be enabled later using verified ID + explicit GA4_REVIEWED flag after
   real-property tests. Change consent version on activation. Do not enable Ads,
   Meta, Signals/extra measurement simply because GA is being configured.
7. Publish via the normal operator procedure and smoke-test the same flows.
   Already-open old tabs can keep previous code until reloaded; a server deploy
   is not a way to unload an old tracker from an existing page.

## Rollback

For GA stop activation in API (empty ID or set GA4_REVIEWED=false), then verify
clients fetch the update; already-open pages need withdrawal/reload. Preserve
consent gating in any frontend rollback. Do not restore unconditional GTM/Meta.
Keep valid published notices accessible. Deletion by a previously activated
cleanup job cannot be undone by reverting frontend code.

## Remaining external verification

Real GA property (if activated), real Stripe/staging request traces, operational
retention and vendor/role arrangements. The five-year sales/complaint proposal is
not represented as a verified statutory deadline. No claim of complete legal
certification is made by the ready configuration or successful local tests.
