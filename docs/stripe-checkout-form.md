# Paiement Stripe en mode « form » — partie webshop prête, partie API à faire

Branche : `claude/stripe-checkout-form`. À fusionner **après** la mise en ligne de la partie API.

## Pourquoi

Le paiement s'affiche aujourd'hui avec Stripe Checkout en mode `embedded` : une page Stripe dans une
iframe, que le webshop ne peut pas habiller. En mode `form`, Stripe fournit toujours le formulaire (et la
sécurité des cartes), mais il accepte l'apparence du design system : police Gotham, bordeaux `#8D1D2C`,
champs beiges `#F4EFE8`, coins de 10 px. Maquette validée le 27/11/2026.

## Ce que fait le webshop (cette branche)

- `POST {orders}/{orderRef}/stripe-checkout` envoie désormais `ui_mode: "form"` (au lieu de `"embedded"`).
  Corps complet : `{ "return_url": "...", "locale": "fr|nl|pl|en", "ui_mode": "form" }`.
- La réponse attendue garde **la même forme qu'aujourd'hui**, seul `uiMode` change :

  ```json
  { "status": "open", "uiMode": "form", "orderRef": "WEB-…",
    "clientSecret": "cs_…_secret_…", "publishableKey": "pk_live_…", "stripeAccount": "acct_…" }
  ```

  Les contrôles existants s'appliquent toujours (`pk_test|live_…`, `acct_…`, `cs_…_secret_…`).
- Le webshop accepte encore `uiMode: "embedded"` : tant que l'API répond comme avant, le paiement
  fonctionne comme avant (page Stripe non habillée). Rien ne casse si le webshop part en premier.
- Côté navigateur : `Stripe(publishableKey, { stripeAccount })`, puis
  `stripe.initCheckoutFormSdk({ clientSecret, appearance, fonts })`, `createForm({ layout: 'expanded' })`,
  `form.mount(…)`, `checkout.loadActions()` et, sur l'événement `confirm` du formulaire,
  `actions.confirm({ formConfirmEvent, redirect: 'if_required' })`.
  Le code : `webshop-stripe-embedded.jsx` (apparence : `STRIPE_APPEARANCE`).
- Après confirmation, le webshop **ne considère pas la commande payée** : il interroge l'API
  (`stripe-status`), comme aujourd'hui. Le webhook `checkout.session.completed` reste la source de vérité.

## Ce que l'API doit faire

1. **Créer la session avec `ui_mode=form`** quand le webshop le demande (même route, mêmes contrôles).
   Toujours sur le compte connecté de la boutique (en-tête `Stripe-Account`), comme aujourd'hui.
   Doc Stripe : https://docs.stripe.com/checkout/form/quickstart
2. **`return_url`** : garder celle d'aujourd'hui, qui revient sur le webshop avec
   `?stripe=return&orderRef=…`. Les cartes se confirment sans quitter la page, mais **Bancontact et les
   autres moyens à redirection** passent par Stripe puis reviennent sur cette adresse, que le webshop
   vérifie déjà.
3. **Répondre `uiMode: "form"`** avec les mêmes champs que pour `embedded` (voir plus haut).
4. Ne pas envoyer `branding_settings` : l'apparence vient du webshop (`appearance`).

## Serveur web (polices)

Stripe charge Gotham depuis ses propres domaines. Les fichiers `assets/Gotham_*.otf` du webshop doivent
être servis avec `Access-Control-Allow-Origin: *` (ou au minimum pour `https://js.stripe.com`). Sans cet
en-tête, le formulaire s'affiche quand même, mais en police système.

## À vérifier en test (compte Stripe test d'une boutique)

- Le formulaire s'affiche avec `stripeAccount` (compte connecté) : la doc du mode `form` ne parle pas de
  Stripe Connect, c'est le premier point à confirmer.
- Carte `4242 4242 4242 4242` : paiement confirmé dans la page, puis commande « payée » après le webhook.
- Bancontact : redirection, retour sur `?stripe=return&orderRef=…`, commande « payée ».
- Police Gotham bien chargée dans le formulaire (sinon : en-tête CORS ci-dessus).
- Fermeture de la fenêtre de paiement puis « Payer » à nouveau : même commande, pas de doublon.

## Ordre de mise en ligne

1. API : accepter `ui_mode=form` et répondre `uiMode: "form"`.
2. Serveur : en-tête CORS sur les polices.
3. Webshop : fusionner cette branche dans `main`.
