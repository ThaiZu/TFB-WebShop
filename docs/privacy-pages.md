# Published notices and review copies

The approved publication source is docs/privacy-published (six PL/FR/NL files),
selected by privacy-policies.json. The approval records the user's explicit
business approval in the conversation on 2026-10-28, not a signature by Sam or an
independent legal opinion. Historical DEC drafts remain in docs/privacy-drafts
and are not shipped to clients.

A normal build emits privacy/{pl,fr,nl}/{privacy,cookies}.html. Production API
points at https://webshop.atelierby.be/privacy/... with SITE_BASE=/.
The frontend also knows its built local document paths, so notices remain linked
when privacy-config fails; measurement remains blocked. The built controller
notice is available during configuration loading/failure. Settings/registration
links open a new tab with noopener to preserve the current checkout.

Standalone account pages load generated privacy-runtime.js and policy-links.js;
links follow the current language without collecting analytics consent. The
registration checkbox refers to service terms separately from the privacy notice;
no analytics consent is required to register. General sales/service terms are a
separate document outside this privacy implementation.

Opt-in review:

    PRIVACY_POLICY_PREVIEW=1 npm run build -- --outDir work/policy-preview --emptyOutDir
    POLICY_BUILD=work/policy-preview POLICY_PREVIEW=1 npm run test:policies:browser

Preview pages have a visible review label and noindex and are not precached.
Do not deploy a preview build as the public storefront. Normal builds contain
only the approved sources. Both approved/preview documents remain escaped native
HTML generated without a third-party renderer. The builder rejects known
unresolved markers or missing review metadata for published output.

API ready refers to notice/consent configuration, not automatic GA4 activation.
With no configured measurement, the panel informs and remembers a denied choice;
it does not solicit future analytics consent. To enable GA4 later: insert verified
G-... in WebshopPrivacyConfig.php, check the real service/settings/requests, then
set GA4_REVIEWED=true. Update the consent policyVersion for the activation so
existing visitors receive a new choice. Validate cookies, withdrawal, event
sanitization and purchase deduplication. No Ads/Meta/GTM activation is included.

No five-year automatic invoice/complaint deletion is introduced. Published text
uses applicable statutory/claims criteria; the proposed five years remains in
internal decisions until accounting confirms the period and start. Five-year
account inactivity triggers read-only review, not blanket account deletion.

The prepared notices do not independently prove actual mail/backup/log settings,
provider contracts, privacy request staffing or purpose-specific legal arrangements.
Check those release assumptions on the target environment before publication.
