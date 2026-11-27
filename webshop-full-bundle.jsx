import {PersonalLoyalty} from './webshop-personal-loyalty.jsx';
import { searchProducts } from './webshop-product-search.js';
import './webshop-product-search.css';
import {ShopPhoto} from './webshop-shop-photo.jsx';
import {useVoucherActivation} from './webshop-voucher-activation.js';
import {voucherProductPortions} from './webshop-voucher-targets.js';
import {useVoucherNotifications} from './webshop-voucher-notifications.js';
import {LoyaltyWallet,LoyaltyCardIcon,useLoyaltyIdentity} from './webshop-loyalty-wallet.jsx';
import {AccountVouchers} from './webshop-vouchers.jsx';
import {PolicyLinks} from './webshop-policy-links.jsx';
import { analyticsEvent } from './webshop-analytics.js';
import { CookieConsent } from './webshop-cookie-consent.jsx';
import { PickupDates } from './webshop-pickup-dates.jsx';
import { OfficeIdentity } from './webshop-office-identity.jsx';
import { OrderConfirmation } from './webshop-order-confirmation.jsx';
import { orderStatusName, paymentStatusName } from './webshop-order-status.js';
import { ProfileOffices } from './webshop-profile-offices.jsx';
import { defaultShoppingContext, normaliseShoppingContext, sameShoppingContext, basketShoppingContext, needsCartReplacement, shoppingContextLabel, hasUnsupportedOfficeConfiguration } from './webshop-office-context.js';
import { StripeReturnDialog, StripeRetryButton } from './webshop-stripe-return.jsx';
import { PurchaseDetails } from './webshop-purchase-details.jsx';
import { AccountTransactions, receiptIntent } from './webshop-account-transactions.jsx';
import { BillingCompanies, InvoiceBuyerFields, invoiceBuyerPayload, validInvoiceBuyer } from './webshop-billing.jsx';
import { billingError, billingRequest } from './webshop-billing-api.js';
import { OfficeMembershipModal } from './webshop-office-membership.jsx';
import { OfficeDeliveryModal } from './webshop-office-delivery.jsx';
import { createPortal } from 'react-dom';
import { availablePortions, basketProductUnits, stockMessageKey } from './webshop-stock.js';
import linkedOfficeIcon from './assets/icons/linked_office.svg';
import noLinkedOfficeIcon from './assets/icons/no_linked_office.svg';
import { PwaInstallPrompt } from './webshop-pwa-install.jsx';

const wsNumber = (value) => new Intl.NumberFormat(window.WSI18n.getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
// Runtime UI translations; API errors are localised at the display boundary.
const wsCurrency = (amount) => new Intl.NumberFormat(window.WSI18n.getLang(), { style: 'currency', currency: 'EUR' }).format(amount);
const wsText = (key, params) => window.WSI18n.t(key, params);
const wsMessage = (value) => window.WSI18n.message(value);

// The shop acknowledgement prevents an order at the wrong location. Keep a
// tiny bundle fallback for it: locale JSON files are deployed separately and
// an older one must never expose internal translation keys to a customer.
const WS_SHOP_CONFIRM_FALLBACKS = {
  fr: {
    'shopConfirm.eyebrow': 'Confirmez votre boutique',
    'shopConfirm.title': 'Votre atelier',
    'shopConfirm.intro': 'Votre commande, son paiement et son retrait seront pris en charge par :',
    'shopConfirm.continue': 'Continuer avec {shop}',
    'shopConfirm.change': 'Changer de boutique',
    'shopConfirm.paymentLabel': 'Boutique qui prépare votre commande',
    'shopConfirm.clearBasketTitle': 'Changer de boutique videra votre panier',
    'shopConfirm.clearBasketBody': 'Les produits, prix et disponibilités dépendent de la boutique. Pour en choisir une autre, votre panier actuel sera supprimé.',
    'shopConfirm.clearBasketConfirm': 'Vider le panier et changer de boutique',
  },
  nl: {
    'shopConfirm.eyebrow': 'Bevestig je winkel',
    'shopConfirm.title': 'Jouw atelier',
    'shopConfirm.intro': 'Je bestelling, betaling en afhaling worden verzorgd door:',
    'shopConfirm.continue': 'Doorgaan met {shop}',
    'shopConfirm.change': 'Winkel wijzigen',
    'shopConfirm.paymentLabel': 'Winkel die je bestelling verwerkt',
    'shopConfirm.clearBasketTitle': 'Winkel wijzigen maakt je mandje leeg',
    'shopConfirm.clearBasketBody': 'Producten, prijzen en beschikbaarheid verschillen per winkel. Om een andere winkel te kiezen, wordt je huidige mandje verwijderd.',
    'shopConfirm.clearBasketConfirm': 'Mandje wissen en winkel wijzigen',
  },
  pl: {
    'shopConfirm.eyebrow': 'Potwierdź sklep',
    'shopConfirm.title': 'Twoja pracownia',
    'shopConfirm.intro': 'Twoje zamówienie, płatność i odbiór zostaną obsłużone przez:',
    'shopConfirm.continue': 'Kontynuuj w {shop}',
    'shopConfirm.change': 'Zmień sklep',
    'shopConfirm.paymentLabel': 'Sklep realizujący zamówienie',
    'shopConfirm.clearBasketTitle': 'Zmiana sklepu usunie koszyk',
    'shopConfirm.clearBasketBody': 'Produkty, ceny i dostępność zależą od sklepu. Aby wybrać inny sklep, bieżący koszyk zostanie usunięty.',
    'shopConfirm.clearBasketConfirm': 'Usuń koszyk i zmień sklep',
  },
};
function wsShopConfirmText(key, params) {
  const translated = wsText(key, params);
  if (translated !== key) return translated;
  const language = window.WSI18n?.getLang?.() || 'fr';
  const template = WS_SHOP_CONFIRM_FALLBACKS[language]?.[key] || WS_SHOP_CONFIRM_FALLBACKS.fr[key] || key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => (params && name in params ? params[name] : `{${name}}`));
}

// ===== webshop.jsx (full-bleed) =====
// webshop.jsx : L'Atelier By customer-facing webshop
// Three variants of how the active shop is anchored in the chrome.

const { useState, useMemo, useEffect } = React;

// iOS Safari n'applique les états :active au toucher que si un écouteur
// touch existe : sans lui, tout le retour « pressé » ajouté en CSS resterait
// invisible sur iPhone. No-op passif, coût nul.
document.addEventListener('touchstart', function () {}, { passive: true });

// Appareil au doigt : le dépliage est instantané (CSS), les recentrages ne
// doivent donc plus attendre la fin d'une animation qui n'existe plus.
const IS_TOUCH = window.matchMedia && window.matchMedia('(hover: none)').matches;

// Version servie : visible en console et dans l'encadré ?tapdebug=1, pour
// distinguer « le correctif ne marche pas » de « le téléphone sert encore
// l'ancien bundle » (service worker). Et rafraîchissement agressif du SW :
// vérification de mise à jour au retour d'onglet et toutes les 60 s.
const WS_BUILD = (typeof __WS_BUILD__ !== 'undefined') ? __WS_BUILD__ : 'dev';
window.__WS_BUILD = WS_BUILD;
try { console.info('[ws] build ' + WS_BUILD); } catch (e) {}
if ('serviceWorker' in navigator) {
  const ping = () => navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
  setInterval(ping, 60000);
}

/* ── TAP FIABLE, GÉNÉRALISÉ ────────────────────────────────────────────────
   L'action part au relâchement (pointerup/touchend) comme en natif, même
   quand le navigateur retient le click (tap qui stoppe l'inertie du scroll,
   geste requalifié). L'état vit SUR LE NŒUD DOM : chaque élément a le sien
   un tap sur B ne peut jamais être mangé par la dédup d'un tap sur A (le
   verrou partagé de l'ancienne version mangeait le 2e tap < 400 ms).
   opts.open : marque un dépliage/une ouverture, arme la fenêtre anti-clic-
   fantôme (le click synthétisé du MÊME tap atterrit sur le contenu qui vient
   d'apparaître : il arrive en « orphelin », sans appui vu sur sa cible, et
   la fenêtre le neutralise ; un clic clavier, orphelin aussi, passe hors
   fenêtre). opts.stop : n'alimente pas les gestionnaires des ancêtres (les
   boutons imbriqués dans une carte elle-même tappable). */
let __wsOpenedAt = 0;
let __wsPressTarget = null;
let __wsPressAt = 0;
function wsShield() { __wsOpenedAt = performance.now(); }
/* BOUCLIER GLOBAL. Quand une action change la mise en page SOUS le doigt
   (dépliage, fermeture de la fiche, panier → checkout, commande passée), le
   click synthétisé du même tap atterrit sur ce qui vient d'apparaître à cet
   endroit : constaté : « Commander » posait le clic sur « Se connecter » du
   checkout, d'où une demande de connexion à chaque validation. Signature
   infaillible d'un fantôme : sa cible n'a reçu AUCUN appui (pointerdown) de
   ce geste. Un vrai tap suivant a toujours son propre appui : il passe. */
document.addEventListener('pointerdown', (e) => {
  __wsPressTarget = e.target; __wsPressAt = performance.now();
}, { capture: true, passive: true });
document.addEventListener('click', (e) => {
  if (performance.now() - __wsOpenedAt > 400) return;
  const t = __wsPressTarget;
  if (t && __wsPressAt <= performance.now() && t.isConnected
      && (t === e.target || t.contains(e.target) || e.target.contains(t))) return;
  e.stopPropagation(); e.preventDefault();
}, { capture: true });

function wsTap(fn, opts) {
  /* ÉCOUTEURS NATIFS, PAS SYNTHÉTIQUES. Diagnostic au doigt sur la fiche
     produit : les événements natifs d'un tap ATTEIGNENT l'élément et
     remontent jusqu'à la racine (sondes posées à chaque étage), mais la
     délégation synthétique de React n'invoquait AUCUN gestionnaire de la
     carte tapée : alors qu'un click dispatché par script passait. Plutôt que
     de dépendre de cette dispatche défaillante, chaque élément reçoit ses
     écouteurs natifs via ref. La closure du DERNIER rendu est rejouée
     (el.__wsTapConf.fn), les écouteurs ne sont posés qu'une fois par nœud,
     et meurent avec lui. */
  const conf = { fn, doOpen: !!(opts && (opts.open || opts.shield)), doStop: !!(opts && opts.stop) };
  return {
    ref: (el) => {
      if (!el) return;
      el.__wsTapConf = conf;
      if (el.__wsTapBound) return;
      el.__wsTapBound = true;
      const st = (e) => { if (el.__wsTapConf.doStop) e.stopPropagation(); };
      const fire = () => {
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
        const p = el.__wsTap || (el.__wsTap = {});
        p.handled = performance.now();
        if (el.__wsTapConf.doOpen) wsShield();
        el.__wsTapConf.fn();
      };
      el.addEventListener('pointerdown', (e) => {
        st(e);
        el.__wsTap = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, handled: 0 };
      });
      el.addEventListener('pointerup', (e) => {
        st(e);
        const p = el.__wsTap;
        if (!p || p.id !== e.pointerId || !p.t) return;
        const moved = Math.abs(e.clientX - p.x) > 14 || Math.abs(e.clientY - p.y) > 14;
        if (!moved && performance.now() - p.t < 600 && !(p.handled && performance.now() - p.handled < 350)) fire();
      });
      el.addEventListener('touchstart', (e) => {
        st(e);
        const t = e.touches[0]; if (!t) return;
        const p = el.__wsTap || (el.__wsTap = {});
        p.tx = t.clientX; p.ty = t.clientY; p.tt = performance.now();
      }, { passive: true });
      el.addEventListener('touchend', (e) => {
        st(e);
        const p = el.__wsTap; const t = e.changedTouches && e.changedTouches[0];
        if (!p || !t || !p.tt) return;
        if (p.handled && performance.now() - p.handled < 350) return;
        const moved = Math.abs(t.clientX - p.tx) > 12 || Math.abs(t.clientY - p.ty) > 12;
        if (!moved && performance.now() - p.tt < 600) fire();
      });
      el.addEventListener('click', (e) => {
        st(e);
        const p = el.__wsTap || {};
        const now = performance.now();
        if (p.handled && now - p.handled < 400) return;
        const sawPress = (p.t && now - p.t < 600) || (p.tt && now - p.tt < 600);
        if (!sawPress && now - __wsOpenedAt < 250) return;
        fire();
      });
    },
  };
}

// Diagnostic terrain : ?tapdebug=1 affiche les derniers événements tactiles
// (type + cible) dans un coin de l'écran : pour voir ce que LE téléphone fait
// réellement d'un tap qui « ne marche pas », sans outillage branché.
if (/[?&]tapdebug=1/.test(location.search)) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99999;background:rgba(0,0,0,.78);color:#7CFC90;font:10px/1.4 monospace;padding:6px 8px;border-radius:6px;max-width:72vw;pointer-events:none;white-space:pre;';
  document.body.appendChild(box);
  const lines = ['build ' + ((typeof __WS_BUILD__ !== 'undefined') ? __WS_BUILD__ : 'dev')];
  const log = (e) => {
    const cls = ((e.target.getAttribute && e.target.getAttribute('class')) || e.target.tagName || '?').split(' ')[0];
    lines.push((e.type + '            ').slice(0, 13) + cls.slice(0, 26));
    if (lines.length > 9) lines.shift();
    box.textContent = lines.join('\n');
  };
  for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'click'])
    document.addEventListener(t, log, { capture: true, passive: true });
}

// =========================================================================
// DATA
// =========================================================================
// Go-live : AUCUNE boutique en dur. Les boutiques viennent exclusivement de
// l'API /shops (table `shops`) ; si elle est injoignable, l'UI affiche une
// erreur : jamais de données de démo (« Maison Châtelain » et consorts).
// L'objet global window.W_SHOPS a été supprimé : tant qu'il existait, un
// repli pouvait y puiser une liste de boutiques fictive.

const W_CATEGORIES = [];

const W_ASSORTMENTS = [];

// --- Line-art product placeholders (design-system illustrations) ---
const PLACEHOLDER_BY_SUBCAT = {
  'sand-classic': 'img/placeholders/sandwiches.png',
  'sand-deluxe':  'img/placeholders/sandwiches.png',
  'sand-veggie':  'img/placeholders/sandwiches.png',
  'plats-traiteur': 'img/placeholders/savoury-tart.png',
};
const PLACEHOLDER_BY_CAT = {
  breads:     'img/placeholders/bread.png',
  vienn:      'img/placeholders/croissant.png',
  tarts:      'img/placeholders/sweet-tart.png',
  sweet:      'img/placeholders/cookies.png',
  plats:      'img/placeholders/savoury-tart.png',
  salades:    'img/placeholders/salads.png',
  sandwiches: 'img/placeholders/sandwiches.png',
  drinks:     'img/placeholders/cold-drink.png',
  boissons:   'img/placeholders/hot-drink.png',
};
function getPlaceholder(p) {
  return (p && p.subCat && PLACEHOLDER_BY_SUBCAT[p.subCat])
      || (p && PLACEHOLDER_BY_CAT[p.cat])
      || 'img/placeholders/cake.png';
}

// Go-live : plus aucun produit de démo (Tarte aux fraises & co purgés).
const W_PRODUCTS = [];

const W_PRODUCT_PRICES = {};
const W_SHOP_PRODUCTS = {};

// Go-live : window._CATALOG_SEED n’est plus exposé, le catalogue vient
// exclusivement de l'API /catalog ; en cas d'échec, l'UI reste vide/erreur.

// =========================================================================
// CLIENTS / OFFICES / DELIVERY TOURS
// A client may be linked to one office; an office may be linked to one tour.
// Delivery is enabled only if both links exist (office validated + tour set).
// =========================================================================
// Go-live : AUCUN store local. Utilisateurs (WSAuth), bureaux (WSOffices) et
// tournées (WSTours) viennent du serveur ; sans lui, l'écran affiche une erreur.
const SRV_REQUIRED = () => ({ ok: false, error: wsText('error.service') });

// =========================================================================
// SHARED PRIMITIVES
// =========================================================================

const Pict = ({ d, s = 16 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const ICONS = {
  chev:    <path d="M9 6l6 6-6 6"/>,
  cal:     <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
  search:  <><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></>,
  user:    <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>,
  bag:     <><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 016 0"/></>,
  pin:     <><path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></>,
  shop:    <><path d="M4 9l1.5-4h13L20 9"/><path d="M4 9v11h16V9"/><path d="M9 13h6v7H9z"/></>,
  truck:   <><path d="M3 16V7h11v9M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></>,
  back:    <path d="M15 6l-6 6 6 6"/>,
  plus:    <><path d="M12 5v14M5 12h14"/></>,
  info:    <><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/></>,
  options: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></>,
  check:   <path d="M5 12l4 4 10-10"/>,
  close:   <path d="M6 6l12 12M18 6L6 18"/>,
  switch:  <><path d="M4 9h13l-3-3M20 15H7l3 3"/></>,
};

// =========================================================================
// DATE PILL : date picker with popover calendar
// =========================================================================
/* Noms de jours et de mois : rendus par Intl DANS LA LANGUE COURANTE, jamais
   des tableaux français en dur (une boutique néerlandophone affichait « Dim. »
   à côté de libellés en NL). Ils n'ont pas leur place dans la table de
   traduction : le navigateur les connaît pour toutes les langues, et une copie
   en base se désynchroniserait. Le reste des libellés vient bien de ws_i18n. */
function wsLocale() {
  const l = (window.WSI18n && window.WSI18n.getLang && window.WSI18n.getLang()) || 'fr';
  return l === 'pl' ? 'pl-PL' : l === 'nl' ? 'nl-BE' : l === 'en' ? 'en-GB' : l === 'de' ? 'de-DE' : 'fr-BE';
}
function wsCap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
// Mois en toutes lettres (en-tête du calendrier) : « août » / « augustus ».
function wsMonthName(monthIndex, year) {
  return wsCap(new Date(year != null ? year : 2000, monthIndex, 1)
    .toLocaleDateString(wsLocale(), { month: 'long' }));
}
// Ligne d'en-tête du calendrier : Lun…Dim / Ma…Zo, semaine commençant le lundi.
function wsWeekdayNames() {
  const base = new Date(2024, 0, 1);              // 1er janvier 2024 = un lundi
  return Array.from({ length: 7 }, (_, i) =>
    wsCap(new Date(2024, 0, 1 + i).toLocaleDateString(wsLocale(), { weekday: 'short' })
      .replace(/\.$/, '')));
}
function wsFormatPill(d) {
  // Pastille du bandeau : jour + numéro, SANS le mois. « Dim. 16 » suffit à
  // lever l'ambiguïté (on ne franchit presque jamais une fin de mois) et
  // libère la largeur qui manquait au nom de la boutique. Le mois reste
  // affiché dans le calendrier ouvert.
  const day = wsCap(d.toLocaleDateString(wsLocale(), { weekday: 'short' }));
  return `${day} ${d.getDate()}`;
}
// i18n : hook réactif (webshop-i18n-react → window.useT). Re-rend le composant
// au changement de langue ; repli direct sur WSI18n.t si le hook n'est pas là.
function wsUseT() {
  return window.useT
    ? window.useT()
    : { t: (k, p) => (window.WSI18n ? window.WSI18n.t(k, p) : k), tCategory: (id, fb) => fb,
        lang: (window.WSI18n && window.WSI18n.getLang) ? window.WSI18n.getLang() : 'fr',
        setLang: (l) => { if (window.WSI18n) window.WSI18n.setLang(l); } };
}
/* Rendu RICHE d'un libellé traduit : une phrase = UNE clé, même quand une
   partie est mise en valeur. Le texte en base porte des marqueurs
   **fort** → <strong>, __accent__ → <em>, au lieu d'être coupé en morceaux
   par le JSX. Découper « Bon retour <em>parmi nous</em>. » en deux clés
   rendait la phrase intraduisible : l'ordre des mots change d'une langue à
   l'autre, et le traducteur doit pouvoir DÉPLACER l'emphase. */
function tRich(t, key, params) {
  const raw = t(key, params);
  const out = [];
  const re = /\*\*([^*]+)\*\*|__([^_]+)__/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) out.push(raw.slice(last, m.index));
    out.push(m[1] != null
      ? <strong key={i++}>{m[1]}</strong>
      : <em key={i++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < raw.length) out.push(raw.slice(last));
  return out;
}
function DatePill({ mode, value, onChange, shopId,
                    collectCutoffPassed, collectCutoffLabel,
                    deliveryCutoffPassed, deliveryCutoffLabel,
                    minLeadDays }) {
  const { t } = wsUseT();
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  // dayMap: { 'YYYY-MM-DD': { available, reason } }, populated per visible month
  const [dayMap, setDayMap] = React.useState({});
  const [loadingDays, setLoadingDays] = React.useState(false);
  const wrapRef = React.useRef(null);
  const calendarRef = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!open || window.matchMedia('(max-width: 767px)').matches) return;
    const position = () => {
      const anchor = wrapRef.current?.getBoundingClientRect();
      const calendar = calendarRef.current;
      if (!anchor || !calendar) return;
      calendar.style.left = Math.max(12, Math.min(anchor.left, window.innerWidth - calendar.offsetWidth - 12)) + 'px';
      calendar.style.top = Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - calendar.offsetHeight - 12)) + 'px';
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {window.removeEventListener('resize', position);window.removeEventListener('scroll', position, true);};
  });
  const [mobileCalendar, setMobileCalendar] = React.useState(() => window.matchMedia('(max-width: 767px)').matches);
  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobileCalendar(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Close on outside click / Escape
  React.useEffect(() => {
    if (!open) return;
    const off = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target) && !calendarRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off, true); document.removeEventListener('keydown', esc); };
  }, [open]);

  // Fetch available days for the visible month whenever view/shop/mode changes
  React.useEffect(() => {
    const api = window.WSAvailability || window.WSCalendar;
    if (!api || typeof api.listAvailableDays !== 'function') return;
    let alive = true;
    const from = `${view.getFullYear()}-${String(view.getMonth()+1).padStart(2,'0')}-01`;
    const lastDay = new Date(view.getFullYear(), view.getMonth()+1, 0).getDate();
    const to = `${view.getFullYear()}-${String(view.getMonth()+1).padStart(2,'0')}-${lastDay}`;
    setLoadingDays(true);
    api.listAvailableDays({ shopId, mode, from, to })
      .then((rows) => {
        if (!alive) return;
        const map = {};
        for (const row of (rows || [])) map[row.iso] = row;
        setDayMap((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingDays(false); });
    return () => { alive = false; };
  }, [view.getFullYear(), view.getMonth(), shopId, mode]);

  function pad(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

  // The day strip shows the next seven days; load them even when they cross into next month.
  React.useEffect(() => {
    const api = window.WSAvailability || window.WSCalendar;
    if (!open || !api || typeof api.listAvailableDays !== 'function') return;
    let alive = true;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    api.listAvailableDays({ shopId, mode, from: isoOf(start), to: isoOf(end) })
      .then((rows) => {
        if (!alive) return;
        const map = {};
        for (const row of (rows || [])) map[row.iso] = row;
        setDayMap((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, shopId, mode]);
  // Desktop opens on the strip (month behind « Voir plus »); phones keep the month open.
  const [showMonth, setShowMonth] = React.useState(() => window.matchMedia('(max-width: 767px)').matches);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const firstDow = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth()+1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  while (cells.length % 7) cells.push(null);

  const sameDay = (a, b) => a && b &&
    a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  const shift = (n) => setView(new Date(view.getFullYear(), view.getMonth()+n, 1));

  // Cutoff for the active mode
  const cutoffPassed = mode === 'delivery' ? deliveryCutoffPassed : collectCutoffPassed;
  const cutoffLabel  = mode === 'delivery' ? deliveryCutoffLabel  : collectCutoffLabel;
  const cutoffTitle  = cutoffLabel ? wsText('ui.closedAfter', { time: cutoffLabel }) : wsText('ui.cutoffClosed');

  // Today is blocked for the active mode if its cutoff passed
  const todayBlocked = cutoffPassed;

  function isCellDisabled(d) {
    const isPast = d < today;
    if (isPast) return { disabled: true, reason: 'past' };
    const isItToday = sameDay(d, today);
    if (isItToday && todayBlocked) return { disabled: true, reason: 'cutoff' };
    // Lead time: days too close to today for products in basket
    const daysDiff = Math.floor((d - today) / 86400000);
    if ((minLeadDays || 0) > 0 && daysDiff < minLeadDays)
      return { disabled: true, reason: 'lead_time' };
    // API-driven: shop closed, holiday, etc.
    const info = dayMap[isoOf(d)];
    if (info && !info.available) return { disabled: true, reason: info.reason || 'closed' };
    return { disabled: false, reason: null };
  }

  function cellTitle(d, reason) {
    if (reason === 'cutoff')     return cutoffTitle;
    if (reason === 'lead_time')  return wsText('ui.leadDays', { count: minLeadDays });
    if (reason === 'closed')     return wsText('ui.shopClosed');
    if (reason === 'holiday')    return wsText('ui.holiday');
    if (reason === 'exception')  return dayMap[isoOf(d)]?.reason || wsText('ui.exceptionClosed');
    return undefined;
  }

  const todayOk = !todayBlocked && !isCellDisabled(today).disabled;

  const calendar = (
        <div ref={calendarRef} className={`ws-datepop ws-datepop--${mode}${showMonth ? ' is-month' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="ws-datepop__striphead">
            <span className="ws-datepop__striptitle">{mode === 'delivery' ? wsText("ui.delivery") : wsText("ui.collect")}</span>
            {cutoffPassed && cutoffLabel && <span className="ws-datepop__cutoff">{cutoffTitle}</span>}
          </div>
          <div className="ws-datepop__strip">
            {Array.from({ length: 7 }, (_, k) => { const d = new Date(today); d.setDate(d.getDate() + k); return d; }).map((d) => {
              const { disabled, reason } = isCellDisabled(d);
              const isSel = sameDay(d, value);
              return (
                <button key={isoOf(d)} type="button" disabled={disabled} title={cellTitle(d, reason)}
                  className={`ws-daytile${isSel ? ' is-sel' : ''}${disabled ? ' is-off' : ''}`}
                  aria-pressed={isSel}
                  onClick={() => { onChange(d); setOpen(false); }}>
                  <span className="ws-daytile__wd">{wsCap(d.toLocaleDateString(wsLocale(), { weekday: 'short' }))}</span>
                  <strong className="ws-daytile__n">{d.getDate()}</strong>
                  <span className="ws-daytile__m">{d.toLocaleDateString(wsLocale(), { month: 'short' })}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="ws-datepop__more" aria-expanded={showMonth} onClick={() => setShowMonth(v => !v)}>
            {t(showMonth ? 'common.seeLess' : 'common.seeMore')}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={showMonth ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}/></svg>
          </button>
          {showMonth && <>
          <div className="ws-datepop__head">
            <button className="ws-datepop__nav" onClick={() => shift(-1)} aria-label={t('cal.prevMonth')}>‹</button>
            <span className="ws-datepop__title">
              {wsMonthName(view.getMonth(), view.getFullYear())} {view.getFullYear()}
              {loadingDays && <span style={{fontSize:9,opacity:.5,marginLeft:4}}>…</span>}
            </span>
            <button className="ws-datepop__nav" onClick={() => shift(1)} aria-label={t('cal.nextMonth')}>›</button>
          </div>
          <div className="ws-datepop__dow">
            {wsWeekdayNames().map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="ws-datepop__grid">
            {cells.map((d, i) => {
              if (!d) return <span key={i} className="ws-datepop__cell ws-datepop__cell--empty"/>;
              const { disabled, reason } = isCellDisabled(d);
              const isItToday = sameDay(d, today);
              const isSel = sameDay(d, value);
              const cls = ['ws-datepop__cell'];
              if (disabled) cls.push('is-past');
              if (isItToday) cls.push('is-today');
              if (isSel) cls.push('is-sel');
              if (!disabled && dayMap[isoOf(d)]?.available === false) cls.push('is-closed');
              return (
                <button key={i} className={cls.join(' ')} disabled={disabled}
                  title={cellTitle(d, reason)}
                  onClick={() => { onChange(d); setOpen(false); }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="ws-datepop__foot">
            <span>{mode === 'delivery' ? wsText("ui.delivery") : wsText("ui.collect")}</span>
            <button className="ws-datepop__today"
              disabled={!todayOk}
              title={!todayOk && todayBlocked ? cutoffTitle : undefined}
              onClick={() => { onChange(today); setOpen(false); }}> {wsText("ui.today")} </button>
          </div>
          </>}
        </div>
  );

  return (
    <div ref={wrapRef} className="ws-datepill">
      <button className="ws-nav__date" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Pict d={ICONS.cal} s={16}/>
        <span className="ws-nav__date-k">{t(mode === 'delivery' ? 'nav.datepill.delivery' : 'nav.datepill.pickup')}</span>
        <strong><i className="ws-nav__date-sep">· </i>{wsFormatPill(value)}<span className="ws-nav__date-m"> {value.toLocaleDateString(wsLocale(), { month: 'short' })}</span></strong>
        <svg className="ws-nav__date-chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (mobileCalendar ? createPortal(
        <div className="ws-date-backdrop" onClick={() => setOpen(false)}>{calendar}</div>, document.body
      ) : createPortal(<div className="ws-date-desktop-layer">{calendar}</div>, document.body))}
    </div>
  );
}

/* CHOIX D'UN BUREAU : recherche, jamais liste déroulante.
   Une déroulante oblige à parcourir l'inventaire pour retrouver un nom déjà
   connu, et se prête mal au pouce. La saisie NE CRÉE RIEN : seules les sociétés
   déjà validées par l'Atelier apparaissent ; l'absente passe par la demande
   d'ajout, seul chemin qui fasse valider un bureau.
   UN SEUL composant pour les DEUX écrans qui choisissent un bureau. Ils avaient
   chacun leur liste déroulante, et corriger l'une laissait l'autre en arrière
   c'est exactement ce qui vient de se produire. */
/* RECHERCHE D'UN BUREAU : le serveur ne répond qu'à une question posée.
   Aucune liste n'est affichée tant que rien n'est saisi : le carnet d'adresses
   B2B d'une boutique n'a pas à être feuilleté par n'importe quel visiteur
   connecté. On retrouve son employeur parce qu'on le connaît ; on ne découvre
   pas ceux des autres.
   Seuls les bureaux RÉELLEMENT LIVRABLES remontent, leur site porte une
   tournée active. Les autres ne sont pas montrés « avec leur motif » : un
   « bureau sans société rattachée » décrit un état interne du back-office, que
   le client ne peut ni comprendre ni corriger. C'est au franchisé de les
   traiter, et le workflow check-endpoints les lui compte et les lui nomme. */
function OfficeSearchPicker({ chercher, value, onPick, label }) {
  const { t } = wsUseT();
  const [q, setQ] = React.useState('');
  const [hits, setHits] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [cherche, setCherche] = React.useState(false);

  React.useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) { setHits([]); setCherche(false); setBusy(false); return; }
    let vivant = true;
    setBusy(true);
    // Petite attente : une requête par frappe inonderait le serveur et ferait
    // clignoter la liste sous le doigt.
    const t = setTimeout(() => {
      Promise.resolve(chercher(terme))
        .then((r) => { if (vivant) { setHits(Array.isArray(r) ? r : []); setCherche(true); } })
        .catch(() => { if (vivant) { setHits([]); setCherche(true); } })
        .then(() => { if (vivant) setBusy(false); });
    }, 260);
    return () => { vivant = false; clearTimeout(t); };
  }, [q]);

  return (
    <div className="ws-acc__pick">
      <input type="search" className="ws-acc__input" value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('office.searchPh')}
        aria-label={label || wsText("ui.officeSearch")} autoComplete="off"/>
      {q.trim().length < 2 ? (
        <p className="ws-acc__hint" style={{ margin: '8px 2px 0' }}> {wsText("ui.officeSearchHint")} </p>
      ) : busy ? (
        <p className="ws-acc__hint" style={{ margin: '8px 2px 0' }}>{t('common.searchPh')}</p>
      ) : hits.length === 0 && cherche ? (
        <p className="ws-acc__hint" style={{ margin: '8px 2px 0' }}>
          {wsText('ui.officeNoMatch', { query: q.trim() })}
        </p>
      ) : (
        <ul className="ws-acc__pick-list" role="listbox" aria-label={label || wsText('ui.offices')}>
          {hits.map((o) => (
            <li key={o.id}>
              <button type="button" role="option"
                aria-selected={String(value) === String(o.id)}
                className={'ws-acc__pick-item ws-acc__pick-bureau' + (String(value) === String(o.id) ? ' is-picked' : '')}
                onClick={() => onPick(String(o.id))}>
                {/* Le nom est celui de la SOCIÉTÉ ; l'adresse et la tournée
                    servent à la reconnaître, pas à la choisir. */}
                <span className="ws-acc__pick-name">{o.name}</span>
                {o.address ? <span className="ws-acc__pick-site">{o.address}
                  {o.points > 1 ? ' · ' + wsText('ui.deliveryPoints', { count: o.points }) : ''}</span> : null}
                {o.tourName ? <span className="ws-acc__pick-tour">{wsText("ui.route")} {o.tourName}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Mode pill : Ruby (collect) / Abricot (delivery)
function ModePills({ shopId, mode, onChange, collectCutoffPassed, collectCutoffLabel, deliveryCutoffPassed, deliveryCutoffLabel }) {
  const { t } = wsUseT();
  const [hover, setHover] = React.useState(false);
  const tipAnchor = React.useRef(null);
  const [tipPosition, setTipPosition] = React.useState({});
  const tipId = React.useId();
  React.useEffect(() => {
    if (!hover) return;
    const position = () => {
      const rect = tipAnchor.current?.getBoundingClientRect();
      if (!rect) return;
      setTipPosition({top: rect.bottom + 12, left: Math.max(8, Math.min(rect.right - 216, window.innerWidth - 224))});
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [hover]);
  const delivTitle = deliveryCutoffPassed
    ? wsText('ui.deliveryAfter', { time: deliveryCutoffLabel })
    : undefined;
  const collTitle = collectCutoffPassed
    ? wsText('ui.collectAfter', { time: collectCutoffLabel })
    : undefined;
  const effMode = mode;
  return (
    <div className="ws-modewrap">
    <div className="ws-modes" role="tablist" aria-label={t('nav.modeAria')}>
      <span className="ws-modes__indicator" data-mode={effMode} aria-hidden="true"/>
      <button className={`ws-mode ws-mode--collect${mode === 'collect' ? ' is-active' : ''}${collectCutoffPassed ? ' is-disabled' : ''}`}
        onClick={() => onChange('collect')} role="tab" aria-selected={mode === 'collect'} aria-label={t('nav.mode.collect')}
        title={collTitle}>
        <Pict d={ICONS.bag} s={14}/>
        <span className="ws-mode__lbl-full">{t('nav.mode.collect')}</span>
        {collectCutoffPassed && <span className="ws-mode__cutoff"> · {t('nav.mode.closed')}</span>}
      </button>
      {/* Pas d'attribut `disabled` : un bouton désactivé n'émet aucun clic, donc
          le motif du refus ne pouvait jamais s'afficher : on retombait sur le
          bouton qui « ne fait rien ». L'apparence reste celle d'une option
          indisponible (is-disabled) et aria-disabled l'annonce aux lecteurs
          d'écran, mais le clic sert enfin à dire POURQUOI. */}
      <button className={`ws-mode ws-mode--delivery${mode === 'delivery' ? ' is-active' : ''}${deliveryCutoffPassed ? ' is-disabled' : ''}`}
        onClick={() => onChange('delivery')} role="tab" aria-selected={mode === 'delivery'} aria-label={t('nav.mode.delivery')}
        aria-disabled={deliveryCutoffPassed || undefined}
        title={delivTitle}>
        <Pict d={ICONS.truck} s={14}/>
        <span className="ws-mode__lbl-full">{t('nav.mode.delivery')}</span>
        {deliveryCutoffPassed && <span className="ws-mode__cutoff"> · {t('nav.mode.closed')}</span>}
      </button>
      </div>
      {/* « i » apricot : pas encore de bureau ? → ouvre le formulaire zone (landing).
          Il est SORTI du rail : depuis que le sélecteur est un segment à deux
          colonnes, un troisième enfant tombait en seconde ligne et débordait
          sous le rail. Frère du rail, il reste à côté sans le déformer. */}
      <span className="ws-office-info-wrap"
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <button ref={tipAnchor} className="ws-nav__office-info" type="button" aria-label={t('office.notYet')} aria-describedby={hover ? tipId : undefined}
          onFocus={() => setHover(true)} onBlur={() => setHover(false)} onKeyDown={event => { if (event.key === 'Escape') setHover(false); }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); const url = new URL(import.meta.env.BASE_URL + 'landing/livraison-bureau.html', window.location.origin); url.searchParams.set('shop', String(shopId)); url.searchParams.set('lang', window.WSI18n?.getLang?.() || 'en'); window.location.assign(url.href); }}>
          <svg className="ws-nav__office-info-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M2 21h14"/><path d="M8 8h2M8 12h2M8 16h2"/><path d="M19 9v6M16 12h6"/>
          </svg>
        </button>
        {hover && createPortal(
          <span id={tipId} role="tooltip" className="ws-office-tip" style={{ top: tipPosition.top, left: tipPosition.left }}>
            {t('office.notYetTip')}
          </span>, document.body
        )}
      </span>
    </div>
  );
}

// Allergen badges : uses AllergensRow from webshop-allergens.jsx (line-art icons).
function Allergens({ list }) {
  if (!list || !list.length) return null;
  if (window.AllergensRow) return <window.AllergensRow list={list} size={14} max={5}/>;
  return null;
}

// =========================================================================
const PORTION_SHAPES = [
  { v: 'huitieme', d: <path d="M12 12L12 3 A9 9 0 0 1 18.36 5.64 Z" fill="currentColor"/>, name: '1/8' },
  { v: 'quart',  d: <path d="M12 12L12 3 A9 9 0 0 1 21 12 Z" fill="currentColor"/>,        name: '1/4' },
  { v: 'demi',   d: <path d="M12 3 A9 9 0 0 1 12 21 Z" fill="currentColor"/>,              name: '1/2' },
  { v: 'entier', d: <circle cx="12" cy="12" r="9" fill="currentColor"/>,                   get name() { return wsText("ui.whole"); } },
];

// Options de portion d'un produit : UNIQUEMENT les prix explicites de l'ERP
// (product.portionOptions = [{v,label,price}] servis par le catalogue
// shop_product_portion_price). Go-live « vraies données ou bug » : le repli
// « prix de base × facteur (0.27/0.52/0.15) » est SUPPRIMÉ, il affichait et
// facturait des prix de portion que la boutique n'a jamais fixés. Sans prix
// ERP de portion, seule la pièce ENTIÈRE (prix réel) est proposée.
function portionOptionList(p) {
  if (Array.isArray(p?.portionOptions) && p.portionOptions.length) {
    return p.portionOptions.map((o) => {
      const sh = PORTION_SHAPES.find((s) => s.v === o.v) || PORTION_SHAPES[PORTION_SHAPES.length - 1];
      return { v: o.v, d: sh.d, name: sh.name, price: Number(o.price) || 0, id_product_portion: o.id_product_portion ?? null };
    });
  }
  const entier = PORTION_SHAPES.find((s) => s.v === 'entier');
  return [{ v: 'entier', d: entier.d, name: entier.name, price: p?.price || 0 }];
}

// Libellé des portions d'une carte produit : types proposés avec le PRIX de
// chaque portion : ex. « Entière €24.00 · 1/2 €14.90 · 1/4 €8.90 ».
function portionPriceHint(p) {
  return portionOptionList(p).map((o) => `${o.name} ${wsCurrency(o.price)}`).join(' · ');
}

// Single "portions available" glyph used on the product card, a quartered
// disc that hints at the slicing without committing to a specific portion.
function PortionGlyph({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="12" y1="3"  x2="12" y2="21" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="3"  y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

// Portion option list inside the product modal, same toggle/button UX as
// other option groups (pdm-optrow + pdm-seg). Each button shows icon +
// portion name + computed price.
function PortionOptions({ value, onChange, product }) {
  const { t } = wsUseT();
  // Options du produit : prix EXPLICITES ERP quand fournis, sinon facteurs.
  const shapes = portionOptionList(product);
  return (
    <div className="pdm-optrow">
      <div className="pdm-optrow__head">
        <span className="pdm-opt__label">{t('pd.portion')}</span>
        <span className="pdm-opt__req">{t('pd.required')}</span>
      </div>
      <div className="pdm-seg pdm-seg--portions" role="radiogroup" aria-label={t('pd.portion')} style={{ '--pdm-seg-n': shapes.length }}>
        {shapes.map((o) => {
          const on = value === o.v;
          const price = o.price;
          return (
            <button key={o.v}
              type="button"
              role="radio"
              aria-checked={on}
              className={'pdm-seg__btn pdm-seg__btn--portion' + (on ? ' is-on' : '')}
              {...wsTap(() => onChange(o.v))}>
              <span className="pdm-seg__pico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">{o.d}</svg>
              </span>
              <span className="pdm-seg__lbl">{o.name}</span>
              <span className="pdm-seg__delta">{wsCurrency(price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// PRODUCT DETAIL MODAL : options, upsells, bundles
// =========================================================================
function wsPromotionItemsSummary(promotion, product, t, rewardCost = null) {
  const portions = { WHOLE: '1/1', THREE_QUARTERS: '3/4', TWO_THIRDS: '2/3', ONE_HALF: '1/2', ONE_THIRD: '1/3', ONE_QUARTER: '1/4', ONE_SIXTH: '1/6', ONE_EIGHTH: '1/8' };
  const label = (item, quantity) => {
    const portion = portions[item.product_portion_type] || item.product_portion_label || (item.id_product_portion == null ? '1/1' : '');
    const name = item.product_name || (Number(item.id_product) === Number(product.id) ? product.name : `#${item.id_product}`);
    return `${Number(quantity || 0)} × ${portion && portion !== '1/1' ? `${portion} ` : ''}${name}`;
  };
  const summary = (promotion.items || []).map((item) => {
    if (promotion.promotion_type !== 'BUY_X_GET_Y') return label(item, item.quantity);
    const rewardKey = promotion.reward?.type === 'FREE' && !(Number(rewardCost) > 0) ? 'promotion.inline.receiveFree' : 'promotion.inline.receiveReward';
    if (item.role === 'trigger_and_reward' && item.trigger_quantity != null && item.reward_quantity != null) {
      return `${t('promotion.inline.buy', { items: label(item, item.trigger_quantity) })} + ${t(rewardKey, { items: label(item, item.reward_quantity) })}`;
    }
    if (item.role === 'trigger') return t('promotion.inline.buy', { items: label(item, item.quantity) });
    if (item.role === 'reward') return t(rewardKey, { items: label(item, item.quantity) });
    return label(item, item.quantity);
  }).join(' · ');
  return promotion.reward?.delivery_mode === 'VOUCHER' ? `${summary} · ${t('promotion.inline.voucherReward')}` : summary;
}

function wsFractionalPromotionRule(promotion, product, t) {
  if (promotion.promotion_type !== 'BUY_X_GET_Y' || promotion.trigger?.quantity_unit !== 'PIECE_FRACTION') return null;
  const rewardItems = (promotion.items || []).filter((item) => item.role === 'reward' || item.role === 'trigger_and_reward')
    .map((item) => ({ ...item, role: 'reward', quantity: item.role === 'trigger_and_reward' ? item.reward_quantity : item.quantity }));
  if (!rewardItems.length || rewardItems.some((item) => item.quantity == null)) return null;
  const examples = [];
  if (promotion.trigger.any_portion && Number(promotion.trigger.quantity) === 1) {
    const options = new Set((product.portionOptions || [{ v: 'entier' }]).map((option) => option.v));
    if (options.has('entier')) examples.push('1 × 1/1');
    if (options.has('demi')) examples.push('2 × 1/2');
    if (options.has('quart')) examples.push('4 × 1/4');
    if (options.has('huitieme')) examples.push('8 × 1/8');
    if (options.has('demi') && options.has('quart')) examples.push('1 × 1/2 + 2 × 1/4');
  }
  return {
    description: t('promotion.inline.mixDescription', { quantity: Number(promotion.trigger.quantity) }),
    examples: examples.length ? t('promotion.inline.mixExamples', { examples: examples.join(' · ') }) : '',
    reward: wsPromotionItemsSummary({ ...promotion, items: rewardItems }, product, t),
  };
}

function FractionalPromotionRule({ promotion, product, t }) {
  const rule = wsFractionalPromotionRule(promotion, product, t);
  if (!rule) return null;
  return <span className="pdm-promotion__rule">
    <strong>{t('promotion.inline.mixTitle')}</strong>
    <span>{rule.description}</span>
    {rule.examples && <span>{rule.examples}</span>}
    <span>{t('promotion.inline.mixReward', { reward: rule.reward })}</span>
  </span>;
}

function wsPromotionBenefit(promotion) {
  return Number(promotion.discount_total || 0) > 0
    ? `−${wsCurrency(Number(promotion.discount_total))}`
    : (promotion.bundle_price != null ? wsCurrency(Number(promotion.bundle_price)) : '');
}

function wsPromotionDateLabel(value, lang, timezone, compact = false) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(lang || 'fr', {
      day: compact ? '2-digit' : 'numeric', month: compact ? '2-digit' : 'long', year: compact ? '2-digit' : 'numeric', ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch (_) {
    return '';
  }
}

function wsPromotionWeekday(day, lang) {
  try {
    // Weekday labels are fixed calendar values, independent of browser timezone.
    return new Intl.DateTimeFormat(lang || 'fr', { weekday: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2024, 0, 1 + Math.max(0, Number(day || 1) - 1), 12)))
      .replace(/\.$/, '');
  } catch (_) {
    return '';
  }
}

function wsUpcomingPromotionValidity(promotion, lang, t, compact = false) {
  const from = wsPromotionDateLabel(promotion.availability_valid_from, lang, promotion.timezone, compact);
  const to = wsPromotionDateLabel(promotion.availability_valid_to, lang, promotion.timezone, compact);
  if (compact && (from || to)) return `${from || '…'}–${to || '…'}`;
  if (from && to) return t('promotion.inline.validBetween', { from, to });
  if (from) return t('promotion.inline.validFrom', { from });
  if (to) return t('promotion.inline.validUntil', { to });
  return '';
}

function UpcomingPromotionSchedule({ promotion, lang, t }) {
  const schedule = Array.isArray(promotion.availability_schedule) ? promotion.availability_schedule : [];
  const groups = [];
  schedule.forEach((entry) => {
    const day = Number(entry.day_of_week);
    if (!Number.isInteger(day) || day < 1 || day > 7) return;
    const from = String(entry.time_from || '').slice(0, 5);
    const to = String(entry.time_to || '').slice(0, 5);
    let group = groups.find((item) => item.from === from && item.to === to);
    if (!group) { group = { from, to, days: [] }; groups.push(group); }
    if (!group.days.includes(day)) group.days.push(day);
  });
  const from = wsPromotionDateLabel(promotion.availability_valid_from, lang, promotion.timezone);
  const to = wsPromotionDateLabel(promotion.availability_valid_to, lang, promotion.timezone);
  const rows = groups.length ? groups : [{ days: [1, 2, 3, 4, 5, 6, 7], from: '', to: '' }];
  return <span className="pdm-promotion__schedule">
    {rows.map((group, index) => <span className="pdm-promotion__availability" key={`${group.from}-${group.to}`}>
      <span className="pdm-promotion__days-date">
      <span className="pdm-promotion__weekdays" role="img" aria-label={t('promotion.inline.availableDays', {
        schedule: [...group.days].sort((a, b) => a - b).map(day => wsPromotionWeekday(day, lang)).join(', '),
      })}>
        {[1, 2, 3, 4, 5, 6, 7].map(day => {
          const label = wsPromotionWeekday(day, lang);
          return <span key={day} className={`pdm-promotion__day${group.days.includes(day) ? ' is-active' : ''}`}
            title={label} aria-hidden="true">{label.slice(0, 1).toLocaleUpperCase(lang || 'fr')}</span>;
        })}
      </span>
      {index === 0 && (from || to) && <strong className="pdm-promotion__validity" title={from ? t('promotion.inline.availableFrom', { from }) : t('promotion.inline.validUntil', { to })}>{from ? t('promotion.inline.availableFrom', { from }) : t('promotion.inline.validUntil', { to })}</strong>}
      </span>
      {group.from && group.to && <span className="pdm-promotion__hours">{group.from}–{group.to}</span>}
    </span>)}
    {from && to && <small className="pdm-promotion__validity-end">{t('promotion.inline.validUntil', { to })}</small>}
  </span>;
}

function UpcomingPromotionCard({ promotion, lang, t }) {
  return <div className="pdm-promotion__card pdm-promotion__card--upcoming" aria-disabled="true">
    <span className="pdm-promotion__body">
      <strong>{promotion.name}</strong>
      <UpcomingPromotionSchedule promotion={promotion} lang={lang} t={t}/>
    </span>
  </div>;
}

function ProductQuantityControl({ quantity, stockLimit, onChange, t, bulkQuantityEnabled = false }) {
  const [lastPreset, setLastPreset] = React.useState(null);
  const maximum = stockLimit ?? 99;
  return <>
    <div className="pdm-quick-qty" role="group" aria-label={t('qty.quickTitle')}>
      <span className="pdm-quick-qty__title">{t('qty.quickTitle')}</span>
      <div className="pdm-quick-qty__buttons">
        {(bulkQuantityEnabled ? [1, 5, 10, 25] : [1]).map(value => {
          const repeat = lastPreset === value;
          const label = t(repeat ? 'qty.add' : 'qty.set', { count: value });
          return <button key={value} type="button" title={label} aria-label={label}
            disabled={value > maximum || (repeat && quantity >= maximum)}
            {...wsTap(() => {
              onChange(q => repeat ? Math.min(q + value, maximum) : value);
              setLastPreset(value);
            })}>{value}</button>;
        })}
      </div>
    </div>
    <div className="pdm-qty-stack">
      <div className="pdm-qty">
        <button type="button" className="pdm-qty__btn" {...wsTap(() => onChange(q => Math.max(1, q - 1)))}
          disabled={quantity <= 1} aria-label={t('qty.dec')}>−</button>
        <span className="pdm-qty__val" aria-live="polite" aria-atomic="true">{quantity}</span>
        <button type="button" className="pdm-qty__btn" {...wsTap(() => onChange(q => Math.min(q + 1, maximum)))}
          disabled={quantity >= maximum} aria-label={t('qty.inc')}>+</button>
      </div>
      <div className="pdm-qty-subtract" role="group" aria-label={t('qty.dec')}>
        {[1, 5, 10].map(value => <button key={value} type="button" disabled={quantity <= 1}
          aria-label={t('qty.subtract', { count: value })}
          {...wsTap(() => onChange(q => Math.max(1, q - value)))}>−{value}</button>)}
      </div>
    </div>
  </>;
}

function ProductDetail({ open, product, mode, activeVoucher, onClose, onAdd, onPromotionPreview, promotionSuggestions = [], upcomingPromotionSuggestions = [], promotionLocked = false, promotionPreviewPending = false, optionsLoading = false, promotionProducts = [], stock, basketUnits = 0 }) {
  const { t, lang } = wsUseT();
  const voucherPortions=voucherProductPortions(activeVoucher,product);
  // ── Hooks (must run unconditionally; never gate behind early-return) ──
  const initSelections = React.useMemo(() => {
    const out = {};
    if (product?.options) {
      for (const o of product.options) if (o.required) out[o.id] = o.choices[0]?.id;
    }
    return out;
  }, [product]);
  const [personalChoices, setPersonalChoices] = React.useState([]);
  const [sel, setSel]                 = React.useState(initSelections);
  const [bundleId, setBundleId]       = React.useState(null);
  const [bundleSlots, setBundleSlots] = React.useState({});
  const [upsellIds, setUpsellIds]     = React.useState({});
  const [qty, setQty]                 = React.useState(1);
  const [portion, setPortion]         = React.useState('entier');
  const [offerOn, setOfferOn]         = React.useState(false); // bundle ERP choisi (fiche)
  const [openOpts, setOpenOpts]       = React.useState({}); // accordion state per option id
  const [carIdx, setCarIdx]           = React.useState(0);
  const [pulse, setPulse]             = React.useState(0);  // re-trigger price pop animation
  const [activeOpt, setActiveOpt]     = React.useState(null); // currently focused option id
  const [selectedPromotionId, setSelectedPromotionId] = React.useState(null);
  const initialPromotionChosen = React.useRef(false);
  const [rewardChoiceKey, setRewardChoiceKey] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState('');
  const carRef = React.useRef(null);
  const optRefs = React.useRef({}); // option-id -> DOM node

  // Compute the bundle list ONCE per product (pre-prepended "À la carte").
  const bundleList = React.useMemo(() => {
    if (!product?.has_menu_options || !product.available_bundles) return [];
    return [
      { id: null, name: t('pd.alaCarte'), description: t('pd.alaCarteDesc'), price_modifier: 0, slots: [], advantages: [], included: [] },
      ...product.available_bundles.filter(b => !b.menu_id || Number(b.base_portion_id || 0) === Number(portionOptionList(product).find(o => o.v === portion)?.id_product_portion || 0)),
    ];
    // `lang` en dépendance : « À la carte » et sa description viennent de la
    // table de traduction. Sans elle, changer de langue modale ouverte laissait
    // la première formule dans la langue précédente.
  }, [product, lang, portion]);

  // Reset state when the product changes, and auto-open required option groups + auto-pick recommended bundle.
  React.useEffect(() => {
    setSel(initSelections);
    setPersonalChoices([]);
    setUpsellIds({});
    setQty(1);
    // Portion par défaut = la PREMIÈRE option proposée (l'entière quand les
    // options ERP sont fournies, sinon le comportement historique).
    setPortion((portionOptionList(product).find((o) => product?.initial_promotion_portion_id !== undefined && (o.id_product_portion == null ? null : Number(o.id_product_portion)) === (product.initial_promotion_portion_id == null ? null : Number(product.initial_promotion_portion_id))) || portionOptionList(product).find((o) => o.v === 'entier') || portionOptionList(product)[0])?.v || 'entier');
    setOfferOn(false);   // le produit seul par défaut ; le bundle se choisit
    setBundleSlots({});
    setSelectedPromotionId(null);
    initialPromotionChosen.current = false;
    setRewardChoiceKey(null);
    setAddError('');
    setCarIdx(0);
    if (product?.options) {
      const initOpen = {};
      for (const o of product.options) initOpen[o.id] = !!o.required;
      setOpenOpts(initOpen);
      // Initial active option = first one (helps highlight on open)
      const firstUnanswered = product.options.find((o) => o.required && !initSelections[o.id]) || product.options[0];
      setActiveOpt(firstUnanswered ? firstUnanswered.id : null);
    } else {
      setOpenOpts({});
      setActiveOpt(null);
    }
    // Formule présélectionnée : la recommandée, SINON l'unique formule s'il
    // n'y en a qu'une : ses étapes s'ouvrent d'emblée. Sur mobile, le tap
    // « pour rien » qui ne faisait qu'ouvrir la carte passait pour un raté
    // (constaté : « je dois cliquer plusieurs fois pour que ça s'ouvre »).
    const rec = product?.initial_promotion_id ? null : (product?.available_bundles?.find((b) => b.recommended && !b.menu_id)
      || (product?.available_bundles?.length === 1 && !product.available_bundles[0].menu_id ? product.available_bundles[0] : null));
    setBundleId(rec ? rec.id : null);
    if (rec) {
      const recIdx = 1 + product.available_bundles.findIndex((b) => b.id === rec.id);
      if (recIdx >= 0) setCarIdx(recIdx);
    }
  }, [product, initSelections]);

  // Lock body scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc); };
  }, [open, onClose]);

  // ── Derived (after hooks) ─────────────────────────────────────────────
  const accentVar = mode === 'delivery' ? '#c17a2a' : 'var(--color-primary)';
  // Bloqué en livraison bureau (« apricot ») si le produit n'est pas livré par la
  // boutique (no_delivery) OU s'il est désactivé pour ce canal côté marque
  // (office_delivery === false). Absent/undefined = disponible (rétro-compat).
  const deliveryBlocked = mode === 'delivery' && (!!product?.no_delivery || product?.office_delivery === false);

  let unit = product?.price || 0;
  // Portion RÉSOLUE : la portion choisie si elle existe dans la liste, sinon
  // on retombe sur l'Entière (jamais sur une portion fantôme). Prix ET libellé
  // dérivent de CETTE option -> impossible d'afficher « 1/4 » à prix d'entière.
  const _plist = product?.portions ? portionOptionList(product) : [];
  const portOpt = product?.portions
    ? (_plist.find((o) => o.v === portion) || _plist.find((o) => o.v === 'entier') || _plist[0] || null)
    : null;
  const deliveryStockLeft = availablePortions(stock, portOpt?.v, basketUnits);
  const availabilityMessage = stockMessageKey(stock);
  const uninitialized = stock?.status === 'uninitialized';
  if (portOpt) unit = portOpt.price;
  if (product?.options) {
    for (const o of product.options) {
      const choiceId = sel[o.id];
      if (!choiceId) continue;
      const choice = o.choices.find((c) => c.id === choiceId);
      if (choice?.delta) unit += choice.delta;
    }
  }
  const activeBundle = bundleId && product?.available_bundles
    ? product.available_bundles.find((b) => b.id === bundleId && (!b.menu_id || Number(b.base_portion_id || 0) === Number(portOpt?.id_product_portion || 0)))
    : null;
  let bundleDelta = 0;
  if (activeBundle) {
    bundleDelta += activeBundle.menu_id ? activeBundle.base_total - unit : (activeBundle.price_modifier || 0);
    for (const slot of (activeBundle.slots || [])) {
      for (const cid of slotPicked(slot)) {
        const c = slot.choices.find((x) => x.id === cid);
        if (c?.delta) bundleDelta += c.delta;
      }
    }
  }

  const selectedPromotionBase = !activeBundle && promotionSuggestions.find((item) => item.is_available !== false && Number(item.id_promotion) === Number(selectedPromotionId)) || null;
  const rewardOptions = (selectedPromotionBase?.reward_options || []).flatMap(item => {
    const choiceProduct = promotionProducts.find(entry => Number(entry.id) === Number(item.id_product) && !entry.has_personalization);
    const portionOptions = choiceProduct ? portionOptionList(choiceProduct) : [];
    const regularOption = portionOptions.find(option => (option.id_product_portion == null ? null : Number(option.id_product_portion)) === (item.id_product_portion == null ? null : Number(item.id_product_portion)));
    if (!choiceProduct || !portionOptions.some(option => (option.id_product_portion == null ? null : Number(option.id_product_portion)) === (item.id_product_portion == null ? null : Number(item.id_product_portion)))) return [];
    return [{ ...item, regular_price: regularOption ? Number(regularOption.price) * Number(item.quantity || 1) : null, product_name: choiceProduct.name || item.product_name,
      image_src: choiceProduct.img || getPlaceholder(choiceProduct), image_fallback: getPlaceholder(choiceProduct) }];
  });
  const defaultReward = selectedPromotionBase?.items?.find(item => item.role === 'reward' || item.role === 'trigger_and_reward');
  const rewardChoice = rewardOptions.find(item => `${item.id_product}-${item.id_product_portion ?? 0}` === rewardChoiceKey)
    || rewardOptions.find(item => Number(item.id_product) === Number(defaultReward?.id_product)
      && (item.id_product_portion ?? null) === (defaultReward?.id_product_portion ?? null));
  const selectedPromotion = selectedPromotionBase && rewardChoice?.suggestion
    ? { ...selectedPromotionBase, ...rewardChoice.suggestion } : selectedPromotionBase;
  const upsellDelta = Object.entries(upsellIds).reduce((t, [id, on]) => {
    if (!on || !product?.upsells) return t;
    const u = product.upsells.find((x) => x.id === id);
    return t + (u?.delta || 0);
  }, 0);
  // BUNDLE ERP choisi : son prix REMPLACE le prix unitaire (portion, options,
  // formule et suppléments compris — le bundle fixe sa composition).
  const bundleOffer = product?.bundleOffer || null;
  const offerPicked = offerOn && !!bundleOffer;
  const personalGroups = product?.personalization?.groups || [];
  const personalEnabled = !activeBundle && !selectedPromotion && !offerPicked && !portOpt?.id_product_portion && !product?.is_weighted;
  const personalOptions = personalEnabled ? personalGroups.flatMap(g => g.options.filter(o => personalChoices.includes(o.id))) : [];
  const personalDelta = personalOptions.reduce((sum,o)=>sum+Number(o.price_delta),0);
  const unitTotal = offerPicked ? bundleOffer.price : (unit + bundleDelta + upsellDelta + personalDelta);
  const grossTotal = unitTotal * qty;
  const total = grossTotal;
  const displayedTotal = selectedPromotion ? wsPromotionDisplayTotal(selectedPromotion, total) : total;

  // Validity
  let valid = !personalEnabled || (!product?.personalization_error && !product?.personalization?.unavailable);
  if (personalEnabled) for (const group of personalGroups) {
    const count=group.options.filter(o=>personalChoices.includes(o.id)).length;
    if(count<group.min_select || count>group.max_select) valid=false;
  }
  if (product?.options) {
    for (const o of product.options) if (o.required && !sel[o.id]) { valid = false; break; }
  }
  if (activeBundle) {
    for (const slot of (activeBundle.slots || [])) {
      if (slot.required && slotPicked(slot).length < Math.max(1, slot.min_select || 1)) { valid = false; break; }
    }
  }

  React.useEffect(() => {
    if (!open || !product || product.is_weighted || offerPicked || activeBundle) return;
    return onPromotionPreview?.({
      productId: product.id,
      quantity: qty,
      id_product_portion: portOpt?.id_product_portion ?? null,
    });
  }, [open, product?.id, qty, portOpt?.id_product_portion, valid, offerPicked, activeBundle?.id, onPromotionPreview]);

  React.useEffect(() => {
    setSelectedPromotionId((current) => !promotionLocked && promotionSuggestions.some((item) => item.is_available !== false && Number(item.id_promotion) === Number(current)) ? current : null);
  }, [promotionSuggestions, promotionLocked]);

  React.useEffect(() => {
    if (optionsLoading || promotionLocked || initialPromotionChosen.current || !product?.initial_promotion_id) return;
    const initial = promotionSuggestions.find(item => item.is_available !== false
      && Number(item.id_promotion) === Number(product.initial_promotion_id));
    if (!initial) return;
    initialPromotionChosen.current = true;
    setBundleId(null);
    setSelectedPromotionId(initial.id_promotion);
  }, [product, promotionSuggestions, promotionLocked, optionsLoading]);

  React.useEffect(() => { setRewardChoiceKey(null); }, [selectedPromotionId]);

  // Re-pulse price on any change
  React.useEffect(() => { setPulse((p) => p + 1); }, [unit, bundleDelta, upsellDelta, qty, bundleId, offerPicked, selectedPromotionId, displayedTotal]);

  // Sync carIdx to scroll position (snap-based feel)
  function onCarScroll(e) {
    const el = e.currentTarget;
    if (!el || !el.firstElementChild) return;
    const cardW = el.firstElementChild.getBoundingClientRect().width + 12; // card + gap
    const idx = Math.round(el.scrollLeft / cardW);
    if (idx !== carIdx && idx >= 0 && idx < bundleList.length) setCarIdx(idx);
  }

  function setOpt(oid, cid)        {
    setSel((s) => ({ ...s, [oid]: cid }));
    // Glide the just-selected option group to the top of the modal scroll area
    // so it stays visible as a "settled" choice while the customer can keep
    // scrolling freely to make further choices.
    setActiveOpt(oid);
    setTimeout(() => {
      const sc = scrollRef.current;
      glideIfHidden(optRefs.current[oid], sc, (elRect, scRect) => sc.scrollTop + (elRect.top - scRect.top) - 8);
    }, IS_TOUCH ? 30 : 180);
  }
  function setSlot(slotId, choiceId) { setBundleSlots((s) => ({ ...s, [slotId]: choiceId })); }
  // Rubrique multi (« 2 choix ») : le tap AJOUTE ou RETIRE, il ne remplace
  // pas : c'était le blocage constaté : le 2e choix écrasait le 1er et la
  // formule ne se complétait jamais. Plafond = max_select.
  function toggleSlotMulti(slotId, choiceId, maxSel) {
    setBundleSlots((s) => {
      const cur = Array.isArray(s[slotId]) ? s[slotId] : (s[slotId] ? [s[slotId]] : []);
      if (cur.includes(choiceId)) return { ...s, [slotId]: cur.filter((x) => x !== choiceId) };
      if (cur.length >= Math.max(1, maxSel || 1)) return s;
      return { ...s, [slotId]: [...cur, choiceId] };
    });
  }
  function slotIsMulti(slot) { return (slot.max_select || 1) > 1 || slot.kind === 'multi'; }
  function slotPicked(slot) {
    const v = bundleSlots[slot.id];
    return Array.isArray(v) ? v : (v ? [v] : []);
  }
  // Ne scrolle que si l'élément déborde de la zone visible. Le glissement
  // systématique déplaçait le contenu SOUS LE DOIGT juste après un tap : le
  // tap suivant tombait à côté : la cause des « miss-clicks » constatés sur
  // téléphone. Une cible déjà visible reste où elle est.
  function glideIfHidden(el, sc, computeTarget) {
    if (!el || !sc) return;
    const elRect = el.getBoundingClientRect();
    const scRect = sc.getBoundingClientRect();
    const fullyVisible = elRect.top >= scRect.top && elRect.bottom <= scRect.bottom;
    if (fullyVisible) return;
    sc.scrollTo({ top: Math.max(0, computeTarget(elRect, scRect)), behavior: IS_TOUCH ? 'auto' : 'smooth' });
  }
  function pickBundle(bid) {
    if (bid === bundleId) return;
    setBundleId(bid);
    setSelectedPromotionId(null);
    setBundleSlots({});
    // Glide the picked bundle card so its expanded body sits centered in the
    // modal scroll area, after the slot pickers animate open.
    const idx = bundleList.findIndex((b) => b.id === bid);
    setCarIdx(idx >= 0 ? idx : 0);
    setTimeout(() => {
      const el = carRef.current; if (!el) return;
      if (idx < 0) return;
      const card = el.children[idx]; if (!card) return;
      const sc = scrollRef.current; if (!sc) return;
      glideIfHidden(card, sc, (cardRect, scRect) =>
        sc.scrollTop + (cardRect.top - scRect.top) + (card.offsetHeight / 2) - (sc.clientHeight / 2));
    }, IS_TOUCH ? 30 : 340);
  }
  function toggleUpsell(id)        { setUpsellIds((s) => ({ ...s, [id]: !s[id] })); }
  function changeQuantity(updater) {
    setSelectedPromotionId(null);
    setQty(updater);
  }
  // Un accordéon qui vient de s'ouvrir (animation ~300 ms) ne doit pas se
  // REFERMER sur un re-tap réflexe « ça n'a pas marché » : anti-rebond.
  const lastToggle = React.useRef({});
  function toggleOpt(oid)          {
    const now = performance.now();
    if (lastToggle.current[oid] && now - lastToggle.current[oid] < 350) return;
    lastToggle.current[oid] = now;
    setOpenOpts((s) => {
      const next = { ...s, [oid]: !s[oid] };
      // After the accordion finishes opening, glide its body to vertical center
      // of the modal scroll area so the just-revealed options feel balanced.
      if (next[oid]) {
        setTimeout(() => {
          const sc = scrollRef.current;
          const el = optRefs.current[oid];
          glideIfHidden(el, sc, (elRect, scRect) =>
            sc.scrollTop + (elRect.top - scRect.top) + (el.offsetHeight / 2) - (sc.clientHeight / 2));
        }, IS_TOUCH ? 30 : 320);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (adding || (selectedPromotion && promotionPreviewPending)) return;
    if (!valid || product.is_weighted || deliveryBlocked || uninitialized || (deliveryStockLeft !== null && qty > deliveryStockLeft)) return;
    const optionLabels = (product.options || [])
      .map((o) => { const c = o.choices.find((x) => x.id === sel[o.id]); return c ? c.label : null; })
      .filter(Boolean);
    if (activeBundle) {
      optionLabels.push(t('pd.bundle') + ' · ' + activeBundle.name);
      for (const slot of (activeBundle.slots || [])) {
        for (const cid of slotPicked(slot)) {
          const c = slot.choices.find((x) => x.id === cid);
          if (c) optionLabels.push(slot.label + ' · ' + c.label);
        }
      }
    }
    Object.entries(upsellIds).forEach(([id, on]) => {
      if (!on) return;
      const u = product.upsells.find((x) => x.id === id);
      if (u) optionLabels.push('+ ' + u.label);
    });
    if (offerPicked) {
      optionLabels.length = 0;   // le bundle fixe sa composition : seuls ses articles
      for (const it of bundleOffer.items) optionLabels.push(it.qty + ' × ' + it.name + (it.portionLabel ? ', ' + it.portionLabel : ''));
    }
    setAdding(true);
    setAddError('');
    try {
      const accepted = await onAdd({
        productId: product.id,
        ...(personalEnabled && personalChoices.length>0 ? {personalization_selection:{version:product.personalization.version,option_ids:personalChoices}} : {}),
        ...(activeBundle?.menu_id ? {
          menu_selection: { menu_id: activeBundle.menu_id, version: activeBundle.version, formula_id: activeBundle.id,
            steps: activeBundle.slots.map(slot => ({step_id: slot.id, choice_ids: slotPicked(slot)})) },
          lead_time: Math.max(product.lead_time || 0, ...activeBundle.slots.flatMap(slot => slot.choices.filter(c => slotPicked(slot).includes(c.id)).map(c => c.lead_time || 0))),
          menu_product_ids: [product.id, ...activeBundle.slots.flatMap(slot => slot.choices.filter(c => slotPicked(slot).includes(c.id)).map(c => c.product_id))],
        } : {}),
        // Libellé dérivé de la portion RÉSOLUE (portOpt) : cohérent avec le prix.
        // Pas de suffixe pour l'Entière.
        name: offerPicked ? bundleOffer.name : (activeBundle?.menu_id ? `${activeBundle.menu_name} · ${product.name}` : product.name) + (portOpt && portOpt.v !== 'entier' ? ', ' + portOpt.name : ''),
        qty,
        price: qty > 0 ? total / qty : (unit + bundleDelta + upsellDelta),
        options: [...optionLabels.map((label) => ({ label })), ...personalOptions.map(o=>({label:o.name}))],
        /* Composition du menu par IDENTIFIANTS, en plus des libelles d'affichage.
           Elle restait dans le composeur : le panier ne portait que des libelles,
           et la commande ne pouvait donc ecrire aucune ligne pour les choix du
           menu : la boutique voyait « Menu » sans savoir quoi preparer.
           C'est le serveur qui resout ces identifiants en produits ; le navigateur
           ne decide pas de ce qui est vendu. */
        bundleId: offerPicked ? null : (activeBundle ? activeBundle.id : null),
        bundleSlots: offerPicked ? {} : { ...bundleSlots },
        /* bundleOfferId = le bundle ERP choisi : le serveur le RE-RÉSOUT (prix,
           articles) pour la boutique ; le navigateur ne décide pas du prix. */
        bundleOfferId: offerPicked ? bundleOffer.id : null,
        portion: offerPicked ? null : (portOpt ? portOpt.v : null),
        id_product_portion: offerPicked ? null : (portOpt?.id_product_portion ?? null),
        cat: product.cat,
        crossPortion: !!product.crossPortion,
        basePrice: product.price,
      }, selectedPromotion);
      if (accepted !== false || !selectedPromotion) onClose();
      else if (selectedPromotion) setAddError(t('error.promotionConditions'));
    } catch (error) {
      setAddError(selectedPromotion ? t('error.promotionAddFailed') : wsMessage(error.message || 'error.quote'));
    } finally {
      setAdding(false);
    }
  }

  // ── Hooks must run unconditionally (called BEFORE any early return) ─
  const scrollRef = React.useRef(null);
  const pdmPanelRef = useSwipeDownToClose(onClose, scrollRef);
  const [swipeHint, setSwipeHint] = React.useState(false);
  // Show the in-place swipe hint when content overflows; hide once user
  // has interacted (scrolled) or reached the bottom.
  React.useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    let acted = false;
    const measure = () => {
      if (acted) return;
      const overflow = el.scrollHeight - el.clientHeight - el.scrollTop;
      setSwipeHint(overflow > 24);
    };
    const onScroll = () => {
      if (el.scrollTop > 6) { acted = true; setSwipeHint(false); el.removeEventListener('scroll', onScroll); }
      else measure();
    };
    measure();
    const t = setTimeout(measure, 60);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', measure); };
  }, [open, product, bundleId]);

  if (!open || !product) return null;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="pdm-scrim" role="dialog" aria-modal="true" onClick={onClose} style={{ '--accent': accentVar }}>
      <div ref={pdmPanelRef} className="pdm" onClick={(e) => e.stopPropagation()}>
        <span className="ws-modal__handle pdm-handle" aria-hidden="true"/>
        <button className="pdm-close" aria-label={t('common.close2')} {...wsTap(onClose, { shield: true })}><Pict d={ICONS.close} s={13}/></button>

        {/* HERO */}
        <div className="pdm-hero">
          {product.badge && <span className="pdm-hero__badge">{product.badge}</span>}
          <img
            className={product.img ? 'pdm-hero__img' : 'pdm-hero__img pdm-hero__img--lineart'}
            src={product.img || getPlaceholder(product)}
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.imgFallback === '1') return;
              el.dataset.imgFallback = '1';
              el.classList.add('pdm-hero__img--lineart');
              el.src = getPlaceholder(product);
            }}
            alt={product.name}
          />
        </div>

        {/* INFO */}
        <div className={`pdm-info${optionsLoading ? ' is-loading' : ''}`} aria-busy={optionsLoading}>
          {optionsLoading && (
            <div className="pdm-options-loading" role="status" aria-live="polite">
              <span className="pdm-options-loading__spinner" aria-hidden="true"/>
              <span>{t('pd.loadingOptions')}</span>
            </div>
          )}
          <div className="pdm-scroll" ref={scrollRef}>
            <div className="pdm-head">
              {/* Desktop only: the photo banner is hidden there, a thumbnail sits beside the title. */}
              <img className="pdm-thumb" src={product.img || getPlaceholder(product)} alt="" aria-hidden="true"/>
              <p className="pdm-eyebrow">{product.cat === 'sandwiches' ? t('pd.eyebrow.sandwich') : product.cat === 'plats' ? t('pd.eyebrow.dish') : t('pd.eyebrow.selection')}</p>
              <h2 className="pdm-title">{product.name}</h2>

              {product.description ? <p className="pdm-desc">{product.description}</p> : null}
              {product.is_weighted ? <p className="pdm-desc">{t('pd.weightedUnavailable')}</p> : null}
              {/* Allergènes : 3 états distincts (sécurité alimentaire) :
                  liste = connus · [] = recette évaluée, aucun · null = NON
                  RENSEIGNÉ (on le dit, on ne laisse jamais croire « aucun »). */}
              {Array.isArray(product.allergens) && product.allergens.length > 0 && (
                <div className="pdm-allergens"><Allergens list={product.allergens}/></div>
              )}
              {Array.isArray(product.allergens) && product.allergens.length === 0 && (
                <p className="pdm-allergens pdm-allergens--none">{t('pd.noAllergen')}</p>
              )}
              {!Array.isArray(product.allergens) && (
                <p className="pdm-allergens pdm-allergens--unknown">{t('pd.allergenUnknown')}</p>
              )}
              {product.portions && (
                <PortionOptions
                  value={portion}
                  onChange={(value) => { setPortion(value); setBundleId(null); setBundleSlots({}); }}
                  product={product}
                />
              )}
            </div>

            {voucherPortions.length>0&&<div className="pdm-voucher" role="status">
              <span>{t(voucherPortions.some(item=>!item.label)?'vouchers.productActiveAny':'vouchers.productActive',{portion:voucherPortions.map(item=>item.label).filter(Boolean).join(' / ')})}</span>
              {voucherPortions.filter(item=>item.value&&item.value!==portion).map(item=><button type="button" className="ws-linkbtn" key={item.value} onClick={()=>{setPortion(item.value);setBundleId(null);setBundleSlots({});}}>{t('vouchers.choosePortion',{portion:item.label})}</button>)}
            </div>}

            {/* SPECIAL OFFER STRIP */}

            {/* OPTION ACCORDIONS */}
            {(product.options?.length > 0 || product.upsells?.length > 0) && (
              <div className="pdm-opts">
                {product.options?.map((o) => {
                  return (
                    <div key={o.id}
                         ref={(el) => { if (el) optRefs.current[o.id] = el; }}
                         className={'pdm-optrow' + (activeOpt === o.id ? ' is-active' : '')}>
                      <div className="pdm-optrow__head">
                        <span className="pdm-opt__label">{o.label}</span>
                        {o.required
                          ? <span className="pdm-opt__req">{t('pd.required')}</span>
                          : <span className="pdm-opt__req pdm-opt__req--soft">{t('pd.optional')}</span>}
                      </div>
                      <div className="pdm-seg" role="radiogroup" aria-label={o.label} style={{ '--pdm-seg-n': o.choices.length }}>
                        {o.choices.map((c) => {
                          const on = sel[o.id] === c.id;
                          return (
                            <button key={c.id}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              className={'pdm-seg__btn' + (on ? ' is-on' : '')}
                              {...wsTap(() => setOpt(o.id, c.id))}>
                              <span className="pdm-seg__lbl">{c.label}</span>
                              {c.delta > 0 && <span className="pdm-seg__delta">+{wsCurrency(c.delta)}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {product.upsells?.length > 0 && (() => {
                  const id = '__upsells';
                  const isOpen = openOpts[id] !== false; // default open
                  const count = Object.values(upsellIds).filter(Boolean).length;
                  return (
                    <div key={id}
                         ref={(el) => { if (el) optRefs.current[id] = el; }}
                         className={'pdm-opt' + (isOpen ? ' is-open' : '') + (activeOpt === id ? ' is-active' : '')}>
                      <button className="pdm-opt__head" {...wsTap(() => toggleOpt(id), { open: true })} aria-expanded={isOpen}>
                        <span className="pdm-opt__head-l">
                          <span className="pdm-opt__label">{t('xsell.title')}</span>
                          {!isOpen && count > 0 && <span className="pdm-opt__sub">{wsText('ui.additions', { count })}</span>}
                        </span>
                        <span className="pdm-opt__head-r">
                          <span className="pdm-opt__req pdm-opt__req--soft">{t('pd.optional')}</span>
                          <span className="pdm-opt__chev"><Pict d={ICONS.chev} s={12}/></span>
                        </span>
                      </button>
                      <div className="pdm-opt__body-wrap">
                        <div className="pdm-opt__body">
                          <div className="pdm-chips">
                            {product.upsells.map((u) => {
                              const on = !!upsellIds[u.id];
                              return (
                                <button key={u.id}
                                  className={'pdm-imgchip' + (on ? ' is-on' : '')}
                                  {...wsTap(() => toggleUpsell(u.id))}>
                                  {u.img && <span className="pdm-imgchip__tile"><img src={u.img} alt=""/></span>}
                                  <span>{u.label}</span>
                                  <span className="pdm-imgchip__delta">+{wsNumber(u.delta)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* BUNDLE ERP : deux options exclusives, le produit seul par défaut.
                Même registre que le composeur (pdm-bcard). Le bouton du bas
                reprend le choix. */}
            {bundleOffer && (
              <div className="pdm-bundles pdm-offer">
                <div className="pdm-section-head">
                  <span className="pdm-section-title">{t('pd.offerTitle')}</span>
                </div>
                <div className="pdm-bcard-list">
                  <div className={'pdm-bcard' + (!offerPicked ? ' is-picked' : '')} role="button" aria-pressed={!offerPicked}
                       {...wsTap(() => setOfferOn(false), { open: true })}>
                    <div className="pdm-bcard__top">
                      <span className="pdm-bcard__name">{t('pd.offerAlone', { name: product.name })}</span>
                      <span className="pdm-bcard__price">{wsCurrency(unit + bundleDelta + upsellDelta)}</span>
                    </div>
                    <p className="pdm-bcard__desc">{t('pd.offerAloneDesc')}</p>
                  </div>
                  <div className={'pdm-bcard' + (offerPicked ? ' is-picked' : '')} role="button" aria-pressed={offerPicked}
                       {...wsTap(() => setOfferOn(true), { open: true })}>
                    <span className="pdm-bcard__badge">{t('card.offer')}</span>
                    <div className="pdm-bcard__top">
                      <span className="pdm-bcard__name">{bundleOffer.name}</span>
                      <span className="pdm-bcard__price">
                        <span className="pdm-bcard__strike">{wsCurrency(bundleOffer.regular)}</span>{wsCurrency(bundleOffer.price)}
                        <span className="pdm-bcard__save">{t('pd.offerSave', { amount: wsNumber(bundleOffer.saving).replace('.', ',') })}</span>
                      </span>
                    </div>
                    <ul className="pdm-bcard__lines" aria-label={t('pd.offerIn')}>
                      {bundleOffer.items.map((it, k) => (
                        <li key={k}><span>{it.qty} × {it.name}{it.portionLabel ? ', ' + it.portionLabel : ''}</span><span>{wsCurrency(it.unit * it.qty)}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* BUNDLE CAROUSEL */}
            {bundleList.length > 0 && (
              <div className="pdm-bundles">
                <div className="pdm-section-head">
                  <span className="pdm-section-title">{t('pd.bundle')}</span>
                  {bundleList.length > 1 && (
                    <button type="button" className="pdm-section-arrow" aria-label={t('co.next')}
                      {...wsTap(() => {
                        const cur = bundleList.findIndex((b) => b.id === bundleId);
                        const next = cur + 1 >= bundleList.length ? 0 : cur + 1;
                        const nextBundle = bundleList[next];
                        if (nextBundle) pickBundle(nextBundle.id);
                      }, { open: true })}>
                      <Pict d={ICONS.chev} s={10}/>
                    </button>
                  )}
                </div>
                <div className="pdm-car" ref={carRef} onScroll={onCarScroll}>
                  {bundleList.map((b, i) => {
                    const picked = (b.id === bundleId);
                    return (
                      <div key={b.id || 'alc'}
                           className={'pdm-bcard' + (picked ? ' is-picked' : '')}
                           role="button"
                           {...wsTap(() => pickBundle(b.id), { open: true })}>
                        {b.recommended && <span className="pdm-bcard__badge">{t('pd.bestOption')}</span>}
                        <div className="pdm-bcard__top">
                          <span className="pdm-bcard__name">{b.name}</span>
                          <span className={'pdm-bcard__price' + (b.price_modifier > 0 ? '' : ' pdm-bcard__price--free')}>
                            {b.menu_id ? wsCurrency(b.base_total) : b.price_modifier > 0 ? '+' + wsCurrency(b.price_modifier) : t('pd.included')}
                          </span>
                        </div>
                        <p className="pdm-bcard__desc">{b.description}</p>
                        {b.included?.length > 0 && (
                          <ul className="pdm-bcard__inc">
                            {b.included.map((it, k) => (
                              <li key={k}><Pict d={ICONS.check} s={10}/> <span>{it.label}</span></li>
                            ))}
                          </ul>
                        )}
                        {/* progressive disclosure: bundle slots open softly when picked */}
                        <div className={'pdm-bcard__expand' + (picked && b.id !== null && b.slots?.length > 0 ? ' is-open' : '')}>
                          <div className="pdm-bcard__expand-inner" onClick={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
                            {b.slots?.map((slot) => (
                              <div key={slot.id} className="pdm-opt is-open" style={{ background: 'transparent', boxShadow: 'none' }}>
                                <div style={{ padding: '4px 0 0' }}>
                                  <div className="pdm-opt__head-l" style={{ marginBottom: 6 }}>
                                    <span className="pdm-opt__label" style={{ fontSize: 12.5 }}>{slot.label}
                                      {slotIsMulti(slot)
                                        ? <span className={'pdm-opt__req' + (slot.required ? '' : ' pdm-opt__req--soft')} style={{ marginLeft: 8 }}>
                                            {slotPicked(slot).length}/{Math.max(1, slot.max_select || 1)}
                                            {slot.required ? ', ' + t('menu.choose', {count: Math.max(1, slot.min_select || 1)}) : ''}
                                          </span>
                                        : slot.required && <span className="pdm-opt__req" style={{ marginLeft: 8 }}>{t('pd.required')}</span>}
                                    </span>
                                  </div>
                                  <div className="pdm-chips">
                                    {slot.choices.map((c) => {
                                      const multi = slotIsMulti(slot);
                                      const cOn = multi ? slotPicked(slot).includes(c.id) : bundleSlots[slot.id] === c.id;
                                      const klass = c.img ? 'pdm-imgchip' : 'pdm-chip';
                                      return (
                                        <button key={c.id}
                                          className={klass + (cOn ? ' is-on' : '')}
                                          {...wsTap(() => multi ? toggleSlotMulti(slot.id, c.id, slot.max_select) : setSlot(slot.id, !slot.required && cOn ? null : c.id))}>
                                          {c.img && <span className="pdm-imgchip__tile"><img src={c.img} alt=""/></span>}
                                          <span>{c.label}</span>
                                          {c.delta > 0 && <span className={c.img ? 'pdm-imgchip__delta' : 'pdm-chip__delta'}>+{wsNumber(c.delta)}</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <span className="pdm-bcard__radio" aria-hidden="true"/>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {activeBundle?.menu_id && <p className="pdm-opt__hint">{t('menu.noDiscount')}</p>}
            {product?.menu_load_error && <p role="alert">{t('menu.loadError')}</p>}
            {!offerPicked && !activeBundle && promotionSuggestions.length > 0 && (
              <section className="pdm-promotion" aria-busy={promotionPreviewPending} aria-label={t('promotion.inline.title')}>
                <div className="pdm-promotion__head">
                  <span>{t('promotion.inline.title')}</span>
                </div>
                <div className="pdm-promotion__list">
                  {promotionSuggestions.map((basePromotion) => {
                    const promotion = Number(basePromotion.id_promotion) === Number(selectedPromotionId) ? (selectedPromotion || basePromotion) : basePromotion;
                    const selected = Number(promotion.id_promotion) === Number(selectedPromotionId);
                    const items = wsPromotionItemsSummary(promotion, product, t, selected ? rewardChoice?.additional_cost_gross : null);
                    const type = t(`promotion.inline.type.${promotion.promotion_type}`);
                    const unavailable = promotionLocked || promotion.is_available === false;
                    const blocked = unavailable || promotionPreviewPending;
                    const benefit = unavailable ? null : wsPromotionBenefit(promotion);
                    return <div key={promotion.id_promotion} className={`pdm-promotion__offer${selected && rewardOptions.length ? ' has-gifts' : ''}`}><button type="button"
                      className={`pdm-promotion__card${selected ? ' is-selected' : ''}${unavailable ? ' is-locked' : ''}`}
                      aria-pressed={selected} aria-disabled={blocked} disabled={blocked}
                      {...wsTap(() => {
                        if (blocked) return;
                        setSelectedPromotionId(selected ? null : promotion.id_promotion);
                      })}>
                      <span className={selected && rewardOptions.length ? "pdm-gift-icon" : "pdm-promotion__radio"} aria-hidden="true">{selected && rewardOptions.length > 0 && <PromotionGiftIcon/>}</span>
                      <span className="pdm-promotion__body"><strong>{promotion.name}</strong>
                        {promotion.is_available !== false && !(selected && rewardOptions.length) && <FractionalPromotionRule promotion={promotion} product={product} t={t}/>}
                        <small className="pdm-promotion__composition">{promotion.is_available === false || (selected && rewardOptions.length) ? items : `${type} · ${items}`}</small>
                        {promotion.is_available !== false && !(selected && rewardOptions.length) && Number(promotion.minimum_receipt_gross || 0) > 0 && <small className="pdm-promotion__period">{t('promotion.inline.minimumReceipt', { amount: wsCurrency(Number(promotion.minimum_receipt_gross)) })}</small>}
                        <PromotionReceiptProgress promotion={promotion} t={t}/></span>
                      {benefit && <span className="pdm-promotion__price">{benefit}</span>}
                    </button>
                      {selected && rewardOptions.length > 0 && <PromotionRewardChoices options={rewardOptions}
                        selectedKey={rewardChoice ? `${rewardChoice.id_product}-${rewardChoice.id_product_portion ?? 0}` : null}
                        onSelect={item => setRewardChoiceKey(`${item.id_product}-${item.id_product_portion ?? 0}`)} t={t}/>}
                    </div>;
                  })}
                </div>
              </section>
            )}
            {!offerPicked && !activeBundle && upcomingPromotionSuggestions.length > 0 && (
              <section className="pdm-promotion pdm-promotion--upcoming" aria-busy={promotionPreviewPending} aria-label={t('promotion.inline.upcomingTitle')}>
                <div className="pdm-promotion__head">
                  <span>{t('promotion.inline.upcomingTitle')}</span>
                </div>
                <div className="pdm-promotion__list">
                  {upcomingPromotionSuggestions.map((promotion) => <UpcomingPromotionCard
                    key={`upcoming-${promotion.id_promotion}-${promotion.available_from}`}
                    promotion={promotion} lang={lang} t={t}/>)}
                </div>
              </section>
            )}
            {personalEnabled && personalGroups.length>0 && <div className="pdm-personalization">
              <h3>{t('personalization.title')}</h3>
              {personalGroups.map(group=><fieldset key={group.id}>
                <legend>{group.name} <small>({group.min_select}–{group.max_select})</small></legend>
                {group.options.map(option=><label key={option.id}>
                  <input type="checkbox" checked={personalChoices.includes(option.id)}
                    disabled={!personalChoices.includes(option.id) && group.options.filter(o=>personalChoices.includes(o.id)).length>=group.max_select}
                    onChange={e=>setPersonalChoices(current=>e.target.checked?[...current,option.id]:current.filter(id=>id!==option.id))}/>
                  <span>{option.name}</span><strong>+{wsCurrency(Number(option.price_delta))}</strong>
                </label>)}
              </fieldset>)}
              <p>{t('personalization.exclusive')}</p>
            </div>}
            {(product?.personalization_error || product?.personalization?.unavailable) && <p role="alert">{t('personalization.unavailable')}</p>}

          </div>

          {/* In-place swipe hint */}
          <div className={'pdm-swipe' + (swipeHint ? ' is-visible' : '')} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14"/>
              <path d="M6 13l6 6 6-6"/>
            </svg>
          </div>

          {/* STICKY FOOTER */}
          {selectedPromotion && rewardChoice && !optionsLoading && <div className="pdm-gift-summary" role="status">
              <PromotionGiftIcon/>
              <span>{t('promotion.inline.yourReward', { product: wsPromotionItemsSummary({ items: [rewardChoice] }, product, t) })}</span>
              <strong>{wsCurrency(Number(rewardChoice.additional_cost_gross || 0))}</strong>
            </div>}
          <div className="pdm-foot">
            {deliveryBlocked && (
              <div className="pdm-delivery-notice pdm-delivery-notice--blocked"> {wsText("ui.collectOnly")} </div>
            )}
            {/* Le NOMBRE d'unités restantes n'est plus affiché (retiré le 23/08,
                comme le compteur des vignettes avant lui) : c'est une donnée
                interne de stock, pas une information client. Seul l'état
                bloquant reste visible : « Épuisé », et la quantité demeure
                plafonnée en silence par le sélecteur ci-dessous. */}
            {availabilityMessage && <div className="pdm-delivery-notice" role="status">{t(availabilityMessage)}</div>}
            {!deliveryBlocked && !uninitialized && deliveryStockLeft === 0 && (
              <div className="pdm-delivery-notice">{t('pd.outOfStock')}</div>
            )}
            {!availabilityMessage && deliveryStockLeft > 0 && qty > deliveryStockLeft &&
              <div className="pdm-delivery-notice" role="status">{t('stock.quantityChanged')}</div>}
            {addError && <div className="pdm-delivery-notice" role="alert">{addError}</div>}
            {selectedPromotion && !rewardChoice && <div className="pdm-delivery-notice">{t('promotion.inline.oneSet')}</div>}
            {!selectedPromotion && !product.is_weighted && <ProductQuantityControl key={product.id}
              quantity={qty} stockLimit={deliveryStockLeft} onChange={changeQuantity} t={t}
              bulkQuantityEnabled={product.webshop_bulk_quantity_enabled}/>}
            <button className="pdm-cta" aria-busy={adding} disabled={adding || (selectedPromotion && promotionPreviewPending) || product.is_weighted || !valid || deliveryBlocked || (deliveryStockLeft !== null && qty > deliveryStockLeft)} {...wsTap(handleConfirm, { shield: true })}>
              <span>{deliveryBlocked ? t('pd.notForDelivery') : (uninitialized ? t('stock.checkAvailability') : deliveryStockLeft === 0 ? t('pd.outOfStock') : (valid ? (selectedPromotion || offerPicked ? t('pd.offerAdd') : t('pd.addToCart')) : t('pd.chooseOptions')))}</span>
              <span className="pdm-cta__total" key={pulse}>
                <span className="pdm-cta__total-anim">{wsCurrency(product.is_weighted ? product.price : displayedTotal)}{product.is_weighted ? ' / kg' : ''}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// PRODUCT CARD
// =========================================================================
const ProductCard = React.memo(function ProductCard({ p, onAdd, onOpen, mode, basketQty, stock, platsBadge, imagePriority = false }) {
  const { t } = wsUseT();
  const price = p.price;
  const hasOptions = !!(p.options || p.bundle || p.upsells);
  const isDelivery = mode === 'delivery';
  // Canal livraison bureau (« apricot ») : bloqué si non livré par la boutique
  // (no_delivery) ou désactivé marque pour ce canal (office_delivery === false).
  const deliveryBlocked = isDelivery && (!!p.no_delivery || p.office_delivery === false);
  const portions = p.portions ? portionOptionList(p).map(option => option.v) : ['entier'];
  const limits = portions.map(portion => availablePortions(stock, portion, basketQty || 0));
  const availabilityMessage = stockMessageKey(stock);
  const uninitialized = stock?.status === 'uninitialized';
  const stockExhausted = !uninitialized && limits.every(limit => limit === 0);
  const addDisabled = deliveryBlocked || stockExhausted || uninitialized || p.is_weighted;

  function handleCardClick() { if (!deliveryBlocked) onOpen(p); }
  return (
    <article className={`ws-card${addDisabled ? ' ws-card--unavail' : ''}`} {...wsTap(handleCardClick, { open: true })} role="button" tabIndex={0}>
      <div className="ws-card__photo">
        {deliveryBlocked
          ? <span className="ws-card__badge ws-card__badge--nodeliv">{t('pd.pickupOnly')}</span>
          : platsBadge
            ? <span className="ws-badge--plats ws-card__badge">{t('pd.readyMeals')}</span>
            : p.badge && <span className="ws-card__badge">{p.badge}</span>}
        <img
          loading={imagePriority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          className={p.img ? 'ws-card__photo-img' : 'ws-card__photo-img ws-card__photo-img--lineart'}
          src={p.img || getPlaceholder(p)}
          alt=""
          // Filet de sécurité : si la photo casse quand même (fichier retiré du
          // serveur entre deux déploiements, URL externe morte), on bascule sur
          // l'illustration de repli au lieu de laisser une image cassée. Le
          // drapeau coupe la boucle si le repli échoue à son tour.
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.imgFallback === '1') return;
            el.dataset.imgFallback = '1';
            el.classList.add('ws-card__photo-img--lineart');
            el.src = getPlaceholder(p);
          }}
        />
      </div>
      {/* Meta strip BELOW the (1:1) photo, allergens, info, add */}
      <div className="ws-card__metaStrip">
        <Allergens list={p.allergens}/>
        <div className="ws-card__icons">
          <button className="ws-iconcircle" aria-label={t('pd.info')} {...wsTap(() => onOpen(p), { stop: true, open: true })}><Pict d={ICONS.info} s={11}/></button>
          <button className="ws-add" {...wsTap(() => { if (!addDisabled) onOpen(p); }, { stop: true, open: true })} aria-label={t('pd.addToCart')}
            disabled={addDisabled} title={deliveryBlocked ? wsText("ui.noDelivery") : stockExhausted ? wsText("ui.deliverySoldOut") : undefined}>
            {stockExhausted ? '✕' : '+'}
          </button>
        </div>
      </div>
      <div className="ws-card__body">
        {p.portions && (
          <div className="ws-card__portions" aria-label={t('pd.portionsAvailable')}
               title={wsText('ui.portionNames', { names: portionOptionList(p).map((o) => o.name).join(' · ') })}>
            <PortionGlyph size={12}/>
            <span>{t('pd.portionsAvailable')}</span>
          </div>
        )}
        {/* BUNDLE ERP : il se SIGNALE ici (ligne « Avec Coca-Cola », prix bundle
            avec le prix normal barré) et se CHOISIT dans la fiche. bundleOffer
            vient du serveur ; sans bundle ERP tarifé, il est null et rien
            n'apparaît. */}
        {p.bundleOffer && (
          <div className="ws-card__offer" title={p.bundleOffer.name}>
            <Pict d={ICONS.check} s={10}/>
            <span>{t('card.offerWith', { name: p.bundleOffer.items.filter((it) => it.productId !== p.id).map((it) => it.name).join(' + ') || p.bundleOffer.name })}</span>
          </div>
        )}
        {p.lead_time > 0 && (
          <div className="ws-card__leadtime" title={`Commander ${p.lead_time} jour${p.lead_time > 1 ? 's' : ''} avant`}>
            {`J+${p.lead_time}`}
          </div>
        )}
        <div className="ws-card__name">{p.name}</div>
        <div className="ws-card__meta">
          <span className="ws-card__price">{wsCurrency(price)}{p.is_weighted ? ' / kg' : ''}{hasOptions && <span className="ws-card__from"> · {t('card.fromPrice')}</span>}</span>
          {p.bundleOffer && (
            <span className="ws-card__offerprice" title={p.bundleOffer.name}>
              <span>{t('card.offer')} {wsCurrency(p.bundleOffer.price)}</span>
              <s>{wsCurrency(p.bundleOffer.regular)}</s>
            </span>
          )}
          {/* Compteur « X dispo » retiré des vignettes (demandé le 15/08) : il
              exposait le stock restant sur la grille. « Épuisé » reste : c'est
              une contrainte que le client doit voir avant d'ajouter. */}
          {availabilityMessage && <span className="ws-card__stock">{t('stock.checkAvailability')}</span>}
          {stockExhausted && <span className="ws-card__stock ws-card__stock--out">{t('pd.soldOutDelivery')}</span>}
        </div>
      </div>
    </article>
  );
});

// =========================================================================
// BASKET PANEL (right side)
// =========================================================================
// =========================================================================
function wsArrondi(x) { return Math.round(x * 100) / 100; }

function wsMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

// Checkout may quote the basket twice: once while the customer edits it and
// once immediately before an order is created. Menu composition deliberately
// receives a fresh internal group ID on each server calculation, so comparing
// the raw `items` object would report a price change even when the business
// result is identical. Keep only stable, customer-relevant quote fields.
function wsCheckoutQuoteComparable(quote) {
  const money = (value) => wsMoney(value).toFixed(2);
  const item = (line) => ({
    personalization: line?.personalization_selection || null,
    line_key: String(line?.line_key || ''),
    id_product: Number(line?.id_product || 0),
    id_product_portion: line?.id_product_portion == null ? null : Number(line.id_product_portion),
    quantity: Number(line?.quantity || 0),
    weight_grams: line?.weight_grams == null ? null : Number(line.weight_grams),
    unit_gross_price: money(line?.unit_gross_price),
    item_tax_perc: Number(line?.item_tax_perc || 0),
    item_discount_value: money(line?.item_discount_value),
    total_gross_value_before_discount: money(line?.total_gross_value_before_discount),
    total_gross_value_after_discount: money(line?.total_gross_value_after_discount),
    total_tax_value_after_discount: money(line?.total_tax_value_after_discount),
    total_net_value_after_discount: money(line?.total_net_value_after_discount),
  });
  const billing = quote?.billing && typeof quote.billing === 'object'
    ? Object.keys(quote.billing).sort().reduce((result, key) => ({ ...result, [key]: quote.billing[key] }), {})
    : null;
  return {
    totals: {
      gross_before_discount: money(quote?.totals?.gross_before_discount),
      gross_after_discount: money(quote?.totals?.gross_after_discount),
      discount: money(quote?.totals?.discount),
      tax_after_discount: money(quote?.totals?.tax_after_discount),
    },
    billing,
    loyaltyReward: quote?.loyalty_reward ? {id:quote.loyalty_reward.id,line:quote.loyalty_reward.line_index,discount:money(quote.loyalty_reward.discount)} : null,
    items: Array.isArray(quote?.items) ? quote.items.map(item) : [],
  };
}

function wsQuoteLineKey(line, index) {
  return 'web-' + String(line.line ?? index).replace(/[^A-Za-z0-9-]/g, '-').slice(0, 60);
}

function wsQuoteTotals(quote, deliveryFee) {
  if (!quote || !quote.totals) return null;
  const subtotal = wsMoney(quote.totals.gross_before_discount);
  const discount = wsMoney(quote.totals.discount);
  const productsTotal = wsMoney(quote.totals.gross_after_discount);
  const fee = wsMoney(deliveryFee);
  const voucherDiscount = quote.voucher?.code && quote.voucher?.valid && quote.voucher?.matches_cart ? discount : 0;
  const rewardDiscount = wsMoney(quote.loyalty_reward?.discount);
  const weekdayDiscount = wsMoney(quote.weekday_discount?.discount_total);
  const weekdayMinimum = wsMoney(quote.weekday_discount?.minimum_cart_gross);
  const weekdayRemaining = wsMoney(quote.weekday_discount?.amount_remaining);
  return { sousTotal: subtotal, croise: 0, remise: Math.max(0, discount - voucherDiscount - weekdayDiscount - rewardDiscount), reward: rewardDiscount, bon: voucherDiscount, weekday: weekdayDiscount, weekdayPercent: wsMoney(quote.weekday_discount?.percent), frais: fee,
           weekdayMinimum, weekdayRemaining, weekdayThresholdMet: quote.weekday_discount?.threshold_met !== false,
           total: wsArrondi(productsTotal + fee), productsTotal };
}

// A promotion remains split into product lines for receipt, VAT and stock, but
// is one indivisible object for the customer. This helper creates that logical
// cart object without duplicating the underlying transaction lines.
function wsBasketDisplayRows(basket, quote) {
  const lines = Array.isArray(basket) ? basket : [];
  const quotedItems = new Map((quote?.items || []).map((item) => [item.line_key, item]));
  const weekdayDiscountByLineKey = new Map((quote?.weekday_discount?.items || [])
    .filter((item) => item?.line_key)
    .map((item) => [item.line_key, wsMoney(item.discount_value)]));
  const weekdayPercent = wsMoney(quote?.weekday_discount?.percent);
  const applications = (quote?.applied_promotions || []).filter((application) => application?.source === 'AUTOMATIC');
  const promotionByLineKey = new Map();
  applications.forEach((application) => (application.items || []).forEach((item) => {
    if (item?.line_key) promotionByLineKey.set(item.line_key, application);
  }));

  const promotionByGroup = new Map();
  lines.forEach((line, index) => {
    const promotion = promotionByLineKey.get(wsQuoteLineKey(line, index)) || line.promotion_display;
    if (line.promotion_group && promotion) promotionByGroup.set(line.promotion_group, promotion);
  });

  const groups = new Map();
  lines.forEach((line, index) => {
    const lineKey = wsQuoteLineKey(line, index);
    const groupId = line.promotion_group;
    const promotion = (groupId && promotionByGroup.get(groupId)) || line.promotion_display || promotionByLineKey.get(lineKey);
    // Group every component, including bundles made of different products.
    // A delayed quote must not split a customer-selected promotion again.
    const key = groupId ? `promotion:${groupId}` : `line:${line.line}`;
    const row = groups.get(key) || { key, lines: [], quotedItems: [], promotion: promotion || null };
    row.lines.push(line);
    row.quotedItems.push(quotedItems.get(lineKey));
    groups.set(key, row);
  });

  return [...groups.values()].map((row) => ({
    ...row,
    line: row.quotedItems[0]?.personalization_snapshot ? {...row.lines[0], options: row.quotedItems[0].personalization_snapshot.map(o=>({label: `${o.name}: ${o.value}`}))} : row.lines[0],
    isPromotion: row.lines.some((line) => Boolean(line.promotion_group)),
    quantity: row.lines.reduce((total, line) => total + Number(line.qty || 0), 0),
    price: row.quotedItems.reduce((total, item) => total + wsMoney(item?.total_gross_value_after_discount), 0),
    weekdayDiscount: row.quotedItems.reduce(
      (total, item) => total + (weekdayDiscountByLineKey.get(item?.line_key) || 0),
      0,
    ),
    weekdayPercent,
    promotionDiscount: row.quotedItems.reduce((total, item) => total + wsMoney(item?.item_discount_value), 0)
      - row.quotedItems.reduce((total, item) => total + (weekdayDiscountByLineKey.get(item?.line_key) || 0), 0),
  }));
}

function wsPromotionBasketNote(application, t) {
  const snapshot = application?.promotion_snapshot || {};
  const reward = application?.reward || snapshot.reward || {};
  const promotionType = application?.promotion_type || snapshot.promotion_type;
  if (promotionType === 'BUY_X_GET_Y' && reward.type === 'FIXED_PRICE'
      && Number(reward.quantity || 0) > 0 && Number(reward.value || 0) >= 0) {
    return t('cart.promotionFixedPrice', {
      quantity: Number(reward.quantity),
      price: wsCurrency(Number(reward.value)),
    });
  }
  return null;
}

function wsPromotionDisplayTotal(promotion, fallback) {
  const value = promotion?.promotion_total_gross_after_discount
    ?? promotion?.bundle_price
    ?? promotion?.total_gross_after_discount;
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function wsHasPromotionSelection(basket) {
  return (Array.isArray(basket) && basket.some((line) => typeof line?.promotion_group === 'string' && line.promotion_group !== ''))
    || wsSelectedAutomaticPromotionId(basket) !== null;
}

function wsSelectedAutomaticPromotionId(basket) {
  const ids = new Set((Array.isArray(basket) ? basket : []).map((line) => {
    const direct = Number(line?.promotion_id || 0);
    if (direct > 0) return direct;
    const legacy = String(line?.promotion_group || '').match(/-(\d+)$/);
    return legacy ? Number(legacy[1]) : 0;
  }).filter((id) => Number.isInteger(id) && id > 0));
  return ids.size === 1 ? [...ids][0] : null;
}

// Removing one product from a multi-product promotion turns its remaining
// products back into ordinary cart lines. Keeping the local marker would lock
// the promotion selector even though the server no longer applies the offer.
function wsRemoveBasketLines(basket, lineIds) {
  const ids = new Set(Array.isArray(lineIds) ? lineIds : [lineIds]);
  const affectedGroups = new Set((Array.isArray(basket) ? basket : [])
    .filter((line) => ids.has(line.line) && line.promotion_group)
    .map((line) => line.promotion_group));

  // Removing one component must always remove the complete customer-facing
  // promotion. Retagging its remaining products as ordinary lines was the
  // source of promotions silently consuming another product in the basket.
  for (const line of (Array.isArray(basket) ? basket : [])) {
    if (affectedGroups.has(line.promotion_group)) ids.add(line.line);
  }
  return (Array.isArray(basket) ? basket : []).filter((line) => !ids.has(line.line));
}

function CrossSell({ shopId, mode, date, time, basket, placement, onAdd }) {
  const { t } = wsUseT();
  const [items, setItems] = React.useState([]);
  const ids = basket.map((l) => l.productId).filter(Boolean);
  const key = ids.slice().sort().join(',') + '|' + (date || '') + '|' + (time || '') + '|' + mode;
  React.useEffect(() => {
    let alive = true;
    const base = window.WSCatalog && window.WSCatalog.crossSellEndpoint;
    if (!base || !shopId || ids.length === 0) { setItems([]); return; }
    fetch(base, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId, mode, date: date || null, time: time || null, placement, productIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((list) => { if (alive) setItems(Array.isArray(list) ? list : []); })
      // Recommendation failures are reported independently of the basket.
      .catch((e) => { if (alive) { setItems([]); bug('cross-sell', wsText("error.service"), e); } });
    return () => { alive = false; };
  }, [key, shopId, placement]);

  // Track impressions only when a statistics endpoint is configured.
  React.useEffect(() => {
    const base = window.WSCatalog && window.WSCatalog.crossSellStatsEndpoint;
    if (!base || !items.length) return;
    for (const it of items) {
      fetch(base, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'impression', ruleId: it.ruleId, productId: it.productId, shopId }),
      }).catch(() => {});
    }
  }, [items.map((i) => i.productId).join(','), shopId]);

  if (!items.length) return null;
  return (
    <div className="ws-xsell">
      <div className="ws-xsell__h">{t('xsell.title')}</div>
      {items.map((it) => (
        <div className="ws-xsell__i" key={it.productId}>
          {it.img ? <img className="ws-xsell__img" src={it.img} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}/>
                  : <span className="ws-xsell__img"/>}
          <span className="ws-xsell__n">{it.name}</span>
          <span className="ws-xsell__p">{wsCurrency(Number(it.price))}</span>
          <button type="button" className="ws-xsell__add" aria-label={t('xsell.addItem', { name: it.name })} title={t('xsell.add')}
            onClick={() => {
              const base = window.WSCatalog && window.WSCatalog.crossSellStatsEndpoint;
              if (base) fetch(base, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'add', ruleId: it.ruleId, productId: it.productId, shopId }),
              }).catch(() => {});
              onAdd(it);
            }}>+</button>
        </div>
      ))}
    </div>
  );
}

function PromotionGiftIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="8.5" width="17" height="4" rx="1"/>
    <path d="M5 12.5v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8.5v12M12 8.5c-1.5-3.5-5.5-4-5.5-1.5 0 1.3 1.6 1.5 5.5 1.5zM12 8.5c1.5-3.5 5.5-4 5.5-1.5 0 1.3-1.6 1.5-5.5 1.5z"/>
  </svg>;
}

function PromotionRewardChoices({ options, selectedKey, onSelect, t }) {
  return <div className="pdm-gifts">
    <div className="pdm-gifts__title">{t('promotion.inline.chooseReward')}</div>
    <div className="pdm-gifts__options" role="radiogroup" aria-label={t('promotion.inline.chooseReward')}
      onKeyDown={event => {
        if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...event.currentTarget.querySelectorAll('[role="radio"]')];
        const current = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (current + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) + buttons.length) % buttons.length;
        event.preventDefault();
        buttons[next]?.focus();
        if (options[next]) onSelect(options[next]);
      }}>
      {options.map((item, index) => {
        const key = `${item.id_product}-${item.id_product_portion ?? 0}`;
        const selected = key === selectedKey;
        const cost = Number(item.additional_cost_gross || 0);
        return <button type="button" role="radio" aria-checked={selected} tabIndex={selected || (!selectedKey && index === 0) ? 0 : -1}
          className={`pdm-gifts__option${selected ? ' is-selected' : ''}`} key={key} onClick={() => onSelect(item)}>
          <span className="pdm-gifts__radio" aria-hidden="true"/>
          <img src={item.image_src} alt="" width="44" height="44" loading="lazy" decoding="async" onError={event => {
            if (event.currentTarget.dataset.imgFallback) return;
            event.currentTarget.dataset.imgFallback = '1'; event.currentTarget.src = item.image_fallback;
          }}/>
          <span className="pdm-gifts__name">{wsPromotionItemsSummary({ items: [item] }, {}, t)}</span>
          <span className="pdm-gifts__prices">
            {item.regular_price != null && Number(item.regular_price) > cost && <del>{wsCurrency(item.regular_price)}</del>}
            <span className="pdm-gifts__badge">{cost === 0 ? t('promotion.inline.freeReward') : wsCurrency(cost)}</span>
          </span>
        </button>;
      })}
    </div>
  </div>;
}

function PromotionReceiptProgress({ promotion, t }) {
  const minimum = Number(promotion.minimum_receipt_gross || 0);
  if (!(minimum > 0) || promotion.is_available !== false) return null;
  const missing = Math.min(minimum, Math.max(0, Number(promotion.minimum_receipt_missing || 0)));
  const message = t('promotion.inline.receiptMissing', { amount: wsCurrency(missing) });
  return <span className="pdm-promotion__receipt">
    <small>{message}</small>
    <progress max={minimum} value={minimum - missing} aria-label={message}/>
  </span>;
}

function Basket({ hidePrices, contextLabel, officeName, shop, mode, basket, quoteState, onClose, onCheckout, onRemove, onQty, onNote, notesEnabled, deliveryFeeResult,
                  date, slotTime, onCrossAdd }) {
  // Display the authoritative API quote for this cart.
  const { t } = wsUseT();
  const deliveryFee = (mode === 'delivery' && deliveryFeeResult) ? (deliveryFeeResult.fee_amount || 0) : 0;
  const pricesReady = quoteState.status === 'ready' && Boolean(quoteState.quote?.totals);
  const T = wsQuoteTotals(pricesReady ? quoteState.quote : null, deliveryFee)
    || { sousTotal: 0, croise: 0, remise: 0, bon: 0, frais: 0, total: 0 };
  const displayRows = wsBasketDisplayRows(basket, quoteState.status === 'ready' ? quoteState.quote : null);
  const subtotal = T.sousTotal;
  const total = T.total;
  return (
    <aside className="ws-basket">
      <div className="ws-basket__head">
        {onClose && <button className="ws-basket__back" onClick={onClose}><Pict d={ICONS.back} s={11}/> {t('cart.back')}</button>}
        <span className="ws-basket__title">{t('cart.title')}</span>
      </div>

      {/* Mode, day and shop on one line under the title (the address used to sit
          at the very bottom, under the order button). */}
      <div className={`ws-basket__mode ws-basket__mode--${mode}`}>
        <span className="ws-basket__mode-dot"/>
        <span className="ws-basket__mode-txt">
          <strong>{t(mode === 'collect' ? 'cart.mode.collect' : 'cart.mode.delivery')}{date instanceof Date ? ' · ' + wsCap(date.toLocaleDateString(wsLocale(), { weekday: 'short', day: 'numeric', month: 'short' })) : ''}</strong>
          {mode === 'collect' && shop?.address && <span>{shop.name} · {shop.address}</span>}
        </span>
      </div>

      {mode === 'delivery' && officeName && <div className="ws-basket__office">{officeName}</div>}

      <div className="ws-basket__items">
        {basket.length === 0 && (
          <div className="ws-basket__empty">{t('cart.empty')}</div>
        )}
        {displayRows.map((row) => {
          const l = row.line;
          const groupedPromotion = row.isPromotion;
          const displayName = groupedPromotion && row.promotion ? row.promotion.display_name : l.name;
          const promotionNote = pricesReady && row.promotion ? wsPromotionBasketNote(row.promotion, t) : null;
          return <div key={row.key} className={`ws-line${groupedPromotion ? ' ws-line--promotion' : ''}`}>
            {typeof onQty === 'function' && !groupedPromotion && !(l.options || []).length && !l.bundleId && !l.bundleOfferId && !Object.keys(l.bundleSlots || {}).length && !l.menu_selection && !l.personalization_selection
              ? <div className="ws-line__stepper" role="group" aria-label={t('cart.quantityOf', { name: displayName })}>
                  <button type="button" onClick={() => onQty(row.lines.map((line) => line.line), -1)} aria-label={t('cart.less')}>−</button>
                  <span aria-live="polite">{row.quantity}</span>
                  <button type="button" onClick={() => onQty(row.lines.map((line) => line.line), 1)} aria-label={t('cart.more')}>+</button>
                </div>
              : <div className="ws-line__qty">×{groupedPromotion ? 1 : row.quantity}</div>}
            <div className="ws-line__body">
              <div className="ws-line__name">{displayName}</div>
              {groupedPromotion
                ? row.lines.map((line) => <div key={line.line} className="ws-line__opt" hidden>×{line.qty} {line.portion_label || (line.options || []).map(option => option.label).join(', ')} {line.name}</div>)
                : l.options.map((o, i) => (<div key={i} className="ws-line__opt">{o.label}</div>))}
              {promotionNote && <div className="ws-line__offer">{promotionNote}</div>}
              {groupedPromotion && pricesReady && row.promotionDiscount > 0 && <div className="ws-line__offer">{t('cart.promotionDiscount', { amount: wsCurrency(row.promotionDiscount) })}</div>}
              {row.weekdayDiscount > 0 && (
                <div className="ws-line__offer">
                  {t('sum.weekdayDiscount')} {row.weekdayPercent > 0 && `(${wsNumber(row.weekdayPercent)}%)`} · −{wsCurrency(row.weekdayDiscount)}
                </div>
              )}
              {notesEnabled && typeof onNote === 'function' && (
                <div className="ws-line__notewrap">
                  <svg className="ws-line__note-ic" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                  <input
                    className="ws-line__note" type="text" defaultValue={l.note || ''} maxLength={255}
                    placeholder={t('cart.notePlaceholder')}
                    onBlur={(e) => onNote(l.line, e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="ws-line__price">{pricesReady ? `${wsCurrency(row.price)}` : '—'}</div>
            {typeof onRemove === 'function' && (
              <button
                type="button"
                className="ws-line__remove"
                onClick={() => onRemove(row.lines.map((line) => line.line))}
                aria-label={t('cart.removeItem', { name: displayName })}
                title={t('cart.remove')}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M5 7h14"/>
                  <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  <path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                </svg>
              </button>
            )}
          </div>;
        })}
        {typeof onCrossAdd === 'function' && (
          <CrossSell shopId={shop && shop.id} mode={mode} date={date} time={slotTime}
                     basket={basket} placement="cart" onAdd={onCrossAdd}/>
        )}
      </div>

      {hidePrices ? (
        <div className="ws-basket__office">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h3a1 1 0 0 1 1 1v11"/></svg>
          <span><strong>{t('cart.officeCovered')}</strong> {t('cart.officeNoPay', { name: officeName || '' })}</span>
        </div>
      ) : (<>
      <div className="ws-basket__sums">
        {basket.length > 0 && (
          <div className="ws-basket__row">
            <span>{t('cart.subtotal')}</span>
            <span>{pricesReady ? `${wsCurrency(subtotal)}` : '—'}</span>
          </div>
        )}

        {T.remise > 0 && (
          <div className="ws-basket__row ws-basket__row--promo">
            <span>{t('co.promo.title')}</span>
            <span>−{wsCurrency(T.remise)}</span>
          </div>
        )}
        {pricesReady && quoteState.quote?.loyalty_preview?.status === 'available' && Number.isInteger(quoteState.quote.loyalty_preview.points?.points) &&
          <div className="ws-basket__row"><span>{t('personal.estimated')}</span><strong>{quoteState.quote.loyalty_preview.points.points}</strong></div>}
        {T.reward > 0 && <div className="ws-basket__row ws-basket__row--promo"><span>{t('loyaltyUse.title')}</span><span>−{wsCurrency(T.reward)}</span></div>}
        {T.bon > 0 && <div className="ws-basket__row ws-basket__row--promo">
          <span>{t('sum.code')} {quoteState.quote.voucher.code}</span><span>−{wsCurrency(T.bon)}</span>
        </div>}
        {T.weekday > 0 && (
          <div className="ws-basket__row ws-basket__row--promo">
            <span>{t('sum.weekdayDiscount')}{T.weekdayPercent > 0 && ` (${wsNumber(T.weekdayPercent)}%)`}</span>
            <span>−{wsCurrency(T.weekday)}</span>
          </div>
        )}
        {T.weekday === 0 && !T.weekdayThresholdMet && T.weekdayMinimum > 0 && (
          <div className="ws-basket__row ws-basket__row--fee-nudge">
            <span>{t('sum.weekdayDiscountMinimum', { amount: `${wsCurrency(T.weekdayMinimum)}`, remaining: `${wsCurrency(T.weekdayRemaining)}` })}</span>
          </div>
        )}

        {deliveryFeeResult && mode === 'delivery' && (
          <div className={`ws-basket__row${deliveryFee === 0 ? ' ws-basket__row--free' : ''}`}>
            <span>{t('cart.deliveryFee')}{deliveryFee === 0 && deliveryFeeResult.free_delivery_minimum > 0
              ? ' · ' + t('cart.deliveryFreeFrom', { amount: wsCurrency(deliveryFeeResult.free_delivery_minimum) })
              : ''}</span>
            <span>{deliveryFee === 0 ? t('cart.deliveryFree') : `+${wsCurrency(deliveryFee)}`}</span>
          </div>
        )}
        {deliveryFeeResult && mode === 'delivery' && deliveryFee > 0 && deliveryFeeResult.free_delivery_minimum > 0 && deliveryFeeResult.amount_remaining_for_free > 0 && (
          <div className="ws-basket__row ws-basket__row--fee-nudge">
            <span>{t('cart.deliveryRemaining', { amount: wsCurrency(deliveryFeeResult.amount_remaining_for_free) })}</span>
          </div>
        )}

        <div className="ws-basket__total">
          <span>{t('cart.total')}</span>
          <span className="ws-basket__total-amount">{pricesReady ? `${wsCurrency(total)}` : '—'}</span>
        </div>
      </div>

      </>)}
      {quoteState.status === 'loading' && <p className="ws-basket__empty">{wsText("ui.updatingPrices")}</p>}
      {quoteState.status === 'error' && <p className="ws-basket__empty" role="alert">{wsMessage(quoteState.error)}</p>}
      <button className="ws-cta" style={{ background: 'var(--color-primary)' }} {...wsTap(onCheckout, { shield: true })} disabled={!basket.length || quoteState.status !== 'ready' || !quoteState.quote?.totals} aria-busy={quoteState.status === 'loading'}>
        {t('cart.checkout')}
        <Pict d={<path d="M5 12h14M13 5l7 7-7 7"/>} s={13}/>
      </button>

    </aside>
  );
}

// =========================================================================
// CATEGORY ROW : SINGLE LINE, TWO LEVELS
// -------------------------------------------------------------------------
// One line of choices, always in the same place; its CONTENT switches level.
// Never two stacked rows.
//   Level "cats":  [Tout] [catégories…] | [saisons…]
//   Level "subs":  [← Nom de la catégorie] [sous-catégories…]
// The first slot is therefore always occupied, by a different key per level.
// `Tout` and `← Catégorie` are NOT categories: no `category` row backs them
// their icons come from ws_param (via /config), their labels from i18n.
// The back key carries the current category NAME on purpose: once the line
// switches to subcategories, that name would otherwise vanish from screen
// the key both says where you are and lets you leave.
// A category with NO subcategory never switches level: there is nothing to
// switch to. A category with ONE does switch, its subcategory carries a
// label and an illustration of its own, and hiding it made the second level
// vanish for a whole shop. "A single choice is not a choice" was reasoning
// about a filter; a subcategory is also a signpost, and a shop whose entire
// catalogue sits under one of them showed no second level at all.
// =========================================================================
function CategoryRow({ active, sub, onSelect, onSelectSub, onBack, accent, tint, categories, assortments, navIcons }) {
  // i18n : hook global (webshop-i18n-react, chargé avant ce bundle), un
  // repli direct sur WSI18n.t couvre le cas où le hook n'est pas monté.
  const { t, tCategory } = window.useT
    ? window.useT()
    : { t: (k, p) => (window.WSI18n ? window.WSI18n.t(k, p) : k), tCategory: (id, fb) => fb };
  const cats = categories || W_CATEGORIES;
  const assorts = assortments || W_ASSORTMENTS;
  const activeCat = cats.find((c) => String(c.id) === String(active)) || null;
  const subs = activeCat?.subs || [];
  /* Niveau sous-catégories dès qu'il y en a UNE. Le seuil était à deux, au
     motif qu'« un choix unique n'est pas un choix » : vrai d'un filtre, faux
     d'un repère. Relevé en production, Biscuiterie, Boulangerie et
     Pâtisserie n'ont qu'une sous-catégorie peuplée chacune, et une boutique
     dont tout le catalogue tient dans l'une d'elles n'avait aucun second
     niveau. Les sous-catégories vides, elles, sont déjà écartées en amont
     (navCats ne garde que celles qui contiennent un produit du créneau). */
  const subLevel = !!activeCat && subs.length >= 1;
  const catName = activeCat ? tCategory(activeCat.id, activeCat.label) : '';

  const visibleCount = 5;
  const [showAllSubs, setShowAllSubs] = React.useState(false);
  const visibleSubs = showAllSubs ? subs : subs.slice(0, visibleCount);
  const hiddenCount = subs.length - visibleCount;
  React.useEffect(() => { setShowAllSubs(false); }, [active]);

  // Accessibilité : au CHANGEMENT de niveau (pas au premier rendu), le focus
  // se pose sur la première touche de la nouvelle ligne, sinon il retombe en
  // haut de page : et la zone aria-live annonce le nouveau contenu (la ligne
  // se transforme sans qu'aucun élément n'apparaisse ailleurs : rien ne le
  // signalerait par défaut aux lecteurs d'écran).
  const stripRef = React.useRef(null);
  React.useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    let gesture = null;
    let suppressClick = false;
    const down = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      suppressClick = false;
      gesture = { id: event.pointerId, x: event.clientX, left: strip.scrollLeft, dragging: false };
    };
    const move = (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const delta = event.clientX - gesture.x;
      if (!gesture.dragging && Math.abs(delta) < 6) return;
      if (!gesture.dragging) {
        gesture.dragging = true;
        suppressClick = true;
        strip.setPointerCapture(event.pointerId);
        strip.classList.add('is-dragging');
      }
      event.preventDefault();
      strip.scrollLeft = gesture.left - delta;
    };
    const end = (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dragged = gesture.dragging;
      gesture = null;
      strip.classList.remove('is-dragging');
      if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
      // Capture phase prevents the native wsTap pointerup handler from selecting a category.
      if (dragged) { event.preventDefault(); event.stopPropagation(); }
    };
    const click = (event) => {
      if (suppressClick && event.detail !== 0) {
        event.preventDefault(); event.stopPropagation(); suppressClick = false;
      }
    };
    const preventImageDrag = (event) => event.preventDefault();
    strip.addEventListener('pointerdown', down, true);
    strip.addEventListener('pointermove', move, true);
    strip.addEventListener('pointerup', end, true);
    strip.addEventListener('pointercancel', end, true);
    strip.addEventListener('lostpointercapture', end, true);
    strip.addEventListener('click', click, true);
    strip.addEventListener('dragstart', preventImageDrag);
    return () => {
      strip.removeEventListener('pointerdown', down, true);
      strip.removeEventListener('pointermove', move, true);
      strip.removeEventListener('pointerup', end, true);
      strip.removeEventListener('pointercancel', end, true);
      strip.removeEventListener('lostpointercapture', end, true);
      strip.removeEventListener('click', click, true);
      strip.removeEventListener('dragstart', preventImageDrag);
    };
  }, []);
  // Arrows appear only when the strip has hidden categories on that side (mouse users
  // otherwise had no cue that "Viennoiserie" or "Noël" sit past the edge).
  const [edges, setEdges] = React.useState({ left: false, right: false });
  React.useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const update = () => setEdges({ left: strip.scrollLeft > 4, right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4 });
    update();
    strip.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    ro?.observe(strip);
    return () => { strip.removeEventListener('scroll', update); ro?.disconnect(); };
  }, [categories, assortments, active, sub]);
  const nudgeStrip = dir => {
    const strip = stripRef.current;
    if (strip) strip.scrollBy({ left: dir * Math.max(240, strip.clientWidth * 0.7), behavior: 'smooth' });
  };
  const prevLevel = React.useRef(subLevel);
  const [announce, setAnnounce] = React.useState('');
  React.useEffect(() => {
    if (prevLevel.current === subLevel) return;
    prevLevel.current = subLevel;
    if (stripRef.current) stripRef.current.scrollLeft = 0;
    setAnnounce(subLevel ? t('nav.category.subsOf', { category: catName }) : t('nav.category.cats'));
    const first = stripRef.current && stripRef.current.querySelector('button');
    if (first) first.focus();
  }, [subLevel, catName]);

  const activeStyle = { '--cat-accent': accent, '--cat-tint': tint };
  const icons = navIcons || {};

  return (
    <div className={`ws-cats-wrap${edges.left ? ' has-left' : ''}${edges.right ? ' has-right' : ''}`}>
      <span className="ws-vh" aria-live="polite" role="status">{announce}</span>
      {edges.left && <button type="button" className="ws-cats__arrow ws-cats__arrow--left" tabIndex={-1} aria-hidden="true" onClick={() => nudgeStrip(-1)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </button>}
      {edges.right && <button type="button" className="ws-cats__arrow ws-cats__arrow--right" tabIndex={-1} aria-hidden="true" onClick={() => nudgeStrip(1)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>}
      <div className="ws-cats" ref={stripRef}
           aria-label={subLevel ? t('nav.category.subsOf', { category: catName }) : t('nav.category.cats')}>
        {!subLevel && (
          <>
            {/* Première position : état « Tout » (icône ws_param, libellé i18n) */}
            <button key="all" className={`ws-cat${active === 'all' ? ' is-active' : ''}`}
                    {...wsTap(() => onSelect('all'))} style={active === 'all' ? activeStyle : {}}>
              <span className="ws-cat__tile">{icons.all ? <img src={icons.all} alt=""/> : <svg className="ws-cat__all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>}</span>
              <span className="ws-cat__lbl">{t('nav.category.all')}</span>
            </button>
            {cats.map((c) => {
              const isOn = String(active) === String(c.id);
              return (
                <button key={c.id} className={`ws-cat${isOn ? ' is-active' : ''}`} {...wsTap(() => onSelect(c.id))} style={isOn ? activeStyle : {}}>
                  {/* Garde identique aux tuiles voisines (icons.all / icons.back) :
                      une src vide fait recharger la PAGE comme image, échoue au
                      décodage et log une erreur console par tuile et par rendu. */}
                  <span className="ws-cat__tile">{c.img ? <img src={c.img} alt=""/> : null}</span>
                  <span className="ws-cat__lbl">{tCategory(c.id, c.label)}</span>
                </button>
              );
            })}
            {/* Seasonal assortments : same badge style, but distinct shape (notched corner) */}
            {assorts.length > 0 && <div className="ws-cats__sep" aria-hidden="true"/>}
            {assorts.map((a) => {
              const isOn = active === `season:${a.id}`;
              return (
                <button key={a.id} className={`ws-cat ws-cat--season${isOn ? ' is-active' : ''}`} {...wsTap(() => onSelect(`season:${a.id}`))} style={isOn ? activeStyle : {}}>
                  <span className="ws-cat__tile">
                    {a.img ? <img src={a.img} alt=""/> : null}
                  </span>
                  <span className="ws-cat__lbl">{a.label}</span>
                </button>
              );
            })}
          </>
        )}

        {subLevel && (
          <>
            {/* Première position : état « retour », porteur du nom de la
                catégorie courante (dire où on est + permettre d'en sortir). */}
            <button key="back" type="button" className="ws-categories-back" onClick={onBack} aria-label={t('nav.category.backAll')} title={t('nav.category.backAll')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            {visibleSubs.map((s) => {
              const isOn = String(sub) === String(s.id);
              return (
                <button key={s.id} className={`ws-subcat${isOn ? ' is-active' : ''}`}
                        aria-pressed={isOn}
                        {...wsTap(() => onSelectSub(isOn ? null : s.id))} style={isOn ? activeStyle : {}}>
                  <span className="ws-subcat__tile">{s.img ? <img src={s.img} alt=""/> : null}</span>
                  <span className="ws-subcat__lbl">{s.label}</span>
                </button>
              );
            })}
            {hiddenCount > 0 && !showAllSubs && (
              <button className="ws-subcat ws-subcat--more" {...wsTap(() => setShowAllSubs(true))}>
                <span className="ws-subcat__tile"><span className="ws-subcat__more-num">+{hiddenCount}</span></span>
                <span className="ws-subcat__lbl">{t('common.seeMore')}</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// NAVBAR : three variants share the same internals but wrap differently
// =========================================================================

// Variant A : Subtle: small shop chip after brand

function ProductSearchField({ query, onChange, mobile = false, disabled = false }) {
  const { t } = wsUseT();
  return <label className={`ws-product-search ws-product-search--${mobile ? 'mobile' : 'desktop'}`}>
    <Pict d={ICONS.search} s={17}/>
    <input id={mobile ? 'ws-mobile-product-search' : undefined} name="product-search" type="search" autoComplete="off"
      aria-label={t('productSearch.label')} placeholder={t('productSearch.placeholder')}
      value={query} maxLength={100} autoFocus={mobile} disabled={disabled}
      onChange={event => {
        const input = event.currentTarget;
        // Ignore autofill on the catalogue field while the customer is using another control.
        if (!input.disabled && input === input.ownerDocument.activeElement) onChange(input.value);
      }}/>
  </label>;
}

function NavbarA({ shop, mode, onMode, onSwitchShop, cartCount, date, onDate, user, onAccount, onAllergens, loyaltyEnabled, onLoyalty, activeVoucher, newVouchers,
                   collectCutoffPassed, collectCutoffLabel, deliveryCutoffPassed, deliveryCutoffLabel, minLeadDays, officeMenus, productSearch, searchToggle }) {
  const { t } = wsUseT();
  return (
    <header className="ws-nav ws-nav--A">
      <div className="ws-nav__left">
        <div className="ws-nav__brandblock">
          <img className="ws-nav__logo" src={import.meta.env.BASE_URL + 'logo.png'} alt="L'Atelier By"/>
          <button className="ws-nav__shopchip" onClick={onSwitchShop}>
            <span className="ws-nav__shopchip-dot"/>
            <span>{shop.name}</span>
            <Pict d={ICONS.chev} s={10}/>
          </button>
        </div>
        <DatePill mode={mode} value={date} onChange={onDate} shopId={shop.id}
          collectCutoffPassed={collectCutoffPassed} collectCutoffLabel={collectCutoffLabel}
          deliveryCutoffPassed={deliveryCutoffPassed} deliveryCutoffLabel={deliveryCutoffLabel}
          minLeadDays={minLeadDays}/>

      </div>
      <div className="ws-nav__right">
        {window.LangChip && <window.LangChip className="ws-nav__lang" />}
        {searchToggle}
        {window.AllergenNavButton && <window.AllergenNavButton onClick={onAllergens}/>}
        {loyaltyEnabled && <button type="button" className="ws-nav__icon ws-nav__loyalty" aria-label={t('loyaltyWallet.open')} title={activeVoucher ? `${t('loyaltyWallet.open')} · ${t('vouchers.active')}` : t('loyaltyWallet.open')} aria-haspopup="dialog" onClick={onLoyalty}>
          <LoyaltyCardIcon size={22} active={!!activeVoucher} updated={newVouchers}/>
        </button>}
        <button className="ws-nav__icon" aria-label={t('nav.accountAria')} onClick={onAccount}>
          {user
            ? <span className="ws-nav__avatar" aria-hidden="true">{user.firstName?.[0] || user.email?.[0]?.toUpperCase() || '·'}</span>
            : <Pict d={ICONS.user} s={15}/>}
        </button>
        <button className={`ws-nav__icon ws-nav__cart${cartCount > 0 ? ' ws-nav__cart--full' : ''}`} aria-label={t('nav.cartAria')}>
          <span className="ws-nav__cart-ico">
            <Pict d={ICONS.bag} s={17}/>
            {cartCount > 0 && <span className="ws-nav__cart-badge">{cartCount}</span>}
          </span>
        </button>
      </div>
      <div className="ws-nav__ordering">
        <ModePills shopId={shop.id} mode={mode} onChange={onMode}
          collectCutoffPassed={collectCutoffPassed} collectCutoffLabel={collectCutoffLabel}
          deliveryCutoffPassed={deliveryCutoffPassed} deliveryCutoffLabel={deliveryCutoffLabel}/>
        {productSearch}
        {officeMenus}
      </div>
    </header>
  );
}

// Variant B : Medium: full colored brand bar above navbar
function NavbarB({ shop, mode, onMode, onSwitchShop, cartCount, date, onDate, onAllergens, loyaltyEnabled, onLoyalty, activeVoucher, newVouchers,
                   collectCutoffPassed, collectCutoffLabel, deliveryCutoffPassed, deliveryCutoffLabel, minLeadDays, productSearch, searchToggle }) {
  const { t } = wsUseT();
  return (
    <>
      <div className="ws-shopbar" style={{ background: 'var(--color-primary)' }}>
        <div className="ws-shopbar__inner">
          <span className="ws-shopbar__pin"><Pict d={ICONS.pin} s={12}/></span>
          <span className="ws-shopbar__name">{tRich(t, 'nav.orderingAt', { shop: shop.name })}</span>
          <span className="ws-shopbar__city">{shop.city} · {shop.address}</span>
          <button className="ws-shopbar__switch" onClick={onSwitchShop}> {wsText("ui.changeShop")} <Pict d={ICONS.switch} s={12}/>
          </button>
        </div>
      </div>
      <header className="ws-nav ws-nav--B">
        <div className="ws-nav__left">
          <span className="ws-nav__brand">L'Atelier By</span>
          <DatePill mode={mode} value={date} onChange={onDate} shopId={shop.id}
            collectCutoffPassed={collectCutoffPassed} collectCutoffLabel={collectCutoffLabel}
            deliveryCutoffPassed={deliveryCutoffPassed} deliveryCutoffLabel={deliveryCutoffLabel}
            minLeadDays={minLeadDays}/>


          <ModePills shopId={shop.id} mode={mode} onChange={onMode}
            collectCutoffPassed={collectCutoffPassed} collectCutoffLabel={collectCutoffLabel}
            deliveryCutoffPassed={deliveryCutoffPassed} deliveryCutoffLabel={deliveryCutoffLabel}/>
          {productSearch}
        </div>
        <div className="ws-nav__right">
          {window.LangChip && <window.LangChip className="ws-nav__lang"/>}
          {searchToggle}
          {window.AllergenNavButton && <window.AllergenNavButton onClick={onAllergens}/>}
          {loyaltyEnabled && <button type="button" className="ws-nav__icon ws-nav__loyalty" aria-label={t('loyaltyWallet.open')} title={activeVoucher ? `${t('loyaltyWallet.open')} · ${t('vouchers.active')}` : t('loyaltyWallet.open')} aria-haspopup="dialog" onClick={onLoyalty}>
            <LoyaltyCardIcon size={22} active={!!activeVoucher} updated={newVouchers}/>
          </button>}
          <button className="ws-nav__icon" aria-label={t('nav.accountAria')}><Pict d={ICONS.user} s={15}/></button>
          <button className="ws-nav__icon ws-nav__cart" aria-label={t('nav.cartAria')}>
            <Pict d={ICONS.bag} s={15}/>
            {cartCount > 0 && <span className="ws-nav__cart-badge">{cartCount}</span>}
          </button>
        </div>
      </header>
    </>
  );
}

// Variant C : Strong: full per-shop accent. Brand wordmark, navbar background, CTA, focus rings all picked up.
function NavbarC({ shop, mode, onMode, onSwitchShop, cartCount, date, onDate, onAllergens, loyaltyEnabled, onLoyalty, activeVoucher, newVouchers,
                   collectCutoffPassed, collectCutoffLabel, deliveryCutoffPassed, deliveryCutoffLabel, minLeadDays, productSearch, searchToggle }) {
  const { t } = wsUseT();
  return (
    <header className="ws-nav ws-nav--C" style={{ '--shop-accent': shop.accent }}>
      <div className="ws-nav__left">
        <div className="ws-nav__brandwrap">
          <span className="ws-nav__brand" style={{ color: shop.accent }}>L'Atelier By</span>
          <button className="ws-nav__shopplate" onClick={onSwitchShop} style={{ color: shop.accent, borderColor: shop.accent }}>
            <Pict d={ICONS.pin} s={11}/>
            <span>{shop.name}</span>
            <span className="ws-nav__shopplate-city">· {shop.city}</span>
            <Pict d={ICONS.chev} s={10}/>
          </button>
        </div>
        <DatePill mode={mode} value={date} onChange={onDate} shopId={shop.id}
          collectCutoffPassed={collectCutoffPassed} collectCutoffLabel={collectCutoffLabel}
          deliveryCutoffPassed={deliveryCutoffPassed} deliveryCutoffLabel={deliveryCutoffLabel}
          minLeadDays={minLeadDays}/>
        <ModePills shopId={shop.id} mode={mode} onChange={onMode}
          collectCutoffPassed={collectCutoffPassed} collectCutoffLabel={collectCutoffLabel}
          deliveryCutoffPassed={deliveryCutoffPassed} deliveryCutoffLabel={deliveryCutoffLabel}/>
          {productSearch}
      </div>
      <div className="ws-nav__right">
        {window.LangChip && <window.LangChip className="ws-nav__lang"/>}
          {searchToggle}
        {window.AllergenNavButton && <window.AllergenNavButton onClick={onAllergens}/>}
        {loyaltyEnabled && <button type="button" className="ws-nav__icon ws-nav__loyalty" aria-label={t('loyaltyWallet.open')} title={activeVoucher ? `${t('loyaltyWallet.open')} · ${t('vouchers.active')}` : t('loyaltyWallet.open')} aria-haspopup="dialog" onClick={onLoyalty}>
          <LoyaltyCardIcon size={22} active={!!activeVoucher} updated={newVouchers}/>
        </button>}
        <button className="ws-nav__icon" aria-label={t('nav.accountAria')}><Pict d={ICONS.user} s={15}/></button>
        <button className="ws-nav__icon ws-nav__cart" aria-label={t('nav.cartAria')}>
          <Pict d={ICONS.bag} s={15}/>
          {cartCount > 0 && <span className="ws-nav__cart-badge">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

// =========================================================================
// AUTH MODALS : login / register, account, office request
// =========================================================================
function useSwipeDownToClose(onClose, scrollEl) {
  /* Ref-CALLBACK, pas effet : les panneaux qui utilisent ce hook rendent null
     tant qu'ils sont fermés. L'ancien useEffect (deps [onClose]) tournait au
     premier montage : panneau absent, rien à écouter, et ne se rejouait à
     l'ouverture QUE si l'identité d'onClose changeait : le geste de fermeture
     n'était branché qu'au gré des re-rendus du parent. Le ref-callback, lui,
     s'exécute précisément quand le nœud apparaît/disparaît. */
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const cleanupRef = React.useRef(null);
  return React.useCallback((el) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!el) return;
    const state = { y0: 0, dy: 0, dragging: false, atTop: true };
    function onStart(e) {
      const t = e.touches ? e.touches[0] : e;
      // Le panneau porteur du geste n'est pas forcément le scroller (fiche
      // produit : .pdm est overflow:hidden, c'est .pdm-scroll qui défile).
      // Lire scrollTop sur le panneau armait le drag À CHAQUE toucher :
      // remonter dans la fiche tirait la bottom-sheet au lieu de défiler, et
      // au-delà de 110 px la fermait, configuration perdue.
      const sc = (scrollEl && scrollEl.current) || el;
      state.atTop = sc.scrollTop <= 0;
      // Allow dragging when starting at scroll-top OR on the handle itself
      const onHandle = e.target.closest && e.target.closest('.ws-modal__handle');
      if (!state.atTop && !onHandle) return;
      state.y0 = t.clientY; state.dy = 0; state.dragging = true;
      el.style.transition = 'none';
    }
    function onMove(e) {
      if (!state.dragging) return;
      const t = e.touches ? e.touches[0] : e;
      const dy = Math.max(0, t.clientY - state.y0);
      state.dy = dy;
      el.style.transform = `translateY(${dy}px)`;
      if (dy > 4 && e.cancelable) e.preventDefault();
    }
    function onEnd() {
      if (!state.dragging) return;
      state.dragging = false;
      el.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)';
      if (state.dy > 110) {
        el.style.transform = 'translateY(100%)';
        setTimeout(() => onCloseRef.current && onCloseRef.current(), 200);
      } else {
        el.style.transform = '';
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    cleanupRef.current = () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function ModalShell({ onClose, children, narrow, split }) {
  const { t } = wsUseT();
  const backdropPress = React.useRef(false);
  // useSwipeDownToClose returns a callback ref (no .current): keep our own handle on
  // the panel so the scroll state (rail arrows, is-scrolled) can read it.
  const panelEl = React.useRef(null);
  const swipeRef = useSwipeDownToClose(onClose);
  const panelRef = React.useCallback((el) => { panelEl.current = el; swipeRef(el); }, [swipeRef]);
  const [showArrows, setShowArrows] = React.useState({ up: false, down: false });
  React.useEffect(() => {
    const el = panelEl.current; if (!el) return;
    const update = () => {
      const can = el.scrollHeight > el.clientHeight + 4;
      setShowArrows({
        up: can && el.scrollTop > 8,
        down: can && (el.scrollTop + el.clientHeight) < (el.scrollHeight - 8),
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);
  function nudge(dir) {
    const el = panelEl.current; if (!el) return;
    el.scrollBy({ top: dir * Math.max(180, el.clientHeight * 0.6), behavior: 'smooth' });
  }
  return (
    <div className="ws-modal"
      onPointerDown={(event) => {
        backdropPress.current = event.button === 0 && event.target === event.currentTarget;
      }}
      onPointerCancel={() => { backdropPress.current = false; }}
      onClick={(event) => {
        // A text-selection drag may end on the backdrop without starting there.
        const startedOnBackdrop = backdropPress.current;
        backdropPress.current = false;
        if (startedOnBackdrop && event.target === event.currentTarget) onClose();
      }}>
      <div ref={panelRef} className={`ws-modal__panel${narrow ? ' ws-modal__panel--narrow' : ''}${split ? ' ws-modal__panel--split' : ''}${showArrows.up ? ' is-scrolled' : ''}`} onClick={(e) => e.stopPropagation()}>
        <span className="ws-modal__handle" aria-hidden="true"/>
        <button className="ws-modal__close" onClick={onClose} aria-label={t('common.close2')}><Pict d={ICONS.close} s={14}/></button>
        {children}
        <div className="ws-modal__rail" aria-hidden={!(showArrows.up || showArrows.down)}>
          <button type="button" className={`ws-modal__rail-btn${showArrows.up ? '' : ' is-disabled'}`} onClick={() => nudge(-1)} aria-label={t('scroll.up')}>
            <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 10l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button type="button" className={`ws-modal__rail-btn${showArrows.down ? '' : ' is-disabled'}`} onClick={() => nudge(1)} aria-label={t('scroll.down')}>
            <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Préfixes internationaux proposés dans les formulaires (défaut +32 Belgique).
/* Indicatifs européens. L'ÉTIQUETTE COMMENCE PAR LE DRAPEAU ET L'INDICATIF,
   le nom du pays ensuite : le sélecteur replié n'affiche que le début, et ce
   sont ces deux-là qui doivent y tenir. Le nom sert à choisir dans la liste
   ouverte, pas à se relire après coup.

   Les quatre premiers sont ceux de la clientèle réelle et sortent de l'ordre
   alphabétique — un client belge ne doit pas faire défiler pour trouver +32.

   Les drapeaux sont des émoji « indicateurs régionaux ». Windows ne les rend
   pas et affiche les deux lettres du pays à la place (BE, FR) : dégradé
   acceptable, l'information reste lisible. Ne pas les remplacer par des
   images — trente-deux requêtes pour une liste déroulante. */
const PHONE_PREFIXES = [
  ['+32',  '🇧🇪 +32 Belgique',        1],
  ['+33',  '🇫🇷 +33 France',          1],
  ['+44',  '🇬🇧 +44 Royaume-Uni',     1],
  ['+31',  '🇳🇱 +31 Pays-Bas',        1],
  ['+49',  '🇩🇪 +49 Allemagne',       0],
  ['+43',  '🇦🇹 +43 Autriche',        0],
  ['+359', '🇧🇬 +359 Bulgarie',       0],
  ['+357', '🇨🇾 +357 Chypre',         0],
  ['+385', '🇭🇷 +385 Croatie',        0],
  ['+45',  '🇩🇰 +45 Danemark',        0],
  ['+34',  '🇪🇸 +34 Espagne',         0],
  ['+372', '🇪🇪 +372 Estonie',        0],
  ['+358', '🇫🇮 +358 Finlande',       0],
  ['+30',  '🇬🇷 +30 Grèce',           0],
  ['+36',  '🇭🇺 +36 Hongrie',         0],
  ['+353', '🇮🇪 +353 Irlande',        0],
  ['+354', '🇮🇸 +354 Islande',        0],
  ['+39',  '🇮🇹 +39 Italie',          0],
  ['+371', '🇱🇻 +371 Lettonie',       0],
  ['+423', '🇱🇮 +423 Liechtenstein',  0],
  ['+370', '🇱🇹 +370 Lituanie',       0],
  ['+352', '🇱🇺 +352 Luxembourg',     0],
  ['+356', '🇲🇹 +356 Malte',          0],
  ['+47',  '🇳🇴 +47 Norvège',         0],
  ['+48',  '🇵🇱 +48 Pologne',         0],
  ['+351', '🇵🇹 +351 Portugal',       0],
  ['+40',  '🇷🇴 +40 Roumanie',        0],
  ['+421', '🇸🇰 +421 Slovaquie',      0],
  ['+386', '🇸🇮 +386 Slovénie',       0],
  ['+46',  '🇸🇪 +46 Suède',           0],
  ['+41',  '🇨🇭 +41 Suisse',          0],
  ['+420', '🇨🇿 +420 Tchéquie',       0],
];

/* Rend les options groupées : les quatre courants, puis le reste. Un groupe
   nommé vaut mieux qu'un séparateur muet — la liste ouverte dit POURQUOI ces
   quatre-là sont en haut. */
function splitPhoneInput(value, currentPrefix) {
  const international = String(value).trim().replace(/^00/, '+').replace(/[\s().-]/g, '');
  if (international.startsWith('+')) {
    const match = PHONE_PREFIXES.map(([prefix]) => prefix)
      .sort((a, b) => b.length - a.length).find((prefix) => international.startsWith(prefix));
    if (match) return { phonePrefix: match, phone: international.slice(match.length) };
  }
  return { phonePrefix: currentPrefix, phone: value };
}

function phonePrefixOptions() {
  const courants = PHONE_PREFIXES.filter((x) => x[2]);
  const autres   = PHONE_PREFIXES.filter((x) => !x[2]);
  return (
    <>
      <optgroup label={wsText("ui.commonPrefixes")}>
        {courants.map(([v, l]) => <option key={v} value={v}>{l.split(' ')[0]} {v} {new Intl.DisplayNames([window.WSI18n.getLang()], { type: 'region' }).of(Array.from(l.split(' ')[0]).map(c => String.fromCharCode(c.codePointAt(0) - 127397)).join(''))}</option>)}
      </optgroup>
      <optgroup label={wsText("ui.europePrefixes")}>
        {autres.map(([v, l]) => <option key={v} value={v}>{l.split(' ')[0]} {v} {new Intl.DisplayNames([window.WSI18n.getLang()], { type: 'region' }).of(Array.from(l.split(' ')[0]).map(c => String.fromCharCode(c.codePointAt(0) - 127397)).join(''))}</option>)}
      </optgroup>
    </>
  );
}

// The closed field shows only « 🇧🇪 +32 » so country and number fit on one row;
// the native list underneath keeps the country names.
function PhonePrefixSelect({ value, onChange, label }) {
  const flag = ((PHONE_PREFIXES.find(([v]) => v === value) || [])[1] || '').split(' ')[0];
  return <span className="ws-phone__pfxwrap">
    <span className="ws-phone__pfxshow" aria-hidden="true">{flag} {value}</span>
    <select className="ws-phone__pfx" autoComplete="tel-country-code" value={value} onChange={onChange} aria-label={label}>
      {phonePrefixOptions()}
    </select>
  </span>;
}

// International postal-code input. Locality suggestions are currently
// available only for four-digit Belgian codes.
// Match the API postal-code contract, including Polish and Dutch codes.
const CP_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,15}$/;
const CP_LOCALITIES = typeof __WS_POSTCODE_LOCALITIES__ === 'undefined' ? {} : __WS_POSTCODE_LOCALITIES__;
async function cpLocalities(cp) {
  const code = String(cp || '').trim();
  if (!/^[1-9][0-9]{3}$/.test(code)) return [];
  return CP_LOCALITIES[code] || [];
}
// Champ CP + localité auto. `variant` adapte le markup au formulaire hôte
// ('modal' → ws-field du LoginModal, 'acc' → ws-acc__field du compte).
function CpField({ cp, locality, onCp, onLocality, onOpts, variant, disabled = false }) {
  const { t } = wsUseT();
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    let alive = true;
    const v = String(cp || '').trim();
    if (!CP_RE.test(v)) {
      setOpts([]); if (onOpts) onOpts([]);
      if (locality) onLocality('');
      return;
    }
    cpLocalities(v).then((list) => {
      if (!alive) return;
      setOpts(list); if (onOpts) onOpts(list);
      if (list.length === 1) onLocality(list[0]);                    // localité unique → auto
      else if (list.length > 1 && !list.includes(locality)) onLocality(''); // ambigu → choix requis
    });
    return () => { alive = false; };
  }, [cp]);
  const acc = variant === 'acc';
  const fieldCls = acc ? 'ws-acc__field' : 'ws-field';
  const inputCls = acc ? 'ws-acc__input' : undefined;
  const lbl = (t) => acc ? <span className="ws-acc__field-label">{t}</span> : <span>{t}</span>;
  const locHint = { margin: '2px 0 0', fontSize: 12.5, opacity: .75 };
  return (
    <>
      <label className={fieldCls}>{lbl(wsText("ui.postal"))}
        <input className={inputCls} value={cp} disabled={disabled} onChange={(e) => {
          setOpts([]); if (onOpts) onOpts([]); onLocality(''); onCp(e.target.value);
        }}
          autoComplete="postal-code" maxLength={16} placeholder="1500" required/>
        {opts.length === 1 && locality && <p className="ws-cp-locality" style={locHint}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg> {locality}</p>}
      </label>
      {opts.length === 0 && CP_RE.test(String(cp).trim()) && (
        <label className={fieldCls}>{lbl(wsText("ui.locality"))}
          <input className={inputCls} value={locality} disabled={disabled} maxLength={120}
            autoComplete="address-level2" onChange={(e) => onLocality(e.target.value)}/>
        </label>
      )}
      {opts.length > 1 && (
        <label className={fieldCls}>{lbl(wsText("ui.locality"))}
          <select className={inputCls} value={locality} disabled={disabled} onChange={(e) => onLocality(e.target.value)} required>
            <option value="">{t('cp.pickLocality')}</option>
            {opts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}
    </>
  );
}

function SmsPasswordReset({ onBack }) {
  const { t } = wsUseT();
  const [phone, setPhone] = useState('');
  const [prefix, setPrefix] = useState('+32');
  const [request, setRequest] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const mounted = React.useRef(true);
  const inFlight = React.useRef(false);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);
  const cooldown = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const errorText = (value) => t(['SMS_RESET_PHONE', 'SMS_RESET_LIMIT', 'SMS_RESET_INVALID', 'SMS_RESET_PASSWORD'].includes(value) ? 'smsReset.' + value : 'smsReset.SMS_RESET_UNAVAILABLE');
  async function send(event) {
    event?.preventDefault();
    if (inFlight.current || Date.now() < retryAt) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await window.WSAuth.otpRequest({ phone, phonePrefix: prefix });
      if (!mounted.current) return;
      // Even transport failures may mean a message was sent: never immediately retry.
      setRetryAt(Date.now() + (result.retry_after || 60) * 1000); setNow(Date.now());
      if (!result.ok) { setError(errorText(result.error)); return; }
      setRequest(result); setCode('');
    } catch { if (mounted.current) setError(errorText('SMS_RESET_UNAVAILABLE')); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function save(event) {
    event.preventDefault();
    if (inFlight.current) return;
    if ([...password].length < 4 || password !== confirm) { setError(errorText('SMS_RESET_PASSWORD')); return; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await window.WSAuth.otpSetPassword({ requestToken: request.request_token, code, password, passwordConfirm: confirm });
      if (!mounted.current) return;
      if (result.ok) { setDone(true); setPassword(''); setConfirm(''); setCode(''); setRequest(null); }
      else setError(errorText(result.error));
    } catch { if (mounted.current) setError(errorText('SMS_RESET_UNAVAILABLE')); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  if (done) return <div className="ws-form"><p role="status">{t('smsReset.success')}</p><button type="button" className="ws-cta ws-cta--block" onClick={onBack}>{t('ui.backLogin')}</button></div>;
  return <form className="ws-form" onSubmit={request ? save : send}>
    <p className="ws-modal__lede" role="status">{t(request ? 'smsReset.sent' : 'smsReset.hint')}</p>
    {!request && <div className="ws-form__row2">
      <label className="ws-field"><span>{t('smsReset.prefix')}</span><input type="tel" value={prefix} maxLength={4} required pattern="[+]?[0-9]{1,3}" onChange={e => setPrefix(e.target.value)} autoComplete="tel-country-code" disabled={busy}/></label>
      <label className="ws-field"><span>{t('form.phone')}</span><input type="tel" value={phone} required maxLength={32} onChange={e => { setPhone(e.target.value); setError(''); }} autoComplete="tel-national" disabled={busy}/></label>
    </div>}
    {request && <>
      <label className="ws-field"><span>{t('smsReset.code')}</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} autoFocus disabled={busy}/></label>
      <label className="ws-field"><span>{t('acc.newPassword')}</span><input type="password" autoComplete="new-password" minLength={4} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/></label>
      <label className="ws-field"><span>{t('acc.confirmPassword')}</span><input type="password" autoComplete="new-password" minLength={4} required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy}/></label>
    </>}
    {error && <p className="ws-form__err" role="alert">{error}</p>}
    <button type="submit" className="ws-cta ws-cta--block" disabled={busy || (!request && cooldown > 0)}>{busy ? t('smsReset.working') : t(request ? 'smsReset.save' : 'smsReset.send')}</button>
    {cooldown > 0 && <p>{t('smsReset.retry', { seconds: cooldown })}</p>}
    {request && <button type="button" className="ws-linkbtn" disabled={busy || cooldown > 0} onClick={send}>{t('smsReset.resend')}</button>}
    {request && <button type="button" className="ws-linkbtn" disabled={busy} onClick={() => { setRequest(null); setCode(''); setPassword(''); setConfirm(''); setError(''); }}>{t('smsReset.otherPhone')}</button>}
    <button type="button" className="ws-linkbtn" disabled={busy} onClick={onBack}>{t('ui.backLogin')}</button>
  </form>;
}

function LoginModal({ open, onClose, onLogin, onRegister, onGoToAccount, shopId, initialTab = 'login', invitationRegistration = false }) {
  const { t } = wsUseT();
  const [tab, setTab] = useState('login');
  useEffect(() => { if (open) { setTab(initialTab); setForgot(false); setErr(''); } }, [open, initialTab]);
  const [form, setForm] = useState({ identifier: '', email: '', phone: '', phonePrefix: '+32', password: '', firstName: '', lastName: '', postalCode: '', locality: '', authMethod: 'email' });
  const [err, setErr] = useState('');
  const [canResendActivation, setCanResendActivation] = useState(false);
  const [activation, setActivation] = useState(null);
  const [activationNotice, setActivationNotice] = useState('');
  const registrationLogin = React.useRef(null);
  useEffect(() => {
    if (!open) {
      registrationLogin.current = null;
      setActivation(null);
      setForm(f => ({ ...f, password: '' }));
    }
  }, [open]);

  const [loading, setLoading] = useState(false);
  /* Password reset proves ownership through the e-mail address. This also
     activates the client record which was created by a guest checkout. */
  const [forgot, setForgot] = useState(false);
  const [forgotChannel, setForgotChannel] = useState('email');
  const [forgotIdent, setForgotIdent] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [cpOpts, setCpOpts] = useState([]);      // localités du CP saisi (validation « localité choisie »)
  /* Reconnaissance par la boutique : l'inscription a trouvé une fiche au même
     numéro. On ne referme PAS la fenêtre tant que le client n'a pas répondu
     rattacher son historique d'achats est sa décision, pas la nôtre. */
  const [connu, setConnu] = useState(null);      // { prenom, concordances[] } | null
  const [lienEtat, setLienEtat] = useState('');  // '' | 'envoi' | 'pending' | 'refus'
  if (!open) return null;
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); setErr(''); }
  async function submit(e) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      if (tab === 'login') {
        if (!form.identifier || !form.password) { setErr(wsText("error.loginRequired")); return; }
        const r = window.WSAuth
          ? await window.WSAuth.login({ identifier: form.identifier, password: form.password, phonePrefix: form.phonePrefix, authMethod: form.authMethod })
          : SRV_REQUIRED('de connexion');
        if (!r.ok) {
          // Compte existant sans mot de passe -> panneau "définir votre mot de passe"
          // (on pré-remplit avec ce qui vient d'être tapé au login).
          if (r.error === 'CLIENT_ACTIVATION_REQUIRED') { setActivation({ email: form.identifier.includes('@') ? form.identifier : '', existing: true }); setErr(''); return; }
          setErr(r.error || wsText("error.credentials")); return;
        }
        onLogin(r.user); onClose();
      } else {
        if (!form.firstName || !form.lastName) { setErr(wsText("error.nameRequired")); return; }
        // L'inscription se fait par email (le téléphone est optionnel), le
        // serveur n'a jamais accepté l'inscription par téléphone seul, le
        // formulaire ne doit pas la promettre.
        if (!form.email) { setErr(wsText("error.emailRequired")); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setErr(wsText('error.email')); return; }
        if (!form.phone) { setErr(wsText("error.phoneRequired")); return; }
        if ((form.password || '').length < 4) { setErr(wsText("error.passwordLength")); return; }
        // Code postal OBLIGATOIRE (collecte réseau) + localité confirmée quand
        // le code couvre plusieurs localités.
        if (!CP_RE.test(String(form.postalCode).trim())) { setErr(wsText("error.postal")); return; }
        if (cpOpts.length > 1 && !form.locality) { setErr(wsText("error.locality")); return; }
        const r = window.WSAuth
          ? await window.WSAuth.register({ ...form, shopId })
          : SRV_REQUIRED("d'inscription");
        if (!r.ok) {
          setCanResendActivation(Boolean(r.exists));
          // Keep the failed registration visible; never turn a duplicate into success.
          setErr(r.error || wsText("error.register")); return;
        }
        if (invitationRegistration) {
          const result = r.user ? r : await window.WSAuth.login({ identifier: form.email.trim(), password: form.password });
          if (!result.ok) { setErr(result.error || wsText('error.credentials')); setTab('login'); setForm(f => ({ ...f, identifier: form.email.trim() })); return; }
          onGoToAccount(result.user); onClose(); return;
        }
        if (r.activationRequired) {
          registrationLogin.current = { identifier: form.email.trim(), password: form.password };
          setActivation({ email: form.email.trim(), sentEmail: form.email.trim(), sent: r.emailSent });
          setActivationNotice(''); setErr(''); setForm(f => ({ ...f, password: '' }));
          return;
        }
        /* Reconnu par la boutique : le compte est créé et valide, on le
           signale à l'application : mais l'écran reste ouvert pour proposer
           le rattachement. Refermer ici ferait disparaître la proposition
           sans que personne ne l'ait vue. */
        if (r.connuEnBoutique && r.connuEnBoutique.prenom) {
          onRegister(r.user); setConnu(r.connuEnBoutique); return;
        }
        onRegister(r.user); onClose();
      }
    } catch (_) {
      setErr(wsText("error.network"));
    } finally {
      setLoading(false);
    }
  }
  /* Dépose la demande de rattachement. La boutique tranchera : le webshop
     n'a aucun moyen de vérifier que ce numéro est bien celui du visiteur. */
  async function demanderLien() {
    setLienEtat('envoi');
    const r = await window.WSAuth.linkAsk();
    if (!r.ok) { setErr(r.error || wsText("error.request")); setLienEtat(''); return; }
    setLienEtat('pending');
  }

  function fermerOubli() { setForgot(false); setForgotSent(false); setTab('login'); setErr(''); }
  async function demanderLienReset() {
    setErr('');
    const email = (forgotIdent || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr(wsText("error.email")); return; }
    setLoading(true);
    try {
      const r = window.WSAuth ? await window.WSAuth.resetRequest({ email }) : SRV_REQUIRED('de réinitialisation');
      if (r.ok) { setForgotSent(true); return; }
      setErr(r.error || wsText("error.send"));
    } catch (_) { setErr(wsText("error.network")); }
    finally { setLoading(false); }
  }

  async function goToRegisteredAccount() {
    if (loading || !registrationLogin.current) return;
    setLoading(true); setErr('');
    try {
      const result = await window.WSAuth.login(registrationLogin.current);
      if (!result.ok) { setErr(result.error || wsText('error.credentials')); return; }
      registrationLogin.current = null;
      onGoToAccount(result.user);
      onClose();
    } catch { setErr(wsText('error.network')); }
    finally { setLoading(false); }
  }

  async function resendActivation(event) {
    event.preventDefault(); setErr(''); setActivationNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(activation.email.trim())) { setErr(t('error.email')); return; }
    setLoading(true);
    try {
      const result = await window.WSAuth.resendActivation(activation.email.trim());
      if (!result.ok) { setErr(result.error); return; }
      setActivationNotice(t('activation.resent'));
    } finally { setLoading(false); }
  }
  if (activation) return (
    <ModalShell onClose={onClose} narrow>
      <h2 className="ws-modal__title">{t(activation.existing ? 'activation.title' : 'activation.created')}</h2>
      <p className="ws-modal__lede" role="status">{t(activation.existing ? 'activation.required' : activation.sent ? 'activation.sent' : 'activation.mailFailed', { email: activation.sentEmail || activation.email })}</p>
      {!activation.existing ? <div className="ws-form">
        <p>{t('activation.accountWarning')}</p>
        {err && <p className="ws-form__err" role="alert">{wsMessage(err)}</p>}
        <button type="button" className="ws-cta ws-cta--block" disabled={loading} onClick={goToRegisteredAccount}>
          {t(loading ? 'ui.loading' : 'activation.goToAccount')}
        </button>
      </div> : <form className="ws-form" onSubmit={resendActivation} noValidate>
        <label className="ws-field"><span>{t('form.email')}</span><input type="email" autoComplete="email" value={activation.email} onChange={e => setActivation(a => ({ ...a, email: e.target.value }))}/></label>
        {err && <p className="ws-form__err" role="alert">{wsMessage(err)}</p>}
        {activationNotice && <p role="status">{wsMessage(activationNotice)}</p>}
        <button className="ws-cta ws-cta--block" disabled={loading}>{t(loading ? 'ui.sending' : 'activation.resend')}</button>
        <button type="button" className="ws-linkbtn" onClick={() => { setActivation(null); setErr(''); setTab('login'); }}>{t('ui.backLogin')}</button>
      </form>}
    </ModalShell>
  );
  return (
    <ModalShell onClose={onClose} narrow>
      <p className="ws-modal__eyebrow">{t('auth.myAccount')}</p>
      {connu ? (
        /* ── RECONNU PAR LA BOUTIQUE ─────────────────────────────────────
           Le compte est créé : cet écran ne conditionne rien, il PROPOSE.
           On n'affiche que le prénom et des libellés de corroboration : la
           fiche n'est jamais montrée à qui n'a pas encore prouvé qu'il est
           son titulaire : sinon le formulaire d'inscription deviendrait un
           moyen de consulter le fichier client en essayant des numéros. */
        <>
          <h2 className="ws-modal__title">{wsText("ui.welcomeBack")} {connu.prenom} 👋</h2>
          {lienEtat === 'pending' ? (
            <>
              <p className="ws-modal__lede"> {wsText("ui.linkPending")} </p>
              <div className="ws-form">
                <p style={{ margin: 0, fontSize: 13.5, opacity: .8 }}> {wsText("ui.linkUsable")} </p>
                <button type="button" className="ws-cta ws-cta--block" onClick={onClose}>{wsText("ui.continue")}</button>
              </div>
            </>
          ) : (
            <>
              <p className="ws-modal__lede"> {wsText("ui.linkOffer")} </p>
              <div className="ws-form">
                {Array.isArray(connu.concordances) && connu.concordances.length > 0 && (
                  <p style={{ margin: 0, fontSize: 13, opacity: .8 }}> {wsText("ui.matches")} {connu.concordances.join(', ').toLowerCase()}.
                  </p>
                )}
                {/* Dit sans détour ce que ça implique : c'est une donnée
                    personnelle, et c'est un humain qui validera. */}
                <p style={{ margin: 0, fontSize: 12.5, opacity: .7 }}> {wsText("ui.linkReview")} </p>
                {err && <p className="ws-form__err">{wsMessage(err)}</p>}
                <button type="button" className="ws-cta ws-cta--block" disabled={lienEtat === 'envoi'}
                        onClick={demanderLien}>
                  {lienEtat === 'envoi' ? wsText('ui.sending') : wsText("ui.linkConfirm")}
                </button>
                <button type="button" className="ws-linkbtn" onClick={onClose}> {wsText("ui.linkDecline")} </button>
              </div>
            </>
          )}
        </>
      ) : forgot ? (
        <>
          <h2 className="ws-modal__title">{wsText("ui.forgotTitle")}</h2>
          <div className="ws-tabs">
            <button type="button" className={`ws-tab${forgotChannel === 'email' ? ' is-active' : ''}`} onClick={() => { setForgotChannel('email'); setErr(''); }}>{wsText('form.email')}</button>
            <button type="button" className={`ws-tab${forgotChannel === 'sms' ? ' is-active' : ''}`} onClick={() => { setForgotChannel('sms'); setErr(''); }}>SMS</button>
          </div>
          {forgotChannel === 'sms' ? <SmsPasswordReset onBack={fermerOubli}/> : <>
          <p className="ws-modal__lede">{forgotSent
            ? wsText("ui.resetSent")
            : wsText("ui.resetHint")}</p>
          <div className="ws-form">
            {!forgotSent && (
              <label className="ws-field"><span>{wsText("form.email")}</span>
                <input type="email" value={forgotIdent} onChange={(e) => { setForgotIdent(e.target.value); setErr(''); }} autoComplete="email" autoFocus/></label>
            )}
            {err && <p className="ws-form__err">{wsMessage(err)}</p>}
            {!forgotSent && <button type="button" className="ws-cta ws-cta--block" disabled={loading} onClick={demanderLienReset}>{loading ? wsText('ui.sending') : wsText("ui.sendLink")}</button>}
            {forgotSent && <button type="button" className="ws-linkbtn" disabled={loading} onClick={() => setForgotSent(false)}>{wsText("ui.otherEmail")}</button>}
            <button type="button" className="ws-linkbtn" onClick={fermerOubli}>{wsText("ui.backLogin")}</button>
          </div>
          </>}
        </>
      ) : (
      <>
      <h2 className="ws-modal__title">{tRich(t, tab === 'login' ? 'auth.welcomeBack' : 'auth.createTitle')}</h2>
      <p className="ws-modal__lede">{tab === 'login' ? wsText("ui.loginHint") : wsText("ui.registerHint")}</p>
      <div className="ws-tabs">
        <button className={`ws-tab${tab === 'login' ? ' is-active' : ''}`} onClick={() => { setTab('login'); setErr(''); }}>{t('auth.login')}</button>
        <button className={`ws-tab${tab === 'register' ? ' is-active' : ''}`} onClick={() => { setTab('register'); setErr(''); }}>{t('auth.createAccount')}</button>
      </div>
      <form className={`ws-form${tab === 'register' ? ' ws-form--register' : ''}`} onSubmit={submit} noValidate>
        {tab === 'register' && (
          <>
            <div className="ws-form__row2">
              <label className="ws-field"><span>{t('form.firstName')}</span><input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name"/></label>
              <label className="ws-field"><span>{t('form.lastName')}</span><input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name"/></label>
            </div>
            <label className="ws-field"><span>{t('form.email')}</span><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email"/></label>
            <label className="ws-field"><span>{t('auth.password')}</span><input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" minLength={4} aria-describedby="ws-pwd-help"/><small id="ws-pwd-help" className="ws-field__help">{t('auth.min4')}</small></label>
            <label className="ws-field"><span>{t('form.phone')}</span>
              <span className="ws-phone">
                <PhonePrefixSelect value={form.phonePrefix} onChange={(e) => set('phonePrefix', e.target.value)} label={t('form.phonePrefix')}/>
                <input type="tel" value={form.phone} onChange={(e) => { const value = e.target.value; setForm((f) => ({ ...f, ...splitPhoneInput(value, f.phonePrefix) })); setErr(''); }} autoComplete="tel-national" inputMode="tel" placeholder="470 00 00 02"/>
              </span>
            </label>
            <CpField variant="modal" cp={form.postalCode} locality={form.locality}
              onCp={(v) => set('postalCode', v)} onLocality={(v) => set('locality', v)} onOpts={setCpOpts}/>
          </>
        )}
        {tab === 'login' && (
          <>
            {/* Toggle : se connecter avec email OU téléphone */}
            <div className="ws-toggle" role="tablist" aria-label={t('auth.signinWith')}>
              <button type="button" role="tab" aria-selected={form.authMethod === 'email'} className={`ws-toggle__opt${form.authMethod === 'email' ? ' is-active' : ''}`} onClick={() => set('authMethod', 'email')}>{t('form.email')}</button>
              <button type="button" role="tab" aria-selected={form.authMethod === 'phone'} className={`ws-toggle__opt${form.authMethod === 'phone' ? ' is-active' : ''}`} onClick={() => set('authMethod', 'phone')}>{t('form.phone')}</button>
            </div>
            <label className="ws-field"><span>{form.authMethod === 'phone' ? wsText("form.phone") : wsText("form.email")}</span>
              {form.authMethod === 'phone' ? (
                <span className="ws-phone">
                  <PhonePrefixSelect value={form.phonePrefix} onChange={(e) => set('phonePrefix', e.target.value)} label={t('form.phonePrefix')}/>
                  <input type="tel" value={form.identifier} onChange={(e) => set('identifier', e.target.value)} autoComplete="username" inputMode="tel" placeholder="470 00 00 02"/>
                </span>
              ) : (
                <input type="email" value={form.identifier} onChange={(e) => set('identifier', e.target.value)} autoComplete="username"/>
              )}
            </label>
            <label className="ws-field"><span>{t('auth.password')}</span><input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="current-password"/></label>
            <button type="button" className="ws-linkbtn" onClick={() => { setForgot(true); setForgotSent(false); setForgotIdent(form.identifier || ''); setErr(''); }}>{wsText("ui.forgotLink")}</button>
          </>
        )}
        {err && <p className="ws-form__err" role="alert">{wsMessage(err)}</p>}
        {canResendActivation && tab === 'register' && <button type="button" className="ws-linkbtn" onClick={() => { setActivation({ email: form.email, existing: true }); setErr(''); }}>{t('activation.resend')}</button>}
        {tab !== 'login' && <p className="ws-registration-privacy">{wsText("privacy.notice")} <PolicyLinks/></p>}
        <button type="submit" className="ws-cta ws-cta--block" disabled={loading}>{loading ? wsText("common.loading2") : (tab === 'login' ? wsText("ui.login") : wsText("ui.register"))}</button>
      </form>
      </>
      )}
    </ModalShell>
  );
}

// =========================================================================
// MON COMPTE : onglets. Le toggle DÉRIVE ses positions de cette liste (jamais
// en dur). L'onglet actif survit au rafraîchissement.
// =========================================================================
const ACCOUNT_TABS = [
  { key: 'profil',   get label() { return wsText("nav.profile"); } },
  { key: 'achats',   get label() { return wsText('acc.orders.title'); } },
  { key: 'transactions', get label() { return wsText('acc.transactions.title'); } },
  { key: 'vouchers', get label() { return wsText('vouchers.title'); } },
  { key: 'offices', get label() { return wsText('acc.offices.title'); } },
  { key: 'fidelite', get label() { return wsText("ui.loyalty"); } },
];
const ACCOUNT_TAB_LS = 'ws.accountTab';

// =========================================================================
// MON COMPTE : onglet « Mes achats » : UNE liste qui fusionne tickets et
// factures. Une même ligne = ticket, ticket avec facture demandée, ou facture
// (état enrichi du même achat : jamais une seconde entrée). Le webshop n'émet
// AUCUNE facture : il écrit to_invoice + le destinataire, et affiche ce que
// l'ERP du franchisé a poussé (numéro, PDF). Le contrôle de demande n'apparaît
// que si la colonne to_invoice existe en base (capacité serveur).
// =========================================================================
// Status badge colour, from the palette: in progress = beige, ready to collect =
// bordeaux text (the customer has something to do), finished = muted.
const ORDER_STATUS_TONE = { new: 'progress', paid: 'progress', inProduction: 'progress', ready: 'ready', completed: 'done', cancelled: 'off', notCollected: 'off' };
const ORDER_FILTERS = [
  { key: 'all', status: null },
  { key: 'new', status: 'new' },
  { key: 'ready', status: 'ready' },
  { key: 'completed', status: 'completed' },
  { key: 'cancelled', status: 'cancelled' },
];

function AccountPurchases({ refreshRevision = 0, onDetailsChange }) {
  const { t } = wsUseT();
  const [filter, setFilter] = useState('all');
  const [revision, setRevision] = useState(0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingRef, setCancellingRef] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const request = window.WSOrders?.listMine
      ? window.WSOrders.listMine()
      : Promise.reject(new Error(wsText("error.orderUnavailable")));
    request
      .then((payload) => { if (alive) setOrders(payload); })
      .catch(() => { if (alive) setError(t('acc.orders.error')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [t, revision, refreshRevision]);

  const statusKey = orderStatusName;
  const statusText = (status) => t('acc.orders.status.' + statusKey(status));
  const paymentText = payment => t('acc.orders.payment.' + paymentStatusName(payment?.status));
  const formatDate = (value) => {
    const date = new Date(String(value || '').replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString(wsLocale(), { dateStyle: 'medium', timeStyle: 'short' });
  };
  const formatTotal = (value) => Number(value || 0).toLocaleString(wsLocale(), { style: 'currency', currency: 'EUR' });
  const activeFilter = ORDER_FILTERS.find((item) => item.key === filter) || ORDER_FILTERS[0];
  const visibleOrders = activeFilter.status ? orders.filter((order) => statusKey(order.status) === activeFilter.status || (activeFilter.status === 'new' && statusKey(order.status) === 'inProduction')) : orders;
  const cancelOrder = async (order) => {
    if (!window.confirm(t('acc.orders.cancelConfirm'))) return;
    setCancellingRef(order.orderRef); setError('');
    try {
      const result = await window.WSOrders.cancel(order.orderRef);
      if (!result.ok) throw new Error(wsMessage(result.description || result.error || t('acc.orders.cancelError')));
      setOrders((current) => current.map((item) => item.orderRef === order.orderRef ? { ...item, status: 'cancelled' } : item));
    } catch (exception) {
      setError(exception?.message || t('acc.orders.cancelError'));
    } finally {
      setCancellingRef('');
    }
  };

  if (selectedOrder) return <PurchaseDetails order={selectedOrder} onBack={() => { setSelectedOrder(null); onDetailsChange?.(false); setRevision(value => value + 1); }} />;
  return (
    <div className="ws-acc__section">
      <div className="ws-acc__section-h">{t('acc.orders.title')}</div>
      <div className="ws-toggle ws-purchase-filters" role="tablist" aria-label={t('acc.filterPurchases')}>
        {ORDER_FILTERS.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={filter === item.key}
            className={'ws-toggle__opt' + (filter === item.key ? ' is-active' : '')}
            onClick={() => setFilter(item.key)}>
            {item.status ? t('acc.orders.status.' + item.status) : t('acc.orders.all')}
          </button>
        ))}
      </div>
      {loading && <p className="ws-acc__hint">{t('common.loading2')}</p>}
      {error && <p className="ws-acc__vat-msg ws-acc__vat-msg--err" role="alert">{wsMessage(error)}</p>}
      {!loading && !error && visibleOrders.length === 0 && (
        <div className="ws-acc__card ws-acc__card--empty"><p className="ws-acc__note">{t('acc.orders.empty')}</p></div>
      )}
      {visibleOrders.map((order) => {
        const needsPayment = order.payment?.method === 'stripe' && ['pending', 'failed'].includes(paymentStatusName(order.payment?.status)) && !['cancelled', 'completed'].includes(statusKey(order.status));
        // Folded card: the order line is the summary; details drop down under it. An order waiting for payment opens by default.
        return (
        <details key={order.orderRef} open={needsPayment || undefined} className={'ws-acc__card ws-purchase-fold' + (statusKey(order.status) === 'cancelled' ? ' ws-purchase--cancelled' : paymentStatusName(order.payment?.status) === 'paid' ? ' ws-purchase--paid' : '')}>
          <summary className="ws-acc__card-head">
            <span className="ws-acc__k">{order.orderRef} · {t('acc.orders.source.' + (order.source === 'store' ? 'store' : 'webshop'))}</span>
            <span className={`ws-acc__badge ws-acc__badge--${ORDER_STATUS_TONE[statusKey(order.status)] || 'off'}`}>{statusText(order.status)}</span>
            <svg className="ws-purchase-fold__chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div className="ws-purchase-fold__body">
          <div className="ws-acc__card-row">
            <span className="ws-acc__k">{order.mode === 'delivery' ? t('acc.orders.delivery') : t('acc.orders.pickup')}</span>
            <span className="ws-acc__v">{formatDate(order.slot?.dateTime)}</span>
          </div>
          <div className="ws-acc__card-row">
            <span className="ws-acc__k">{(order.itemsCount || 0) === 1 ? t('acc.orders.itemsOne') : t('acc.orders.items', { count: order.itemsCount || 0 })}</span>
            <span className="ws-acc__v">{formatTotal(order.total)}</span>
          </div>
          <div className="ws-acc__card-row">
            <span className="ws-acc__k">{t('acc.orders.payment')}</span>
            <span className={statusKey(order.status) === 'cancelled' ? 'ws-acc__v' : 'ws-purchase-payment ws-purchase-payment--' + paymentStatusName(order.payment?.status)}>{statusKey(order.status) === 'cancelled' ? '-' : paymentText(order.payment)}</span>
          </div>
          {needsPayment && (
            <div className="ws-purchase-payment-notice">
              <p>{t('stripe.orderBlocked')}</p>
              <StripeRetryButton orderRef={order.orderRef} verifyFirst onUpdated={() => setRevision(value => value + 1)}/>
            </div>
          )}
          <div className="ws-purchase-actions">
          <button type="button" className="ws-linkbtn" onClick={() => { setSelectedOrder(order); onDetailsChange?.(true); }}>{t('acc.orders.details')}</button>
          {order.source !== 'store' && statusKey(order.status) === 'new' && String(order.payment?.status || '').toLowerCase() === 'pending' && (
            <button type="button" className="ws-acc__inv-cancel" disabled={cancellingRef === order.orderRef}
              onClick={() => cancelOrder(order)}>
              {cancellingRef === order.orderRef ? t('common.loading2') : t('acc.orders.cancel')}
            </button>
          )}
          </div>
          </div>
        </details>
        );
      })}

    </div>
  );
}

// ── Rattrapage du code postal (comptes existants) ───────────────────────
// À CHAQUE connexion d'un client dont le code postal manque en base
// (user.needsPostcode), cette modal de saisie rapide s'affiche : un seul champ
// CP, localité affichée immédiatement pour confirmation, bouton Valider qui
// enregistre (PATCH /auth/me) et ferme. Jamais affichée si le CP est déjà
// connu ; ne réapparaît plus une fois enregistré. « Plus tard » referme pour
// cette session : elle reviendra à la prochaine connexion.
function PostcodeCatchupModal({ user, onUpdateUser }) {
  const { t } = wsUseT();
  const [cp, setCp] = useState('');
  const [locality, setLocality] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [snoozed, setSnoozed] = useState(false);
  const uid = user ? user.id : null;
  useEffect(() => { setSnoozed(false); setCp(''); setLocality(''); setErr(''); }, [uid]); // nouvelle connexion → réaffichage
  const needs = !!user && (user.needsPostcode === true || !user.postalCode);
  if (!needs || snoozed) return null;
  async function submit(e) {
    if (e) e.preventDefault();
    if (busy) return;
    setErr('');
    if (!CP_RE.test(String(cp).trim())) { setErr(wsText("error.postal")); return; }
    if (!window.WSAuth || typeof window.WSAuth.updateMe !== 'function') { setSnoozed(true); return; }
    setBusy(true);
    try {
      // Resolve from the submitted code as well: a quick submit must not use stale options.
      const postalCode = String(cp).trim();
      const options = await cpLocalities(postalCode);
      const resolvedLocality = options.length === 1 ? options[0] : locality.trim();
      if (options.length > 1 && !options.includes(resolvedLocality)) {
        setErr(wsText("error.locality")); return;
      }
      const patch = { postalCode };
      if (resolvedLocality) patch.locality = resolvedLocality;
      const r = await window.WSAuth.updateMe(patch);
      if (r && r.ok && r.user) { onUpdateUser(r.user); }              // needsPostcode:false → la modal disparaît
      else setErr((r && r.error) || wsText("error.save"));
    } catch (_) {
      setErr(wsText("error.network"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ModalShell onClose={() => setSnoozed(true)} narrow>
      <p className="ws-modal__eyebrow">{t('acc.yourProfile')}</p>
      <h2 className="ws-modal__title">{tRich(t, 'cp.title')}</h2>
      <p className="ws-modal__lede">{t('cp.lede')}</p>
      <form className="ws-form" onSubmit={submit} noValidate>
        <CpField variant="modal" cp={cp} locality={locality}
          onCp={(v) => { setCp(v); setErr(''); }} onLocality={setLocality} disabled={busy}/>
        {err && <p className="ws-form__err">{wsMessage(err)}</p>}
        <button type="submit" className="ws-cta ws-cta--block" disabled={busy}>{busy ? wsText('ui.saving') : wsText("ui.validate")}</button>
        <button type="button" className="ws-linkbtn" onClick={() => setSnoozed(true)}>{t('common.later')}</button>
      </form>
    </ModalShell>
  );
}

// Pulse apricot du « i » « pas encore de bureau ? » (à côté de « Livraison au bureau »).
if (typeof document !== 'undefined' && !document.getElementById('ws-bureau-style')) {
  const _st = document.createElement('style');
  _st.id = 'ws-bureau-style';
  _st.textContent = '@keyframes wsBureauPulse{0%{box-shadow:0 0 0 0 rgba(193,122,42,.55)}70%{box-shadow:0 0 0 7px rgba(193,122,42,0)}100%{box-shadow:0 0 0 0 rgba(193,122,42,0)}}';
  document.head.appendChild(_st);
}

const allowBillingCompanyLinking = true;
const allowOfficeLinking = true;

// A stored phone number shown with spaces (« +32 470 12 34 56 »); the saved value
// is never changed. Unknown formats are shown as they are.
function wsPhoneDisplay(value) {
  const raw = String(value || '');
  const v = raw.replace(/[\s.\-()/]/g, '');
  let m;
  if ((m = v.match(/^\+32(4\d{2})(\d{2})(\d{2})(\d{2})$/))) return `+32 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  if ((m = v.match(/^\+32([2-9])(\d{3})(\d{2})(\d{2})$/))) return `+32 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  if ((m = v.match(/^\+31(6)(\d{2})(\d{2})(\d{2})(\d{2})$/))) return `+31 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
  if ((m = v.match(/^\+33([1-9])(\d{2})(\d{2})(\d{2})(\d{2})$/))) return `+33 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
  if ((m = v.match(/^\+48(\d{3})(\d{3})(\d{3})$/))) return `+48 ${m[1]} ${m[2]} ${m[3]}`;
  return raw;
}

// Collapsible block of the Profil tab: the whole tab fits in the window, sections open on demand.
function AccFold({ title, children, className = '' }) {
  return <details className={`ws-acc__fold${className ? ' ' + className : ''}`}>
    <summary><span>{title}</span>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div className="ws-acc__fold-body">{children}</div>
  </details>;
}

function AccountModal({ open, requestedTab, requestedReceipt, onReceiptHandled, user, onClose, onLogout, onRequestOffice, onUpdateUser, shops, currentShopId, onChangePreferredShop, office, tour, onManageOffices, onUseVoucher, activeVoucherCode, onClearVoucher, onVouchersViewed, onBrowseVoucher }) {
  const { t } = wsUseT();
  const [phoneFocus, setPhoneFocus] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    company: user?.company || '',
    email: user?.email || '',
    phone: user?.phone || '',
    postalCode: user?.postalCode || '',
    locality: user?.locality || '',
    isBusiness: !!user?.isBusiness,
    preferredShopId: user?.preferredShopId || null,
    invoice: {
      country: user?.invoice?.country || 'BE',
      vat: user?.invoice?.vat || '',
      name: user?.invoice?.name || '',
      address: user?.invoice?.address || '',
      postalCode: user?.invoice?.postalCode || '',
      city: user?.invoice?.city || '',
    },
  });
  const [activationSending, setActivationSending] = useState(false);
  const [activationResult, setActivationResult] = useState(null);
  useEffect(() => { setActivationResult(null); }, [open, user?.id]);
  async function resendAccountActivation() {
    if (activationSending) return;
    setActivationSending(true); setActivationResult(null);
    try {
      const result = await window.WSAuth.resendActivation(user.email);
      setActivationResult(result.ok ? { ok: true } : { error: result.error || 'CLIENT_ACTIVATION_MAIL_FAILED' });
    } catch {
      setActivationResult({ error: 'CLIENT_ACTIVATION_MAIL_FAILED' });
    } finally { setActivationSending(false); }
  }
  const [savedFlash, setSavedFlash] = useState(false);
  const [profileErr, setProfileErr] = React.useState('');
  // Statut VIES : si la société est déjà liée en base (verified_at côté client),
  // on affiche le badge « vérifié » d'office : comme la carte VIES de la PWA.
  const [vies, setVies] = useState(() => (user?.invoice?.viesVerified
    ? { status: 'ok', message: wsText("ui.vatVerified") }
    : { status: 'idle', message: '' })); // idle | loading | ok | invalid | unavailable
  // Comptes entreprise (livraison bureau) rattachés à l'e-mail du client
  // (ws_office_emails → ws_offices), affichés en lecture seule, comme la PWA.
  const [linkedCompanies, setLinkedCompanies] = useState([]);
  // Office unplug/reconnect flow: 'idle' | 'confirm' | 'ask' | 'pick' | 'add'
  const [officeStep, setOfficeStep] = useState('idle');
  const [approvedOffices, setApprovedOffices] = useState([]);
  const [approvedOfficeTours, setApprovedOfficeTours] = useState({});
  const [pickedOfficeId, setPickedOfficeId] = useState('');
  // Recherche du bureau à lier. Une liste déroulante oblige à parcourir
  // l'inventaire pour retrouver un nom qu'on connaît déjà ; on tape ce qu'on
  // cherche. La saisie NE CRÉE RIEN : seule une société déjà validée par
  // l'Atelier peut être liée. Absente de la liste → demande d'ajout ci-dessous.
  const [officeQuery, setOfficeQuery] = useState('');
  const [newOffice, setNewOffice] = useState({
    name: '', vat: '', address: '', postalCode: '', city: '',
    contact: '', email: '', phone: '', preferredShopId: '',
  });
  const [officeErr, setOfficeErr] = useState('');
  const [officeBusy, setOfficeBusy] = useState(false);
  // Bureau « site de livraison » (parité PWA) : sélecteur lié au shop.
  const [siteStep, setSiteStep] = useState('idle');   // 'idle' | 'pick'
  const [siteList, setSiteList] = useState([]);
  const [sitePicked, setSitePicked] = useState('');
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteErr, setSiteErr] = useState('');
  const [purchaseRevision, setPurchaseRevision] = useState(0);
  const [purchaseDetailsOpen, setPurchaseDetailsOpen] = useState(false);
  const [tab, setTab] = useState(() => {
    try { return window.WSSessionStorage.getItem(ACCOUNT_TAB_LS) || 'profil'; } catch (_) { return 'profil'; }
  });
  useEffect(() => { if (open && requestedTab) setTab(requestedTab); }, [open, requestedTab]);
  // Sociétés de facturation : flux d'ajout (VIES ou sans TVA), jamais
  // d'édition en place d'une société existante.
  const [companyStep, setCompanyStep] = useState('idle'); // 'idle' | 'vies' | 'novat'
  const [addVat, setAddVat] = useState({ country: 'BE', vat: '' });
  const [addNo, setAddNo]   = useState({ name: '', address: '', postalCode: '', city: '' });
  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyErr, setCompanyErr]   = useState('');
  const [companyUnlinked, setCompanyUnlinked] = useState(false);
  useEffect(() => { setCompanyUnlinked(false); setCompanyErr(''); }, [open, user?.id]);
  // Sécurité : changement de mot de passe.
  const [pw0, setPw0] = useState('');   // mot de passe actuel, exigé par l'ERP
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg]   = useState(null);

  const visibleTabs = user?.isBusiness ? ACCOUNT_TABS.filter(item => item.key !== 'fidelite') : ACCOUNT_TABS;
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : 'profil';
  function selectTab(k) {
    setTab(k); setPurchaseDetailsOpen(false);
    try { window.WSSessionStorage.setItem(ACCOUNT_TAB_LS, k); } catch (_) {}
  }

  async function addByVies() {
    setCompanyUnlinked(false);
    setCompanyBusy(true); setCompanyErr('');
    const r = await window.WSAuth.billingVerify({ vat: addVat.vat, country: addVat.country });
    setCompanyBusy(false);
    if (r.ok && r.user) {
      if (typeof onUpdateUser === 'function') onUpdateUser({ ...user, ...r.user });
      setCompanyStep('idle'); setAddVat({ country: 'BE', vat: '' });
    } else {
      setCompanyErr((r.error && (r.error.message || r.error)) || wsText("error.verifyUnavailable"));
    }
  }
  async function addNoVat() {
    setCompanyUnlinked(false);
    setCompanyBusy(true); setCompanyErr('');
    const r = await window.WSAuth.addCompanyNoVat(addNo);
    setCompanyBusy(false);
    if (r.ok && r.user) {
      if (typeof onUpdateUser === 'function') onUpdateUser({ ...user, ...r.user });
      setCompanyStep('idle'); setAddNo({ name: '', address: '', postalCode: '', city: '' });
    } else {
      setCompanyErr(r.error || wsText("error.add"));
    }
  }
  async function removeCompany() {
    if (companyBusy) return;
    setCompanyBusy(true); setCompanyErr(''); setCompanyUnlinked(false);
    try {
      const r = await window.WSAuth.unlinkCompany();
      if (r.ok && r.user) {
        onUpdateUser?.({ ...user, ...r.user });
        setCompanyStep('idle'); setCompanyUnlinked(true);
        setAddVat({ country: 'BE', vat: '' });
        setAddNo({ name: '', address: '', postalCode: '', city: '' });
      } else setCompanyErr(r.error || wsText('error.billingUnlink'));
    } catch (_) { setCompanyErr(wsText('error.billingUnlink')); }
    finally { setCompanyBusy(false); }
  }
  const canSavePassword = !pwBusy && !!pw0 && pw1.length >= 4 && pw1 === pw2;
  async function savePassword(event) {
    event.preventDefault();
    if (!canSavePassword) return;
    setPwBusy(true); setPwMsg(null);
    const r = await window.WSAuth.changePassword({ currentPassword: pw0, password: pw1 });
    setPwBusy(false);
    if (r.ok) { setPwMsg({ ok: true, text: wsText("ui.passwordUpdated") }); setPw0(''); setPw1(''); setPw2(''); }
    else setPwMsg({ ok: false, text: r.error || wsText("error.generic") });
  }

  // re-sync the form whenever a different user is loaded into the modal
  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      company: user.company || '',
      email: user.email || '',
      phone: user.phone || '',
      postalCode: user.postalCode || '',
      isBusiness: !!user.isBusiness,
      preferredShopId: user.preferredShopId || null,
      invoice: {
        country: user.invoice?.country || 'BE',
        vat: user.invoice?.vat || '',
        name: user.invoice?.name || '',
        address: user.invoice?.address || '',
        postalCode: user.invoice?.postalCode || '',
        city: user.invoice?.city || '',
      },
    });
    setVies(user.invoice?.viesVerified
      ? { status: 'ok', message: wsText("ui.vatVerified") }
      : { status: 'idle', message: '' });
  }, [user]);

  // Comptes entreprise liés à l'e-mail (lecture seule).
  useEffect(() => {
    let alive = true;
    if (!open || !user?.email || !window.WSCompanies) { setLinkedCompanies([]); return; }
    Promise.resolve(window.WSCompanies.list(user.email))
      .then((cs) => { if (alive) setLinkedCompanies(Array.isArray(cs) ? cs : []); })
      .catch(() => { if (alive) setLinkedCompanies([]); });
    return () => { alive = false; };
  }, [open, user?.email]);

  if (!open || !user) return null;
  const status = !office ? 'unlinked' : (office.status === 'validated' && tour) ? 'active' : 'pending';

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function setInvoiceField(k, v) {
    setForm((f) => ({ ...f, invoice: { ...f.invoice, [k]: v } }));
    if (k === 'vat' || k === 'country') setVies({ status: 'idle', message: '' });
  }

  // Persist a partial update through onUpdateUser + WSI18n customer store.
  // Used for the in-row controls (fidelity toggle, preferred shop) that
  // shouldn't wait for the global "Enregistrer" button.
  // Persistance serveur ATTENDUE : renvoie {ok, error}. L'ancien
  // fire-and-forget appliquait l'état localement même si le serveur refusait
  // (409) : le client croyait son bureau/sa boutique rattachés. On applique
  // d'abord l'optimiste (réactivité), mais on rend le verdict serveur pour que
  // l'appelant affiche l'erreur et, au besoin, revienne en arrière.
  async function persistPartial(patch) {
    const updated = { ...user, ...patch };
    setForm((f) => ({ ...f, ...patch }));
    if (typeof onUpdateUser === 'function') onUpdateUser(updated);
    if (window.WSI18n && window.WSI18n.setCustomer) {
      const existing = window.WSI18n.getCustomer() || {};
      window.WSI18n.setCustomer({ ...existing, ...updated });
    }
    if (window.WSAuth && typeof window.WSAuth.updateMe === 'function' && window.WSAuth.endpoint) {
      try {
        const r = await window.WSAuth.updateMe(patch);
        if (r && r.ok && r.user && typeof onUpdateUser === 'function') onUpdateUser({ ...user, ...r.user });
        return r || { ok: false, error: wsText("error.emptyResponse") };
      } catch (e) { return { ok: false, error: wsText("error.unsaved") }; }
    }
    return { ok: false, error: wsText("error.accountUnavailable") };
  }

  // ── Office: unplug / reconnect / add new ───────────────────────────
  // Boutique de référence des bureaux : la préférée du profil, sinon celle que
  // le client consulte. Sans ce repli, un client dont preferred_shop_id est vide
  // (compte créé côté PWA, par exemple) restait bloqué sur « choisissez d'abord
  // votre boutique préférée » et ne pouvait pas se rattacher.
  const officeShopId = form.preferredShopId || currentShopId;
  async function loadApprovedOffices() {
    if (!window.WSOffices) { setOfficeErr(wsText("error.offices")); return; }
    const shopId = officeShopId; // boutique préférée, sinon celle consultée
    setOfficeBusy(true);
    try {
      const list = await window.WSOffices.listApproved(shopId);
      const filtered = (list || []).filter((o) => o && o.id !== user.officeId);
      setApprovedOffices(filtered);
      if (window.WSTours && filtered.length) {
        const tourIds = [...new Set(filtered.map((o) => o.tourId).filter(Boolean))];
        const tourEntries = await Promise.all(
          tourIds.map((id) => window.WSTours.get(id).then((t) => [id, t]).catch(() => [id, null]))
        );
        setApprovedOfficeTours(Object.fromEntries(tourEntries));
      }
    } catch (e) {
      // L'échec est VISIBLE : sans lui, la liste restait vide sans explication
      // et l'utilisateur croyait qu'aucun bureau n'existait.
      setApprovedOffices([]);
      setOfficeErr(e && e.message ? e.message : wsText("error.offices"));
    } finally { setOfficeBusy(false); }
  }
  // ── Bureau « site de livraison » (parité PWA) : lier / changer / délier ──
  // Liste = ws_office_delivery_sites du shop (même source que la PWA) ; la
  // liaison est persistée côté serveur dans pwa_client_office (partagé PWA⇄WS).
  /* Ouvre l'écran, sans rien précharger : la liste des bureaux ne se feuillette
     pas, elle se cherche. Charger l'inventaire à l'ouverture, c'était l'exposer
     à quiconque ouvre son profil. */
  function openSitePicker() {
    setSiteErr(''); setSitePicked(''); setSiteList([]); setSiteBusy(false); setSiteStep('pick');
  }
  async function saveSite() {
    if (!sitePicked) { setSiteErr(wsText("error.pickOffice")); return; }
    setSiteBusy(true); setSiteErr('');
    const r = await window.WSAuth.setOfficeSite(sitePicked);
    setSiteBusy(false);
    if (r.ok && r.user) {
      if (typeof onUpdateUser === 'function') onUpdateUser({ ...user, ...r.user });
      setSiteStep('idle');
    } else {
      setSiteErr(r.error || wsText("error.link"));
    }
  }
  /* Déliement : opération UNIQUE. Les deux boutons « Délier ce bureau » de cet
     écran appelaient deux choses différentes : celui-ci supprimait la liaison
     PWA, l'autre vidait client.office_id. Or le serveur résout le bureau par
     une chaîne de replis : effacer une source laissait l'autre en fournir un
     AUTRE aussitôt, et le client croyait à une résurrection. POST /auth/office
     avec un site vide coupe désormais les deux d'un coup.
     L'échec était muet : pas de branche else : on cliquait, l'écran avançait,
     et le bureau restait rattaché en base sans un mot. */
  async function doUnlink() {
    setSiteBusy(true); setOfficeErr('');
    const r = await window.WSAuth.setOfficeSite(null);
    setSiteBusy(false);
    if (!r || !r.ok) {
      setOfficeErr((r && r.error) || wsText("error.unlink"));
      return false;
    }
    if (r.user && typeof onUpdateUser === 'function') onUpdateUser({ ...user, ...r.user });
    return true;
  }
  async function unlinkSite() { await doUnlink(); }

  function startUnplug() { setOfficeStep('confirm'); setOfficeErr(''); }
  async function confirmUnplug() {
    if (await doUnlink()) setOfficeStep('ask');
  }
  function chooseLinkAnother() {
    setPickedOfficeId(''); setOfficeErr('');
    setOfficeStep('pick');
    if (officeShopId) loadApprovedOffices();
  }
  function chooseDone() {
    setOfficeStep('idle');
  }
  async function confirmPick() {
    if (!pickedOfficeId) { setOfficeErr(wsText("error.pickOffice")); return; }
    const r = await persistPartial({ officeId: pickedOfficeId });
    if (r && r.ok === false) { setOfficeErr(r.error || wsText("error.linkRejected")); return; }
    setOfficeErr(''); setOfficeStep('idle');
  }
  function setNewOfficeField(k, v) { setNewOffice((f) => ({ ...f, [k]: v })); setOfficeErr(''); }
  // "My office isn't listed" → ask the franchise to contact it (no office is
  // created/linked; the franchise handles it). Only name + one contact needed.
  async function submitContactRequest() {
    const nameOk = String(newOffice.name || '').trim();
    const contactOk = ['phone', 'email', 'address'].some((k) => String(newOffice[k] || '').trim());
    if (!nameOk) { setOfficeErr(wsText("error.officeName")); return; }
    if (!contactOk) { setOfficeErr(wsText("error.contact")); return; }
    if (!window.WSOffices) { setOfficeErr(wsText("error.service")); return; }
    setOfficeBusy(true); setOfficeErr('');
    try {
      // La demande va à la boutique où le client se trouve : sa boutique
      // préférée si elle est renseignée, sinon celle qu'il consulte. Sans ce
      // repli, un client sans boutique préférée voyait sa demande atterrir dans
      // le back-office d'une AUTRE boutique (celle de sa fiche ERP).
      const r = await window.WSOffices.contactFranchise({
        officeName: newOffice.name, phone: newOffice.phone, email: newOffice.email, address: newOffice.address,
        shopId: officeShopId, requestedBy: user.email,
      });
      if (r && r.ok === false) { setOfficeErr(r.error || wsText("error.send")); return; }
      setNewOffice({ name: '', vat: '', address: '', postalCode: '', city: '', contact: '', email: '', phone: '', preferredShopId: '' });
      setOfficeStep('sent');
    } catch (e) {
      setOfficeErr(wsText("error.send"));
    } finally {
      setOfficeBusy(false);
    }
  }

  // Preferred-shop change. Saves to profile AND notifies the shell so the
  // active shop can switch (with the cart-preserving rules in ShopFrame).
  function changePreferredShop(nextId) {
    persistPartial({ preferredShopId: nextId || null });
    if (nextId && typeof onChangePreferredShop === 'function') {
      onChangePreferredShop(nextId, { fromProfile: true });
    }
  }
  async function checkVat() {
    setVies({ status: 'loading', message: '' });
    // Comme la PWA : la vérification VIES est faite ET persistée côté serveur
    // (raison sociale + adresse + verified_at sur la fiche client partagée).
    // Repli sur la simple vérification WSVies (remplissage local) hors ligne.
    if (window.WSAuth && typeof window.WSAuth.billingVerify === 'function' && window.WSAuth.endpoint) {
      const rv = await window.WSAuth.billingVerify({ vat: form.invoice.vat, country: form.invoice.country });
      if (rv.ok && rv.user) {
        if (typeof onUpdateUser === 'function') onUpdateUser({ ...user, ...rv.user }); // resync du formulaire via l'effet [user]
        setVies({ status: 'ok', message: wsText("ui.vatValid") });
        return;
      }
      if (rv.error) { setVies({ status: rv.error.code || 'invalid', message: rv.error.message || wsText("error.vat") }); return; }
    }
    if (!window.WSVies) { setVies({ status: 'unavailable', message: wsText("error.vies") }); return; }
    const r = await window.WSVies.check({ vat: form.invoice.vat, country: form.invoice.country });
    if (r.valid && r.data) {
      setForm((f) => ({
        ...f,
        invoice: {
          ...f.invoice,
          vat: r.data.vat,
          country: r.data.country || f.invoice.country,
          name: r.data.name || f.invoice.name,
          address: r.data.address || f.invoice.address,
          postalCode: r.data.postalCode || f.invoice.postalCode,
          city: r.data.city || f.invoice.city,
        },
      }));
      setVies({ status: 'ok', message: wsText("ui.vatValid") });
    } else {
      setVies({ status: r.error?.code || 'invalid', message: r.error?.message || wsText("error.vat") });
    }
  }
  async function saveProfile(e) {
    e.preventDefault();
    const updated = { ...user, ...form };
    if (typeof onUpdateUser === 'function') onUpdateUser(updated);
    if (window.WSI18n && window.WSI18n.setCustomer) {
      const existing = window.WSI18n.getCustomer() || {};
      window.WSI18n.setCustomer({ ...existing, ...updated });
    }
    // Persist to the backend (customer profile) when the API is wired.
    // « Enregistré » ne s'affiche QUE si le serveur a accepté, l'ancien code
    // le montrait toujours, même sur un rejet (400/500 avalé) : perte
    // silencieuse. On applique aussi l'état renvoyé par le serveur, pas
    // l'optimiste local.
    if (window.WSAuth && typeof window.WSAuth.updateMe === 'function' && window.WSAuth.endpoint) {
      try {
        const r = await window.WSAuth.updateMe({
          firstName: form.firstName, lastName: form.lastName,
          phone: form.phone, postalCode: form.postalCode, locality: form.locality,
        });
        if (r && r.ok) {
          if (r.user && typeof onUpdateUser === 'function') onUpdateUser({ ...user, ...r.user });
          setProfileErr(''); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
        } else {
          setProfileErr((r && r.error) || wsText("error.saveRejected"));
        }
      } catch (e) {
        setProfileErr(wsText("error.unsaved"));
      }
    } else {
      setProfileErr(wsText("error.accountUnavailable"));
    }
  }
  return (
    <ModalShell onClose={onClose} split>
      <div className="ws-acc2">
      <aside className="ws-acc2__side">
        <div className="ws-acc2__hello">
          <p className="ws-modal__eyebrow">{t('auth.myAccount')}</p>
          <h2 className="ws-modal__title">{tRich(t, 'acc.hello', { name: form.firstName || user.firstName })}</h2>
          <p className="ws-modal__lede">{user.email}</p>
        </div>
        {/* Onglets : positions dérivées d'ACCOUNT_TABS, actif persisté. */}
        <div className="ws-acc2__nav ws-account-tabs" role="tablist" aria-orientation="vertical" aria-label={t('acc.sectionsAria')}>
          {visibleTabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key}
              className={'ws-acc2__tab' + (activeTab === t.key ? ' is-active' : '')}
              onClick={() => selectTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="ws-acc2__sidefoot">
          <button type="button" className="ws-linkbtn ws-account-cookie-settings" onClick={() => {
            onClose();
            window.setTimeout(() => window.WSConsent?.open(), 0);
          }}>{t('cookies.settings')}</button>
          <button type="button" className="ws-acc__logout" onClick={() => { onLogout(); onClose(); }}>{t('acc.signout')}</button>
        </div>
      </aside>
      <section className="ws-acc2__main">
      <h3 className="ws-acc2__title">{visibleTabs.find(item => item.key === activeTab)?.label}</h3>
      {user.activationRequired === true && <section className="ws-acc__section">
        <p>{t('activation.accountWarning')}</p>
        <button type="button" className="ws-cta" disabled={activationSending} onClick={resendAccountActivation}>
          {t(activationSending ? 'ui.sending' : 'activation.resend')}
        </button>
        {activationResult && <p role={activationResult.ok ? 'status' : 'alert'}>
          {activationResult.ok ? t('activation.resent') : wsMessage(activationResult.error)}
        </p>}
      </section>}


      {activeTab === 'achats' && <AccountPurchases refreshRevision={purchaseRevision} onDetailsChange={setPurchaseDetailsOpen} />}
      {activeTab === 'transactions' && <AccountTransactions key={user.id} t={t} locale={wsLocale()}
        receiptToken={requestedReceipt} onReceiptHandled={onReceiptHandled} />}
      {activeTab === 'vouchers' && <AccountVouchers key={`${user.id}:${currentShopId}`} shopId={currentShopId} onUse={onUseVoucher} activeCode={activeVoucherCode} onClear={onClearVoucher} onViewed={onVouchersViewed} onBrowse={onBrowseVoucher}/>}
      {activeTab === 'fidelite' && <PersonalLoyalty key={user.id} />}
      {activeTab === 'offices' && <ProfileOffices currentShopName={shops?.find(item => String(item.id) === String(currentShopId))?.name} onManage={onManageOffices}/>}


      {activeTab === 'profil' && <>
      <form className="ws-acc__section" onSubmit={saveProfile}>
        <div className="ws-acc__section-h">{t('acc.contact')}</div>
        <div className="ws-acc__form">
          <label className="ws-acc__field">
            <span className="ws-acc__field-label">{t('form.firstName')}</span>
            <input type="text" className="ws-acc__input" value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)} placeholder={t('form.firstName')} />
          </label>
          <label className="ws-acc__field">
            <span className="ws-acc__field-label">{t('form.lastName')}</span>
            <input type="text" className="ws-acc__input" value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)} placeholder={t('form.lastName')} />
          </label>
          <label className="ws-acc__field ws-acc__field--full">
            <span className="ws-acc__field-label">{t('form.emailLong')}</span>
            {/* LECTURE SEULE, honnêtement : le champ était éditable mais la
                sauvegarde ne l'envoyait jamais : « ✓ Enregistré » mentait, et
                l'email sert d'identifiant (connexion, rattachement bureau). */}
            <input type="email" className="ws-acc__input" value={form.email} readOnly disabled
              title={t('acc.emailIsLogin')} />
            <span className="ws-acc__field-help">{t('acc.emailIsLoginShort')}</span>
          </label>
          <label className="ws-acc__field">
            <span className="ws-acc__field-label">{t('form.phone')}</span>
            <input type="tel" className="ws-acc__input" value={phoneFocus ? form.phone : wsPhoneDisplay(form.phone)}
              onFocus={() => setPhoneFocus(true)} onBlur={() => setPhoneFocus(false)}
              onChange={(e) => setField('phone', e.target.value)} placeholder="+32 ..." />
          </label>
          <CpField variant="acc" cp={form.postalCode} locality={form.locality}
            onCp={(v) => setField('postalCode', v)} onLocality={(v) => setField('locality', v)}/>
        </div>

        <div className="ws-acc__form-foot">
          <button type="submit" className="ws-cta">{t('common.save2')}</button>
          {savedFlash && <span className="ws-acc__saved">✓ {t('common.saved')}</span>}
          {profileErr && <span className="ws-acc__saved" style={{ color: 'var(--color-primary, #8d1d2c)' }}>{wsMessage(profileErr)}</span>}
        </div>
      </form>

      <AccFold title={t('acc.companies')}>
      <BillingCompanies key={user.id} allowAdd={allowBillingCompanyLinking}/>
      </AccFold>

      {/* ── Sécurité ── */}
      <AccFold title={t('acc.security')}>
      <form className="ws-acc__section" onSubmit={savePassword}>
        <div className="ws-acc__section-h">{t('acc.security')}</div>
        <div className="ws-acc__form">
          <label className="ws-acc__field">
            <span className="ws-acc__field-label">{wsText("ui.currentPassword")}</span>
            <input type="password" name="current-password" className="ws-acc__input" value={pw0}
              onChange={(e) => setPw0(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="ws-acc__field">
            <span className="ws-acc__field-label">{t('acc.newPassword')}</span>
            <input type="password" name="new-password" className="ws-acc__input" value={pw1}
              onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="ws-acc__field">
            <span className="ws-acc__field-label">{t('acc.confirmPassword')}</span>
            <input type="password" name="confirm-password" className="ws-acc__input" value={pw2}
              onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        {pwMsg && (
          <p className={'ws-acc__vat-msg ' + (pwMsg.ok ? 'ws-acc__vat-msg--ok' : 'ws-acc__vat-msg--err')}>
            {pwMsg.ok ? '✓ ' : '⚠ '}{wsMessage(pwMsg.text)}
          </p>
        )}
        <div className="ws-acc__form-foot">
          <button type="submit" className="ws-cta" disabled={!canSavePassword}> {wsText("ui.changePassword")} </button>
        </div>
      </form>
      </AccFold>

      <AccFold title={t('acc.prefs')}>
      <div className="ws-acc__section">
        <div className="ws-acc__section-h">{t('acc.prefs')}</div>

        {/* Preferred shop ----------------------------------------------- */}
        <div className="ws-acc__row">
          <div className="ws-acc__row-body">
            <div className="ws-acc__row-title">{t('acc.prefShop')}</div>
            <div className="ws-acc__row-sub"> {wsText("ui.preferredShopHint")} </div>
            <div className="ws-acc__select-row">
              <select
                className="ws-acc__input"
                value={form.preferredShopId || ''}
                onChange={(e) => changePreferredShop(e.target.value || null)}
                aria-label={t('acc.prefShop')}
              >
                <option value="">{t('acc.noPrefShop')}</option>
                {(shops || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.city}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!user.isBusiness && <div className="ws-acc__row">
          <button type="button" className="ws-linkbtn" onClick={() => selectTab('fidelite')}>{t('loyalty.title')}</button>
        </div>}
      </div>
      </AccFold>

      {/* « Mes bureaux » has its own tab: no second copy in the profile. */}
      {linkedCompanies.length > 0 && (
        <AccFold title={t('acc.b2bAccounts')}><div className="ws-acc__section">
          <div className="ws-acc__section-h">{t('acc.b2bAccounts')}</div>
          {linkedCompanies.map((c) => (
            <div key={c.id} className="ws-acc__card ws-acc__card--ok">
              <div className="ws-acc__card-row"><span className="ws-acc__k">{t('acc.company')}</span><span className="ws-acc__v">{c.name}</span></div>
              {c.vat ? <div className="ws-acc__card-row"><span className="ws-acc__k">{wsText("ui.vat")}</span><span className="ws-acc__v">{c.vat}</span></div> : null}
              <div className="ws-acc__card-row"><span className="ws-acc__k">{t('acc.billing')}</span><span className="ws-acc__v">{c.deferredBilling ? wsText("ui.deferred") : wsText("ui.directPayment")}</span></div>
            </div>
          ))}
        </div></AccFold>
      )}

      {window.LangMenu && (
        <AccFold title={t('acc.language')} className="ws-acc__fold--lang"><div className="ws-acc__section">
          <div className="ws-acc__section-h">{t('acc.language')}</div>
          <window.LangMenu />
        </div></AccFold>
      )}
      </>}

      {activeTab === 'achats' && !purchaseDetailsOpen && <div className="ws-acc__foot">
        <button type="button" className="ws-iconbtn ws-purchases-refresh" title={t('stock.refresh')} onClick={() => setPurchaseRevision(value => value + 1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg><span className="ws-vh">{t('stock.refresh')}</span></button>
      </div>}
      </section>
      </div>
    </ModalShell>
  );
}

// OfficeRequestModal removed : superseded by AccountModal's inline office add flow

// =========================================================================
// CHECKOUT : slide-over 3-step wizard (Coordonnées · Créneau · Paiement)
// Two flows: Click & Collect (logged-in) / Office Shop (delivery, logged-in).
// Guest collect → forced login/register before continuing.
// =========================================================================
// Slots now come from WSCalendar.listSlots(). The deprecated stub was removed.
//
// Moyens de paiement : SOURCE UNIQUE = le serveur (/payment-methods), qui
// applique les règles réelles (boutique × profil guest/registered/company, et
// paiement différé selon ws_offices.deferred_billing_enabled). Les listes
// codées en dur (bancontact/visa/apple, « paiement différé ») ont été
// SUPPRIMÉES : elles proposaient au client des moyens de paiement qui ne sont
// pas forcément configurés pour sa boutique. Sans réponse du serveur la liste
// reste VIDE et l'étape Paiement affiche une erreur, jamais d'option inventée.
function usePaymentMethods(shopId, mode, deliveryFeeResult, profile, companyId) {
  const [methods, setMethods] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    if (!(window.WSPayments && window.WSPayments.endpoint)) { setMethods([]); return () => { alive = false; }; }
    // `mode` était reçu par le hook et listé dans ses dépendances, mais jamais
    // transmis : la liste ne dépendait donc pas du mode, et « paiement en
    // boutique » apparaissait sur une livraison.
    window.WSPayments.list({ shopId, profile: profile || 'guest', companyId, mode })
      .then((m) => {
        if (!alive) return;
        setMethods(Array.isArray(m) ? m.map((x) => ({ id: x.method, method: x.method, label: x.label || x.method, family: x.family || x.method, sub: '' })) : []);
      })
      .catch(() => { if (alive) setMethods([]); });
    return () => { alive = false; };
  }, [shopId, mode, deliveryFeeResult && deliveryFeeResult.payment_type, profile, companyId]);
  return methods;
}

function CheckoutWizard({ open, onClose, shop, mode, basket, quoteState, user, onLogin, onPlaced,
                          voucherInput, setVoucherInput, voucherApplied, setVoucherApplied,
                          office, tour, date, onDate,
                          deliveryFeeResult, deliveryFeeErr, officeSites, selectedSiteId, setSelectedSiteId, onQuoteChanged }) {
  const { t } = wsUseT();
  const [step, setStep] = useState(1);
  const shoppingContext = basketShoppingContext(basket);
  const officeContext = shoppingContext.mode !== 'standard';
  const billing = quoteState.quote?.billing;
  const companyBilling = officeContext && billing?.mode === 'company';
  const payerName = billing?.company?.company_name || billing?.company?.name || billing?.company?.company || '';

  useEffect(() => { if (!user) setStep(1); }, [user]);
  const [forceAuth, setForceAuth] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState(null);
  // Keep the exact request while its outcome is unknown: quoting again would
  // reject a reward already reserved by a successfully saved order.
  const [pendingOrder, setPendingOrder] = useState(null);
  // Clé d'idempotence : STABLE tant que le tunnel reste ouvert, renouvelée à
  // chaque réouverture. Deux clics, ou un renvoi après une erreur réseau
  // portent donc la même clé, et le serveur renvoie la commande déjà créée au
  // lieu d'en enregistrer une seconde.
  const newPayKey = () => 'ws-' + Date.now().toString(36) + '-' +
    Math.random().toString(36).slice(2, 10);
  const [payKey, setPayKey] = useState(newPayKey);

  // Guest contact (collect only)
  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  // Slot
  const [slot, setSlot] = useState(null);

  const [invoiceBuyer, setInvoiceBuyer] = useState({type: 'none'});
  const [orderNote, setOrderNote] = useState('');
  const [poNumber, setPoNumber] = useState('');

  // Payment : reset to 'deferred' for deferred sites, 'bancontact' otherwise
  // Aucun moyen par défaut inventé : « bancontact » n'existe pas côté serveur
  // (les méthodes réelles sont stripe / shop / deferred). La sélection est
  // posée par l'effet dès que /payment-methods a répondu.
  const defaultPayment = '';
  const [payment, setPayment] = useState(defaultPayment);

  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    let alive = true;
    setCompanies([]);
    if (open && user?.id) {
      billingRequest('/companies').then(rows => { if (alive) setCompanies(rows); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [open, user?.id]);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setStep(1); setSlot(null); setInvoiceBuyer({type: 'none', name: [user?.firstName, user?.lastName].filter(Boolean).join(' ')}); setForceAuth(false); setPaying(false); setPayErr(null);
      setPayKey(newPayKey());
      setOrderNote('');
      setPoNumber('');
      setPayment('');
    }
  }, [open]);

  // Moyens de paiement : chargés ICI, AVANT tout return conditionnel, un hook
  // placé après « if (!open) return null » change le nombre de hooks entre deux
  // rendus, ce que React refuse (écran blanc à l'ouverture du tunnel).
  const ordinaryPaymentMethods = usePaymentMethods(
    shop && shop.id, mode, deliveryFeeResult,
    user ? 'registered' : 'guest', null,
  ).filter((method) => method.method !== 'shop' && method.family !== 'shop');
  const freeVoucherOrder = mode === 'collect' && (quoteState.quote?.voucher?.valid === true && quoteState.quote?.voucher?.matches_cart === true) && Number(quoteState.quote?.totals?.gross_after_discount) === 0;
  const paymentMethods = freeVoucherOrder ? [{id:'shop',method:'shop',family:'shop',label:t('loyaltyUse.noPayment'),sub:t('loyaltyUse.collect')}] : companyBilling
    ? [{ id: 'company_invoice', method: 'company_invoice', label: t('payment.method.company_invoice'), family: 'deferred', sub: t('officeAccess.companyNote') }]
    : ordinaryPaymentMethods;
  React.useEffect(() => {
    if (companyBilling) setPayment('company_invoice');
    else if (payment === 'company_invoice') setPayment('');
  }, [companyBilling, payment]);


  if (!open) return null;

  if (pendingOrder) return <aside className="ws-checkout" role="dialog" aria-label={t('co.subtitle')}>
    <div className="ws-checkout__body">
      <p role="status">{t('loyaltyUse.orderPending')}</p>
      <p>{pendingOrder.shopName} · {wsCurrency(pendingOrder.total)}</p>
      {payErr && <p role="alert">{wsMessage(payErr)}</p>}
    </div>
    <footer className="ws-checkout__foot">
      {String(user?.id || '') === pendingOrder.client
        ? <button type="button" className="ws-btn" disabled={paying} onClick={() => retryOrder()}>{t('loyaltyUse.retryOrder')}</button>
        : <button type="button" className="ws-btn" onClick={onLogin}>{t('loyaltyUse.sameAccount')}</button>}
    </footer>
  </aside>;

  const deliveryFee = (mode === 'delivery' && deliveryFeeResult) ? (deliveryFeeResult.fee_amount || 0) : 0;
  const T = wsQuoteTotals(quoteState.quote, deliveryFee);
  if (!T) return <aside className="ws-checkout" role="dialog" aria-label={t('co.subtitle')}>
    <div className="ws-checkout__body"><p role={quoteState.status === 'error' ? 'alert' : 'status'}>{quoteState.status === 'error' ? wsMessage(quoteState.error) : t('ui.updatingPrices')}</p></div>
    <footer className="ws-checkout__foot"><button type="button" className="ws-btn-ghost" onClick={onClose}>{t('common.close2')}</button></footer>
  </aside>;
  const voucherDiscount = T.bon;
  const subtotal = T.sousTotal;
  const total = T.total;

  // Step 1 validity
  function step1Valid() { return Boolean(user) && (mode !== 'delivery' || Boolean(office && selectedSiteId && !deliveryFeeErr)); }
  function step2Valid() { return Boolean(slot); }
  // Étape 3 : un moyen de paiement doit être proposé ET choisi. Sans ce test, le
  // bouton « Payer » restait actif alors que l'écran affichait « moyens
  // indisponibles », et la commande partait avec un moyen vide.
  function step3Valid() { return paymentMethods.some((method) => method.id === payment) && (officeContext || validInvoiceBuyer(invoiceBuyer)); }

  async function handlePay() {
    if (!user) { onLogin(); return; }
    if (quoteState.status !== 'ready') { setPayErr(wsText("error.quote")); return; }
    // Livraison bureau sans frais résolus : on REFUSE au lieu de facturer 0 €
    // et de forcer un paiement immédiat à un bureau en facturation différée.
    if (mode === 'delivery' && deliveryFeeErr) { setPayErr(deliveryFeeErr); return; }
    setPaying(true); setPayErr(null);
    try {
      const freshQuote = await window.WSQuote.quote({ shopId: shop.id, mode, basket, shoppingContext, deliveryDate: date,
        voucherCode: voucherApplied?.ok ? voucherApplied.voucher?.code : null });
      if (voucherApplied?.ok && (freshQuote.voucher?.valid !== true || freshQuote.voucher?.matches_cart !== true)) {
        onQuoteChanged?.(freshQuote); setPayErr(t('error.codeInvalid')); return;
      }
      if (JSON.stringify(wsCheckoutQuoteComparable(freshQuote))
          !== JSON.stringify(wsCheckoutQuoteComparable(quoteState.quote))) {
        onQuoteChanged?.(freshQuote); setPayErr(t('officeAccess.priceChanged')); return;
      }
      // Jour choisi au format YYYY-MM-DD LOCAL (isoOf évite le décalage UTC de
      // toISOString à minuit) : sans lui, ws_orders.delivery_date restait NULL
      // et une commande J+1 apparaissait sous « aujourd'hui » côté back-office.
      const isoFn = (window.WSAvailability || window.WSCalendar)?.isoOf
        || ((x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
      const deliveryDate = date instanceof Date ? isoFn(date) : (date || null);
      const payload = {
        shopId: shop && shop.id,
        locale: (window.WSI18n && window.WSI18n.getLang) ? window.WSI18n.getLang() : 'en',
        requestKey: payKey,
        shopping_context: shoppingContext,
        selected_automatic_promotion_id: wsSelectedAutomaticPromotionId(basket),
        expected_total: freshQuote.totals.gross_after_discount,
        mode,
        deliveryDate,
        slot: typeof slot === 'object' && slot
          ? { slotId: slot.id, label: slot.label, date: deliveryDate }
          : { slotId: slot, label: slot, date: deliveryDate },
        basket: basket.map((l, index) => ({ line_key: wsQuoteLineKey(l, index), shopping_context: normaliseShoppingContext(l.shopping_context), productId: l.productId, qty: l.qty, portion: l.portion || null, id_product_portion: l.id_product_portion ?? null, ...(l.weight_grams != null ? { weight_grams: l.weight_grams } : {}), note: l.note || null, options: l.options || [], bundleId: l.bundleId || null, bundleOfferId: l.bundleOfferId || null, bundleSlots: l.bundleSlots || {}, ...(l.promotion_group && Number(l.promotion_id) > 0 ? { promotion_group: l.promotion_group, promotion_id: Number(l.promotion_id) } : {}), ...(l.personalization_selection ? {personalization_selection:l.personalization_selection} : {}), ...(l.menu_selection ? {menu_selection:l.menu_selection} : {}) })),
        voucher: voucherApplied && voucherApplied.ok ? voucherApplied.voucher.code : null,
        note: orderNote || null,
        onAccount: officeContext && companyBilling,
        customer: user ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone || null, officeId: user.officeId || null } : { ...contact },
        payment: { method: freeVoucherOrder ? 'shop' : companyBilling ? 'company_invoice' : payment },
        delivery: mode === 'delivery' && office ? {
          office_client_id:            office.id,
          office_delivery_site_id:     selectedSiteId || null,
          office_delivery_site_name:   deliveryFeeResult && deliveryFeeResult.site ? deliveryFeeResult.site.name : (office.address || null),
          address:                     deliveryFeeResult && deliveryFeeResult.site ? deliveryFeeResult.site.address : office.address,
          tournee_id:                  deliveryFeeResult && deliveryFeeResult.site ? deliveryFeeResult.site.tournee_id  : (office.tourId || null),
          tournee_stop_id:             deliveryFeeResult && deliveryFeeResult.site ? deliveryFeeResult.site.tournee_stop_id : null,
          payment_type:                deliveryFeeResult ? deliveryFeeResult.payment_type : 'immediate',
          delivery_fee_applied:        deliveryFee > 0,
          delivery_fee_amount:         deliveryFee,
          free_delivery_minimum:       deliveryFeeResult ? (deliveryFeeResult.free_delivery_minimum || 0) : 0,
          delivery_mode:               'office_delivery',
        } : null,
        total,
        invoice_request: !officeContext && invoiceBuyer.type !== 'none' ? {...invoiceBuyerPayload(invoiceBuyer), po: poNumber} : null,
      };
      // Une commande n'est « passée » que si le serveur l'a ENREGISTRÉE. L'ancien
      // repli renvoyait un faux succès (orderId 'ord-demo') quand le module de
      // commande était absent : le client voyait une confirmation pour une
      // commande qui n'existait nulle part. Sans module → erreur, jamais de
      // confirmation inventée.
      if (!window.WSOrders) throw new Error(wsText("error.orderUnavailable"));
      const attempt = JSON.parse(JSON.stringify({ payload, client: String(user.id), shopName: shop.name,
        slot, payment: payload.payment.method, total, paymentMethods, freeVoucherOrder }));
      setPendingOrder(attempt);
      let result;
      try { result = await window.WSOrders.place(attempt.payload); }
      catch (error) {
        if (error.orderRejected) setPendingOrder(null);
        throw error;
      }
      setPendingOrder(null);
      await finishOrder(attempt, result);
    } catch (ex) {
      if (ex.code === 'WEBSHOP_QUOTE_CHANGED' && ex.quote) {
        onQuoteChanged?.(ex.quote); setPayErr(t('officeAccess.priceChanged'));
      } else setPayErr(ex.code?.startsWith("BILLING_") ? billingError(new Error(ex.code)) : (ex.message || wsText("error.payment")));
    } finally {
      setPaying(false);
    }
  }

  async function retryOrder() {
    if (paying || !pendingOrder || String(user?.id || '') !== pendingOrder.client) return;
    setPaying(true); setPayErr(null);
    try {
      const result = await window.WSOrders.place(pendingOrder.payload);
      const attempt = pendingOrder;
      setPendingOrder(null);
      await finishOrder(attempt, result);
    } catch (error) {
      // A rejection now cannot disprove the earlier uncertain attempt.
      // Keep its key and payload until the server confirms the existing order.
      setPayErr(error.message || wsText('error.payment'));
    } finally { setPaying(false); }
  }

  async function finishOrder(attempt, result) {
    const {slot, payment, total, paymentMethods, freeVoucherOrder} = attempt;
    /* PAIEMENT EN LIGNE (famille « stripe », servie par /payment-methods).
       La commande vient d'être ENREGISTRÉE ; l'encaissement se fait sur la
       page Stripe hébergée, créée par POST /payments/checkout, et seul le
       webhook Stripe marque « payé ». Sans cet appel, une commande « carte »
       était confirmée à l'écran sans qu'aucun paiement n'ait jamais lieu :
       POST /orders ne rend pas d'URL de paiement, et rien n'appelait la
       route qui la fabrique. Hors ligne : différé/sur compte (la facture
       suit) et paiement en boutique (encaissé au comptoir). */
    const payFam = (paymentMethods.find((x) => x.id === payment) || {}).family || payment;
    const differe = Boolean(result && (result.paymentType === 'deferred' || result.paymentType === 'company_invoice' || result.onAccount));
    if (!freeVoucherOrder && (payment === 'stripe' || payFam === 'stripe') && !differe && window.WSOrders.pay) {
      let sess;
      try {
        sess = await window.WSOrders.pay(result.orderRef);
      } catch (_) {
        // The order already exists. Consume its basket and expose a durable
        // recovery view instead of letting the customer submit it again.
        onPlaced({ ...result, paymentPending: true });
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.set('stripe', 'return'); returnUrl.searchParams.set('orderRef', result.orderRef);
        window.history.replaceState(window.history.state, '', returnUrl.pathname + returnUrl.search);
        window.dispatchEvent(new CustomEvent('ws:stripe-recovery', { detail: { orderRef: result.orderRef } }));
        return;
      }
      if (sess.status === 'paid') { onPlaced({ ...result, slot, payment, total: result.total }); return; }
      onPlaced({ ...result, paymentPending: true });
      if (sess.uiMode === 'embedded' || sess.status === 'pending') {
        window.dispatchEvent(new CustomEvent('ws:stripe-recovery', { detail: { orderRef: result.orderRef, session: sess } }));
      } else window.location.href = sess.checkoutUrl;
      return;
    }
    // Le LIBELLÉ vient de la liste serveur : la confirmation annonçait
    // « Bancontact » pour toute méthode non reconnue, donc aussi pour un
    // paiement en boutique ou sur compte, que le client n'a pas fait.
    const payLabel = (paymentMethods.find((x) => x.id === payment) || {}).label || payment;
    /* Le total du SERVEUR, pas celui du navigateur. L'ancien ordre
       (`{ ...result, total }`) écrasait le montant facturé par l'aperçu
       local : le client lisait sur sa confirmation un montant que personne
       n'avait débité. L'aperçu ne sert qu'à défaut de réponse chiffrée. */
    const totalFacture = (result && typeof result.total === 'number') ? result.total : total;
    onPlaced({ ...result, slot, payment, paymentLabel: payLabel, total: totalFacture });
  }

  function next() {
    if (paying) return;
    if (quoteState.status !== 'ready' || !quoteState.quote?.totals) { setPayErr(wsText('error.quote')); return; }
    if (!user) { onLogin(); return; }
    if (step === 1) {
      if (!step1Valid()) return;
      setStep(2);
    } else if (step === 2) {
      if (!step2Valid()) return;
      setStep(3);
    } else {
      if (!step3Valid()) { setPayErr(wsText("error.pickPayment")); return; }
      handlePay();
    }
  }

  return (
    <aside className="ws-checkout" role="dialog" aria-label={t('co.title')}>
      <header className="ws-checkout__head">
        <button className="ws-checkout__back" onClick={onClose}>
          <Pict d={<path d="M15 6l-6 6 6 6"/>} s={12}/> {t('co.backToCart')}
        </button>
        <span className="ws-checkout__title">{t('co.subtitle')}</span>
      </header>

      <ol className="ws-stepper">
        {[
          { n: 1, label: t('co.step1') },
          { n: 2, label: t('co.step2') },
          { n: 3, label: t('co.step3') },
        ].map((s) => (
          <li key={s.n} className={`ws-stepper__step${step === s.n ? ' is-current' : ''}${step > s.n ? ' is-done' : ''}`}>
            <span className="ws-stepper__num">{step > s.n ? <Pict d={<path d="M5 12l4 4 10-10"/>} s={11}/> : s.n}</span>
            <span className="ws-stepper__lbl">{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="ws-checkout__body">
        {mode === 'delivery' && deliveryFeeErr && <p className="ws-co-error" role="alert">{wsMessage(deliveryFeeErr)}</p>}

        {step === 1 && (
          <CheckoutStep1
            mode={mode} shop={shop} user={user} office={office} tour={tour}
            contact={contact} setContact={setContact}
            forceAuth={!user || forceAuth} onLoginNow={() => onLogin()}
            officeSites={officeSites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId}
            deliveryFeeResult={deliveryFeeResult}
          />
        )}
        {step === 2 && (
          <CheckoutStep2 minLeadDays={Math.max(0, ...basket.map(line => Number(line.lead_time) || 0))} basket={basket} mode={mode} shop={shop} office={office} tour={tour} slot={slot} setSlot={setSlot} date={date} onDate={onDate} selectedSiteId={selectedSiteId}/>
        )}
        {step === 3 && (
          <>
          <CheckoutStep3
            mode={mode} basket={basket} subtotal={subtotal} totaux={T} total={total}
            quoteState={quoteState} shoppingContext={shoppingContext} companyBilling={companyBilling} deliveryDate={date}
            deliveryFee={deliveryFee} deliveryFeeResult={deliveryFeeResult} deliveryFeeErr={wsMessage(deliveryFeeErr)}
            payment={payment} setPayment={setPayment} paymentMethods={paymentMethods}
            shop={shop}
            shopId={shop && shop.id}
            voucherInput={voucherInput} setVoucherInput={setVoucherInput}
            voucherApplied={voucherApplied} setVoucherApplied={setVoucherApplied}
            voucherDiscount={voucherDiscount}
            giftEmail={user ? (user.email || null) : ((contact && contact.email) || null)}
            customerId={user ? user.id : null}
          />
          {user && !officeContext && <div className="ws-b2b">
            <InvoiceBuyerFields buyer={invoiceBuyer} setBuyer={setInvoiceBuyer} companies={companies} disabled={paying || !!pendingOrder} allowNone allowPersonal={false}/>
            {invoiceBuyer.type !== 'none' && <>
              <label className="ws-acc__field"><span>{t('co.company.po')}</span>
                <input className="ws-acc__input" value={poNumber} onChange={event => setPoNumber(event.target.value)} maxLength={100} disabled={paying}/>
              </label>
              <label className="ws-acc__field"><span>{t('co.company.note')}</span>
                <textarea className="ws-acc__input" value={orderNote} onChange={event => setOrderNote(event.target.value)} maxLength={1000} disabled={paying}/>
              </label>
            </>}
          </div>}
          </>
        )}
      </div>

      <footer className="ws-checkout__foot">
        {payErr && <div className="ws-checkout__pay-err" role="alert">{wsMessage(payErr)}</div>}
        {step === 3 && paymentMethods.length === 0 && <div className="ws-checkout__pay-err" role="alert">{t('error.noPayments')}</div>}
        <div className="ws-checkout__foot-total">
          <span className="ws-checkout__foot-k">{t('sum.total')}</span>
          <span className="ws-checkout__foot-v">{wsCurrency(total)}</span>
        </div>
        {!!user && step === 2 && !step2Valid() && <p className="ws-checkout__hint" role="status">{t('co.slot.pickToContinue')}</p>}
        <div className="ws-checkout__foot-actions">
          {step > 1 && <button className="ws-btn-ghost" {...wsTap(() => setStep((s) => s - 1), { shield: true })} disabled={paying}>{t('co.prev')}</button>}
          <button
            type="button"
            className="ws-cta ws-cta--block"
            disabled={paying || quoteState.status !== 'ready' || (!!user && ((step === 1 && !step1Valid()) || (step === 2 && !step2Valid()) || (step === 3 && !step3Valid())))}
            onClick={next}
          >
            {!user ? t('co.auth.signin') : paying ? t('co.processing') : step === 3 ? (companyBilling || payment === 'shop' ? t('officeAccess.confirmOrder') : t('co.payAmount', { amount: wsCurrency(total) })) : t('co.continue')}
            {!paying && step < 3 && <Pict d={<path d="M5 12h14M13 5l7 7-7 7"/>} s={13}/>}
          </button>
        </div>
      </footer>
    </aside>
  );
}

function CheckoutStep1({ mode, shop, user, office, tour, contact, setContact, forceAuth, onLoginNow,
                         officeSites, selectedSiteId, setSelectedSiteId, deliveryFeeResult }) {
  const { t } = wsUseT();
  // Office Shop: site selector + read-only delivery info
  if (mode === 'delivery' && user && office) {
    const activeSite = (officeSites || []).find((s) => s.id === selectedSiteId) || null;
    const feeResult = deliveryFeeResult;
    // Un complément d'adresse réduit à un tiret n'est pas un complément : c'est
    // un placeholder saisi ou repris comme donnée. Il était concaténé tel quel
    // et l'adresse s'affichait « … Louvain-la-Neuve ·, ».
    const complement = (v) => {
      const s = String(v == null ? '' : v).trim();
      return (s === '' || s === '—' || s === '-' || s === '–') ? '' : s;
    };
    return (
      <div className="ws-co-step">
        <h3 className="ws-co-step__title">{t('co.delivery.address')}</h3>
        <p className="ws-co-step__lede">{t('co.delivery.pickSite')}</p>

        {officeSites && officeSites.length > 1 && (
          <div className="ws-co-site-select">
            {officeSites.map((site) => (
              <label key={site.id} className={`ws-co-site-opt${selectedSiteId === site.id ? ' is-active' : ''}`}>
                <input type="radio" name="delivery-site" value={site.id} checked={selectedSiteId === site.id}
                  onChange={() => setSelectedSiteId(site.id)}/>
                <span className="ws-co-site-opt__radio"/>
                <span className="ws-co-site-opt__body">
                  <span className="ws-co-site-opt__name">{site.name}</span>
                  <span className="ws-co-site-opt__addr">{site.address}{complement(site.floor_room) ? ' · ' + complement(site.floor_room) : ''}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="ws-co-readbox">
          <ReadRow k={t('acc.company')} v={office.name}/>
          {/* Repli sur le titulaire du compte, comme la ligne Téléphone juste en
              dessous : un site sans contact nommé affichait une ligne VIDE. */}
          <ReadRow k={t('off.contact')}    v={(activeSite ? activeSite.contact_name : null)
                                     || ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || '—'}/>
          <ReadRow k={t('form.emailLong')} v={user.email}/>
          <ReadRow k={t('form.phone')} v={(activeSite ? activeSite.contact_phone : office.phone) || user.phone || '—'}/>
          <ReadRow k={wsText("co2.address")}    v={activeSite
                                     ? (activeSite.address + (complement(activeSite.floor_room) ? ' · ' + complement(activeSite.floor_room) : ''))
                                     : (office.address || '—')}/>
          {activeSite?.routes?.length > 0 && <ReadRow k={wsText('ui.route')} v={activeSite.routes.map(route => route.name).join(', ')}/>}
          {feeResult && (
            <ReadRow k={wsText("checkout.delivery")}
              v={feeResult.free_delivery
                ? wsText("ui.free")
                : feeResult.fee_amount > 0
                  ? `${wsCurrency(feeResult.fee_amount)}${feeResult.free_delivery_minimum > 0 ? ' (' + wsText('ui.freeDeliveryThreshold', { amount: wsCurrency(feeResult.free_delivery_minimum) }) + ')' : ''}`
                  : wsText("ui.free")}/>
          )}
          {feeResult && feeResult.payment_type === 'deferred' && (
            <ReadRow k={wsText("sum.payment")} v={wsText("ui.monthlyInvoice")}/>
          )}
        </div>
        <p className="ws-co-step__locknote"><Pict d={<><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></>} s={12}/> {t('co.contact.editFromAccount')}</p>
      </div>
    );
  }

  // Logged-in collect: prefilled, read-only (per spec)
  if (user) {
    return (
      <div className="ws-co-step">
        <h3 className="ws-co-step__title">{t('co.contact.title')}</h3>
        <p className="ws-co-step__lede">{t('co.contact.prefilled')}</p>
        <div className="ws-co-readbox">
          <ReadRow k={t('form.lastName')} v={user.firstName + ' ' + user.lastName}/>
          <ReadRow k={t('form.emailLong')} v={user.email}/>
          <ReadRow k={t('form.phone')} v={user.phone || office?.phone || '—'}/>
          <ReadRow k={t('off.shop')} v={shop.name + ' · ' + shop.address}/>
        </div>
      </div>
    );
  }

  // Guest collect : fields, then forced login at the gate
  if (forceAuth) {
    return (
      <div className="ws-co-step">
        <h3 className="ws-co-step__title">{t('co.auth.title')}</h3>
        <p className="ws-co-step__lede">{t('co.auth.lede')}</p>
        <div className="ws-co-authwall">
          <button className="ws-cta ws-cta--block" onClick={onLoginNow}>{t('co.auth.signin')}</button>
          <button className="ws-btn-ghost" onClick={onLoginNow}>{t('auth.createAccount')}</button>
        </div>
      </div>
    );
  }
  // Guest collect : contact fields, optional login
  return (
    <div className="ws-co-step">
      <div className="ws-co-guest__banner">
        <span className="ws-co-guest__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
        <div className="ws-co-guest__banner-copy">
          <strong>{t('co.guest.title')}</strong>
          <span>{t('co.guest.hint')}</span>
        </div>
      </div>
      <h3 className="ws-co-step__title">{t('co.contact.title')}</h3>
      <div className="ws-form">
        <div className="ws-form__row2">
          <label className="ws-field"><span>{t('form.firstName')}</span><input value={contact.firstName} onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))} autoComplete="given-name"/></label>
          <label className="ws-field"><span>{t('form.lastName')}</span><input value={contact.lastName} onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))} autoComplete="family-name"/></label>
        </div>
        <label className="ws-field"><span>{t('form.email')}</span><input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} autoComplete="email"/></label>
        <label className="ws-field"><span>{t('form.phone')}</span><input value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} autoComplete="tel"/></label>
      </div>
      <p className="ws-co-guest__login">{t('co.guest.already')} <button type="button" className="ws-linkbtn" onClick={onLoginNow}>{t('co.auth.signin')}</button> {wsText("ui.prefill")}</p>
    </div>
  );
}

function SlotIcon({ name, size = 15 }) {
  const paths = {
    lunch:   <><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    evening: <path d="M20 14.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 10.5z"/>,
  };
  return (
    <svg className="ws-slotseg__ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.lunch}
    </svg>
  );
}

// Single derived CTA : renders ONLY what the server returns in `cta`
// (label/theme/icon). No horaire, couleur, or libellé hardcoded here.
function SlotCTA({ cta, onClick }) {
  if (!cta) return null;
  return (
    <button type="button" className="ws-slotcta" data-slot-theme={cta.theme} onClick={onClick}>
      <span className="ws-slotcta__ic"><SlotIcon name={cta.icon} size={16}/></span>
      <span>{window.WSI18n.translateKnown(cta.label)}</span>
    </button>
  );
}

// Sticky segmented control : shown only when the office has 2+ orderable slots.
function SlotSegmented({ slots, selected, onSelect }) {
  const { t } = wsUseT();
  if (!slots || slots.length < 2) return null;
  const active = slots.find((s) => s.slot_type === selected) || slots[0];
  return (
    <div className="ws-slotseg" role="tablist" aria-label={t('co.slot.title')}>
      <div className="ws-slotseg__tabs">
        {slots.map((s) => {
          const theme = (s.cta && s.cta.theme) || (s.slot_type === 'soir' ? 'evening' : 'lunch');
          const on = s.slot_type === selected;
          return (
            <button key={s.route_id} type="button" role="tab" aria-selected={on}
              className="ws-slotseg__btn" data-slot-theme={theme} data-active={on}
              onClick={() => onSelect(s.slot_type, s)}>
              <SlotIcon name={(s.cta && s.cta.icon) || (s.slot_type === 'soir' ? 'evening' : 'lunch')}/>
              <span>{(s.cta && window.WSI18n.translateKnown(s.cta.label)) || (s.slot_type === 'soir' ? wsText("ui.evening") : wsText("ui.noon"))}</span>
            </button>
          );
        })}
      </div>
      {active && active.cutoff_label && (
        <div className="ws-slotseg__cutoff">{t('co.slot.orderBefore')} <strong>{active.cutoff_label}</strong></div>
      )}
    </div>
  );
}

// Confirmation modal : one cart = one route + one date. Lists removed items.
function SlotChangeModal({ items, targetLabel, onConfirm, onCancel }) {
  const { t } = wsUseT();
  return (
    <div className="ws-drawer is-open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="ws-drawer__panel ws-slotchange" role="dialog" aria-label={t('co.slot.change')}>
        <h3 className="ws-co-step__title">{t('co.slot.changeQ')}</h3>
        <p className="ws-co-step__lede">{wsText('ui.switchSlotHint', { slot: targetLabel, count: items.length })}</p>
        <ul className="ws-slotchange__list">
          {items.map((l) => <li key={l.line}><span>{l.name}</span><span>×{l.qty}</span></li>)}
        </ul>
        <div className="ws-slotchange__actions">
          <button type="button" className="ws-fid__cancel" onClick={onCancel}>{t('common.cancel2')}</button>
          <button type="button" className="ws-slotchange__confirm" onClick={onConfirm}>{t('co.slot.removeContinue')}</button>
        </div>
      </div>
    </div>
  );
}

// Seven days from the earliest possible pickup, same tiles as the header date picker.
function CheckoutDayStrip({ mode, shopId, date, minLeadDays, basket, onPick, label }) {
  const [closed, setClosed] = React.useState({});
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + Math.max(0, Number(minLeadDays) || 0));
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(start); d.setDate(d.getDate() + k); return d; });
  const api = window.WSAvailability || window.WSCalendar;
  const iso = d => (api?.isoOf ? api.isoOf(d) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  React.useEffect(() => {
    if (!api || typeof api.listAvailableDays !== 'function') return;
    let alive = true;
    api.listAvailableDays({ shopId, mode, basket, from: iso(days[0]), to: iso(days[6]) })
      .then(rows => { if (!alive) return; const map = {}; for (const row of (rows || [])) if (row.available === false) map[row.iso] = true; setClosed(map); })
      .catch(() => {});
    return () => { alive = false; };
  }, [shopId, mode, minLeadDays, basket]);
  const selected = date instanceof Date ? iso(date) : '';
  return <div className={`ws-co-daystrip ws-co-daystrip--${mode}`} role="group" aria-label={label}>
    <span className="ws-co-daystrip__label">{label}</span>
    <div className="ws-datepop__strip">
      {days.map(d => {
        const key = iso(d); const off = !!closed[key]; const sel = key === selected;
        return <button key={key} type="button" disabled={off} aria-pressed={sel}
          className={`ws-daytile${sel ? ' is-sel' : ''}${off ? ' is-off' : ''}`} onClick={() => onPick(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}>
          <span className="ws-daytile__wd">{wsCap(d.toLocaleDateString(wsLocale(), { weekday: 'short' }))}</span>
          <strong className="ws-daytile__n">{d.getDate()}</strong>
          <span className="ws-daytile__m">{d.toLocaleDateString(wsLocale(), { month: 'short' })}</span>
        </button>;
      })}
    </div>
  </div>;
}

function CheckoutStep2({ mode, shop, office, tour, slot, setSlot, date, onDate, selectedSiteId, minLeadDays, basket }) {
  const { t, lang } = wsUseT();
  const [slots, setSlots] = React.useState([]);
  const [dateLabel, setDateLabel] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    setSlot(null); setSlots([]); setLoading(true); setFailed(false);
    (async () => {
      // Use the parent-selected date, not hardcoded today
      const d = date instanceof Date ? date : new Date();
      setDateLabel(wsCap(d.toLocaleDateString(wsLocale(), { weekday: 'long', day: 'numeric', month: 'long' })));
      // Repli LOCAL, jamais UTC : toISOString() renvoie la veille pour une Date
      // à minuit en UTC+2.
      const isoFn = (window.WSAvailability || window.WSCalendar)?.isoOf
        || ((x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
      const isoDate = isoFn(d);
      const api = window.WSAvailability || window.WSCalendar;
      if (!api) throw new Error('Availability API missing');
      const list = mode === 'delivery'
        ? await window.WSOffices.deliverySlots({shop: shop?.id, officeId: office?.id, siteId: selectedSiteId, date: isoDate})
        : await api.listSlots({ shopId: shop?.id, mode, date: isoDate, basket });
      if (alive) {
        if (mode === 'delivery') {
          const available = (list || []).find(s => s.available !== false && s.current_orders < s.capacity && s.delivery_window_label);
          const window = available ? {...available, label: available.delivery_window_label} : null;
          setSlots(window ? [window] : []);
          setSlot(window ? {id: window.id, label: window.label} : null);
        } else setSlots(list || []);
      }
    })().catch(() => { if (alive) setFailed(true); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // `lang` : la date longue (« Zondag 16 augustus ») est rendue par Intl
    // dans la langue courante : sans cette dépendance, elle resterait dans la
    // langue du premier affichage.
  }, [mode, shop?.id, office?.id, selectedSiteId, date, lang, basket]);

  const noAvailableSlots = !loading && !failed && !slots.some(s => s.available !== false && s.current_orders < s.capacity);
  const selectedDateIso = window.WSAvailability.isoOf(date);
  const todayIso = window.WSAvailability.isoOf(new Date());
  const hideExpiredSlots = selectedDateIso < todayIso || (selectedDateIso === todayIso && noAvailableSlots);
  const selectedId = typeof slot === 'object' && slot ? slot.id : slot;

  return (
    <div className="ws-co-step">
      <h3 className="ws-co-step__title">{t(mode === 'delivery' ? 'co.slot.titleDelivery' : 'co.slot.titleCollect')}</h3>
      <p className="ws-co-step__lede">
        {mode === 'delivery'
          ? <>{wsText('ui.deliveryTo')} <strong>{office?.name}</strong></>
          : <>{t('co.pickup.at')} <strong>{shop.name}</strong>, {shop.address}.</>
        }
      </p>
      <div className="ws-co-day">
        <Pict d={ICONS.cal} s={13}/> <span>{dateLabel}</span>
      </div>
      <CheckoutDayStrip mode={mode} shopId={shop?.id} date={date} minLeadDays={minLeadDays} basket={basket}
        onPick={d => { setSlot(null); onDate?.(d); }} label={t(mode === 'delivery' ? 'co.slot.changeDateDelivery' : 'co.slot.changeDate')}/>
      <details className="ws-co-otherday"><summary>{t('common.seeMore')}</summary>
      <label className="ws-field"><span>{t('co.slot.changeDate')}</span><input type="date" value={window.WSAvailability.isoOf(date)} onChange={event=>{if(event.target.value){setSlot(null);onDate?.(new Date(event.target.value+'T12:00:00'));}}}/></label>
      </details>
      {loading && <p role="status">{t('common.loading2')}</p>}
      {!loading && (failed || noAvailableSlots) && <p role={failed?'alert':'status'}>{t(failed?'co.slot.loadError':'co.slot.noneAvailable')}</p>}
      {noAvailableSlots && mode === 'collect' && <p className="ws-co-step__lede" role="status">{t('co.slot.cartRestriction')}</p>}
      {noAvailableSlots && <PickupDates mode={mode} officeId={office?.id} siteId={selectedSiteId} shopId={shop?.id} minLeadDays={minLeadDays} basket={basket} date={date} onSelect={value=>{setSlot(null);onDate?.(value);}}/>}
      {!hideExpiredSlots && <div className="ws-slots">
        {slots.map((s) => {
          const id    = typeof s === 'object' ? s.id    : s;
          const label = typeof s === 'object' ? s.label : s;
          const full  = typeof s === 'object' && (s.available === false || s.current_orders >= s.capacity);
          {/* « X restants » retiré (23/08, même règle que les unités en stock) :
              la capacité résiduelle est une donnée interne. Seul l'état
              bloquant « Complet » s'affiche. */}
          return (
            <button key={id}
              className={`ws-slot${selectedId === id ? ' is-active' : ''}${full ? ' is-full' : ''}${full && s.reason === 'cutoff_passed' ? ' is-past' : ''}`}
              disabled={full}
              title={full ? wsText("ui.slotFull") : undefined}
              onClick={() => !full && setSlot({ id, label })}>
              <span className="ws-slot__lbl">{label}</span>
              {full && <span className="ws-slot__cap ws-slot__cap--full">{t(s.reason==='cutoff_passed'?'co.slot.tooLate':'slot.full')}</span>}
            </button>
          );
        })}
      </div>}
      {mode === 'delivery' && <p className="ws-co-step__hint">{t('co.delivery.included')}</p>}
    </div>
  );
}

function CheckoutStep3({ basket, subtotal, totaux, total, payment, setPayment, shop,
                         shopId, mode, voucherInput, setVoucherInput, voucherApplied, setVoucherApplied, voucherDiscount,
                         deliveryFee, deliveryFeeResult, deliveryFeeErr, customerId, quoteState,
                         paymentMethods, shoppingContext, companyBilling, deliveryDate }) {
  const { t } = wsUseT();
  const allowVoucher = shoppingContext?.mode !== 'office_offer';
  const voucherLoading = quoteState?.status === 'loading';
  const voucherErr = quoteState?.status === 'error' ? quoteState.error : null;
  const displayRows = wsBasketDisplayRows(basket, quoteState?.quote || null);
  // paymentMethods vient du wizard (prop) : plus de second appel à /payment-methods.
  // Si le moyen sélectionné n'est plus proposé (profil/boutique), prendre le premier dispo.
  useEffect(() => {
    if (paymentMethods.length && !paymentMethods.some((p) => p.id === payment)) setPayment((paymentMethods.find((method) => method.id === 'stripe') || paymentMethods[0]).id);
  }, [paymentMethods]);

  function applyVoucher() {
    if (!allowVoucher || voucherLoading) return;
    const code = voucherInput.trim().toUpperCase();
    if (code) setVoucherApplied({ ok: true, voucher: { code } });
  }
  function removeVoucher() {
    setVoucherApplied(null);
    setVoucherInput('');
  }

  return (
    <div className="ws-co-step">
      {shop && <section className="ws-co-ordering-shop" aria-label={shop.name}>
        <strong>{shop.name}</strong>
        <span>{shop.address}</span>
        <span>{t('privacy.seller')}{window.WSI18n.getLang() === 'fr' ? '\u202F:' : ':'} {shop.legal_name || shop.representative_name || shop.name}</span>
        {shop.vat_number && <span>VAT: {shop.vat_number}</span>}
        {shop.email && <span>{shop.email}</span>}
      </section>}
      <h3 className="ws-co-step__title">{t('sum.payment')}</h3>
      <p className="ws-co-step__lede">{t('co.pay.subtitle')}</p>

      {!allowVoucher && <p className="ws-office-context">{t('officeAccess.noVoucher')}</p>}
      {allowVoucher && <div className="ws-co-voucher">
        <div className="ws-co-voucher__head">
          <span className="ws-co-voucher__lbl">{t('co.promo.title')}</span>
          {voucherApplied && voucherApplied.ok && quoteState.status === 'ready' && quoteState.quote?.voucher?.matches_cart && (
            <span className="ws-co-voucher__badge">
              <Pict d={<path d="M5 12l4 4 10-10"/>} s={11}/> {t('co.applied')}
            </span>
          )}
        </div>
        {voucherApplied && voucherApplied.ok ? (
          <div className="ws-co-voucher__row ws-co-voucher__row--ok">
            <code className="ws-co-voucher__code">{voucherApplied.voucher.code}</code>
            <span className="ws-co-voucher__amt">{quoteState.status === 'ready' ? `−${wsCurrency(voucherDiscount)}` : '…'}</span>
            <button type="button" className="ws-co-voucher__remove" onClick={removeVoucher}>{t('common.remove')}</button>
          </div>
        ) : (
          <div className="ws-co-voucher__row">
            <input
              type="text"
              className="ws-co-voucher__input"
              placeholder={t('co.promo.ph')}
              value={voucherInput}
              onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyVoucher(); } }}
              autoComplete="off"
              spellCheck={false}
            />
            {/* onClick={applyVoucher} passait l'ÉVÉNEMENT de clic en premier
                argument, donc en « code forcé » : String(event) valait
                « [object Object] » et le code saisi n'était jamais lu. Aucun
                code tapé à la main ne pouvait aboutir, seuls les bons cliqués
                dans la liste fonctionnaient, eux qui passent leur code. */}
            <button type="button" className="ws-co-voucher__apply" onClick={() => applyVoucher()} disabled={!voucherInput.trim() || voucherLoading}>{voucherLoading ? '…' : t('co.apply')}</button>
          </div>
        )}
        {voucherErr && <div className="ws-co-voucher__err">{wsMessage(voucherErr)}</div>}

      </div>}


      <div className="ws-co-summary">
        <div className="ws-co-summary__h">{t('co.summary.title')}</div>
        <ul className="ws-co-summary__list">
          {displayRows.map((row) => (
            <li key={row.key}>
              <span className="ws-co-summary__qty">×{row.isPromotion ? 1 : row.quantity}</span>
              <span className="ws-co-summary__name">{row.isPromotion && row.promotion ? row.promotion.display_name : row.line.name}
                {row.isPromotion && row.lines.map(line => <small className="ws-co-summary__portion" key={line.line}>{line.qty} × {(line.portion_label || (line.options || []).map(option => option.label).join(', ')).replace(/^1\/1$/, '')} {line.name}</small>)}
              </span>
              <span className="ws-co-summary__amt">{wsCurrency(row.price)}</span>
            </li>
          ))}
        </ul>
        <div className="ws-co-summary__row"><span>{t('sum.subtotal')}</span><span>{wsCurrency(subtotal)}</span></div>
        {totaux && totaux.croise > 0 && (
          <div className="ws-co-summary__row ws-co-summary__row--promo">
            <span>{t('sum.crossOffer')}</span><span>−{wsCurrency(totaux.croise)}</span></div>)}
        {totaux && totaux.remise > 0 && (
          <div className="ws-co-summary__row ws-co-summary__row--promo">
            <span>{t('co.promo.title')}</span>
            <span>−{wsCurrency(totaux.remise)}</span></div>)}
        {totaux && totaux.weekday > 0 && (
          <div className="ws-co-summary__row ws-co-summary__row--promo">
            <span>{t('sum.weekdayDiscount')} {totaux.weekdayPercent > 0 && `(${wsNumber(totaux.weekdayPercent)}%)`}</span>
            <span>−{wsCurrency(totaux.weekday)}</span></div>)}
        {totaux && totaux.weekday === 0 && !totaux.weekdayThresholdMet && totaux.weekdayMinimum > 0 && (
          <div className="ws-co-summary__row ws-co-summary__row--promo">
            <span>{t('sum.weekdayDiscountMinimum', { amount: `${wsCurrency(totaux.weekdayMinimum)}`, remaining: `${wsCurrency(totaux.weekdayRemaining)}` })}</span>
          </div>)}
        {totaux?.reward > 0 && <div className="ws-co-summary__row ws-co-summary__row--promo"><span>{t('loyaltyUse.title')}</span><span>−{wsCurrency(totaux.reward)}</span></div>}
        {voucherDiscount > 0 && voucherApplied && (
          <div className="ws-co-summary__row ws-co-summary__row--promo">
            <span>{t('sum.code')} <strong>{voucherApplied.voucher.code}</strong></span>
            <span>−{wsCurrency(voucherDiscount)}</span>
          </div>
        )}
        {deliveryFeeResult && mode === 'delivery' && (
          <div className={`ws-co-summary__row${deliveryFee === 0 ? ' ws-co-summary__row--free' : ''}`}>
            <span>{wsText("ui.deliveryFee")} {deliveryFee === 0 && deliveryFeeResult.free_delivery_minimum > 0 && (
                <span className="ws-co-summary__row-note"> {wsText("ui.freeFrom")}{wsNumber(deliveryFeeResult.free_delivery_minimum)}</span>
              )}
            </span>
            <span>{deliveryFee === 0 ? wsText("cart.deliveryFree") : `${wsCurrency(deliveryFee)}`}</span>
          </div>
        )}
        {mode === 'delivery' && deliveryFeeErr && (
          <p className="ws-co-error" role="alert">{wsMessage(deliveryFeeErr)}</p>
        )}
        <div className="ws-co-summary__row ws-co-summary__row--total"><span>{t('sum.total')}</span><span>{wsCurrency(total)}</span></div>
      </div>

      <div className="ws-pay">
        {paymentMethods.map((p) => (
          <label key={p.id} className={`ws-pay__opt${payment === p.id ? ' is-active' : ''}`}>
            <input type="radio" name="payment" value={p.id} checked={payment === p.id} onChange={() => setPayment(p.id)}/>
            <span className="ws-pay__radio"/>
            <span className="ws-pay__copy">
              <span className="ws-pay__name">{t('payment.method.' + p.method)}</span>
              <span className="ws-pay__sub">{p.sub}</span>
            </span>
            <span className="ws-pay__logo" data-prov={p.id}/>
          </label>
        ))}
      </div>

      <p className="ws-co-step__hint">{t('co.pay.secure')}</p>
    </div>
  );
}

function ReadRow({ k, v }) {
  return (
    <div className="ws-co-readrow">
      <span className="ws-co-readrow__k">{k}</span>
      <span className="ws-co-readrow__v">{v}</span>
    </div>
  );
}

// =========================================================================
// SHOP SWITCHER MODAL
// =========================================================================
/* bug() : un échec d'API se DIT à l'écran, il ne se range pas dans la console.
   Le webshop n'avait que des console.error : dix appels échouaient en silence
   pour qui ne garde pas l'inspecteur ouvert, et une grille vide ressemblait
   exactement à une boutique sans produit. Le bandeau (webshop-bug-banner)
   l'annonce ; la console garde l'objet d'erreur complet, qui sert au débogage
   mais n'a rien à faire sous les yeux d'un client. */
function bug(source, quoi, e) {
  try { if (window.WSBug) window.WSBug.note(source, quoi + (e && e.message ? ', ' + e.message : '')); } catch (_) {}
  console.error('[' + source + '] ' + quoi, e || '');
}

function ShopSwitcher({ open, currentId, onPick, onClose, shops }) {
  const { t } = wsUseT();
  const swPanelRef = useSwipeDownToClose(onClose);
  if (!open) return null;
  const list = shops || [];
  return (
    <div className="ws-modal ws-modal--switcher" onClick={onClose}>
      <div ref={swPanelRef} className="ws-modal__panel ws-modal__panel--switcher" onClick={(e) => e.stopPropagation()}>
        <span className="ws-modal__handle" aria-hidden="true"/>
        <button className="ws-modal__close" onClick={onClose}><Pict d={ICONS.close} s={14}/></button>
        <p className="ws-modal__eyebrow">{t('shoppick.title')}</p>
        <h2 className="ws-modal__title">{tRich(t, 'shoppick.findTitle')}</h2>
        <p className="ws-modal__lede">{t('shoppick.hint')}</p>
        <div className="ws-modal__grid">
          {list.map((s) => (
            <button key={s.id} className={`ws-shopcard${s.id === currentId ? ' is-current' : ''}`} onClick={() => { onPick(s.id); onClose(); }} style={{ '--accent': s.accent }}>
              <span className="ws-shopcard__bar"/>
              <ShopPhoto shop={s}/>
              <div className="ws-shopcard__body">
              <div className="ws-shopcard__head">
                <span className="ws-shopcard__city">{s.city}</span>
                {s.id === currentId && <span className="ws-shopcard__active"><Pict d={ICONS.check} s={11}/> {t('shoppick.current')}</span>}
              </div>
              <div className="ws-shopcard__name">{s.name}</div>
              <div className="ws-shopcard__addr">{s.address}</div>
              <div className="ws-shopcard__svcs">
                <span>{t('nav.mode.collect')}</span>
                <span>·</span>
                <span>{t('shoppick.delivery')}</span>
              </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// The catalogue shop and the order shop can differ while a previous cart is
// still open. This confirmation always receives the latter, i.e. exactly the
// shop whose id is sent by CheckoutWizard to POST /webshop/orders.
function OrderingShopConfirmation({ open, shop, onConfirm, onChange }) {
  if (!open || !shop) return null;
  return (
    <div className="ws-shop-confirm" role="alertdialog" aria-modal="true" aria-label={wsShopConfirmText('shopConfirm.title')}>
      <section className="ws-shop-confirm__panel">
        <div className="ws-shop-confirm__actions">
          <button type="button" className="ws-cta" onClick={onConfirm}>{wsShopConfirmText('shopConfirm.continue', { shop: shop.name })}</button>
          <button type="button" className="ws-btn-ghost" onClick={onChange}>{wsShopConfirmText('shopConfirm.change')}</button>
        </div>
      </section>
    </div>
  );
}

// =========================================================================
// SHOP FRAME : full storefront
// =========================================================================
function ShopFrame({ variant }) {
  const { t, lang } = wsUseT();   // i18n réactif : coquille + rechargement des catégories
  // Deep-link: read URL params once at mount so admin direct links
  // (?shop=&mode=&voucher=&category=) preload the storefront state.
  const _deep = typeof parseDeepLink === 'function' ? parseDeepLink() : {};
  // Active shop: deep-link → last remembered (WSShopRouter) → default.
  const [shopId, setShopId] = useState(
    // Go-live : plus de boutique par defaut en dur - deep-link ou memoire,
    // sinon la premiere boutique reelle renvoyee par /shops (effet ci-dessous).
    _deep.shopId || (window.WSShopRouter && window.WSShopRouter.current()) || null
  );
  React.useEffect(() => {
    // Persist the active shop so cart/checkout/login stay scoped to it.
    if (window.WSShopRouter) window.WSShopRouter.setActive(shopId);
    /* LA BOUTIQUE ACTIVE S'ÉCRIT DANS L'URL. Elle n'y était pas : ?shop= était
       LU au chargement puis rangé dans la session de cet onglet, et jamais réaffiché. Trois
       conséquences, toutes constatées :
         · on ne pouvait pas savoir quelle boutique on regardait ;
         · un lien copié ne portait pas la boutique, le destinataire tombait
           sur la sienne, ou sur celle que le repli avait choisie ;
         · comparer le webshop et la console franchisé (qui, elle, affiche
           ?shop=2) demandait de deviner.
       replaceState, comme pour la catégorie juste en dessous : l'adresse suit
       l'état sans ajouter d'entrée à l'historique. */
    if (shopId == null) return;
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('shop') !== String(shopId)) {
        q.set('shop', String(shopId));
        q.delete('shopId');   // alias historique : une seule clé dans l'adresse
        window.history.replaceState(window.history.state, '',
          window.location.pathname + '?' + q.toString() + window.location.hash);
      }
    } catch (_) { /* URL non manipulable : la boutique reste en mémoire */ }
  }, [shopId]);
  const [mode, setMode] = useState(_deep.mode === 'delivery' ? 'collect' : (_deep.mode || 'collect')); // gate delivery via existing flow
  // Niveau + catégorie + sous-catégorie vivent dans l'URL (?category=&sub=),
  // pas seulement en mémoire : une page filtrée est partageable et survit au
  // rafraîchissement. Un lien direct sur une sous-catégorie ouvre la ligne
  // directement au niveau sous-catégories.
  const [cat, setCat] = useState(_deep.cat || 'home');
  const [subCat, setSubCat] = useState(_deep.sub != null ? _deep.sub : null);
  const [date, setDate] = useState(() => { const t = new Date(); t.setHours(0,0,0,0); return t; });
  const [basket, setBasket] = useState(() => {
    try {
      const saved = JSON.parse(window.WSSessionStorage?.getItem('ws.promotionBasket') || 'null');
      if (String(saved?.shopId) !== String(shopId) || !Array.isArray(saved?.basket)
          || !saved.basket.some(line => line?.promotion_group)
          || saved.basket.some(line => !line || !Array.isArray(line.options) || !Number.isFinite(Number(line.qty))
            || Number(line.qty) <= 0 || normaliseShoppingContext(line.shopping_context).mode !== 'standard')) return [];
      return saved.basket;
    } catch (_) { return []; }
  });
  React.useEffect(() => {
    // Only composition is restored. Every price and eligibility decision requires a fresh API quote.
    try {
      if (basket.some(line => line.promotion_group) && basketShoppingContext(basket).mode === 'standard') {
        window.WSSessionStorage?.setItem('ws.promotionBasket', JSON.stringify({shopId: basket[0]?.shop_id || shopId, basket}));
      } else window.WSSessionStorage?.removeItem('ws.promotionBasket');
    } catch (_) {}
  }, [basket, shopId]);
  const [browseContext, setBrowseContext] = useState(() => normaliseShoppingContext(null));
  const [officeMemberships, setOfficeMemberships] = useState([]);
  const manualMenuChoice = React.useRef(false);
  const fulfilmentMode = React.useRef(mode);
  fulfilmentMode.current = mode;
  const latestBasket = React.useRef(basket);
  latestBasket.current = basket;
  const [membershipsError, setMembershipsError] = useState(false);
  const [officeMembershipsReady, setOfficeMembershipsReady] = useState(false);
  const [officeAccessOpen, setOfficeAccessOpen] = useState(false);
  const [pendingContextLine, setPendingContextLine] = useState(null);
  const [pendingMenu, setPendingMenu] = useState(null);
  const [catalogueContextData, setCatalogueContextData] = useState(null);
  const cartContext = basketShoppingContext(basket);
  const cartShopId = basket[0]?.shop_id || shopId;
  const contextLabel = shoppingContextLabel(cartContext, t, basket[0]?.context_label);

  // The cart is priced by the API after every material change. Nothing from
  // this state is used to decide a product price in the browser.
  const [quoteResult, setQuoteState] = useState({ status: 'idle', quote: null, error: '' });
  const [detailPromotionPreview, setDetailPromotionPreview] = useState({ key: null, productId: null, suggestions: [], upcomingSuggestions: [] });
  const [detailOptionsState, setDetailOptionsState] = useState({ productId: null, menuReady: true, promotionsReady: true });
  const detailPromotionRequest = React.useRef(0);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  // Voucher state : may be pre-filled by deep link
  const [voucherInput, setVoucherInput] = useState(_deep.voucher || '');
  const [voucherApplied, setVoucherAppliedLocal] = useState(null);
  useEffect(()=>{
    const open=()=>{setLoyaltyWalletOpen(false);setRequestedAccountTab('vouchers');setAccountOpen(true);};
    window.addEventListener('ws:open-vouchers',open);
    return()=>window.removeEventListener('ws:open-vouchers',open);
  },[]);
  const [user, setUser] = useState(null);
  const loyaltyEnabled = !!user?.id && !user.isBusiness;
  const activation = useVoucherActivation(user?.id,cartShopId,value=>{
    setVoucherAppliedLocal(value?.code ? {ok:true,voucher:{code:value.code,name:value.name}} : null);
    setVoucherInput(value?.code || '');
  },error=>setNotice({titre:wsText(error.code==='VOUCHER_ACTIVATION_RESERVED'?'vouchers.activationReserved':error.code==='VOUCHER_ACTIVATION_CHANGED'?'vouchers.activationChanged':'vouchers.activationError'),texte:''}));
  const setVoucherApplied = value => {
    if(user?.id) return activation.select(value?.ok ? value.voucher.code : null).then(applied=>{
      // The server confirms selection; retain local product/portion display hints.
      if(applied&&value?.ok)setVoucherAppliedLocal(current=>current?.voucher?.code===value.voucher.code
        ? {...current,voucher:{...value.voucher,...current.voucher}} : current);
      return applied;
    });
    setVoucherAppliedLocal(value);
  };
  const voucherNotifications=useVoucherNotifications(user?.id);
  useEffect(() => {
    const clear = () => { setVoucherAppliedLocal(null); setVoucherInput(''); };
    window.addEventListener('ws:session-ended',clear);
    return () => window.removeEventListener('ws:session-ended',clear);
  }, []);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const quoteKey = JSON.stringify([cartShopId, mode, basket, date, user?.id, loyaltyEnabled, quoteRevision, voucherApplied?.ok ? voucherApplied.voucher?.code : '']);
  // Invalidate synchronously: effects run after rendering, so a previous ready
  // quote must not enable checkout for a basket which has just changed.
  const quoteState = quoteResult.status === 'ready' && quoteResult.key !== quoteKey
    ? { ...quoteResult, status: 'loading' } : quoteResult;
  const markDetailOptionReady = React.useCallback((productId, option) => {
    setDetailOptionsState((current) => Number(current.productId) === Number(productId)
      ? { ...current, [option]: true }
      : current);
  }, []);
  const previewPromotionsForDetail = React.useCallback(({ productId, quantity, id_product_portion }) => {
    const requestId = ++detailPromotionRequest.current;
    const context = normaliseShoppingContext(browseContext);
    const contextKey = JSON.stringify([shopId, mode, basket, date, context, productId, id_product_portion, user?.id]);
    const key = JSON.stringify([contextKey, quantity]);
    const empty = { key, contextKey, productId: Number(productId), suggestions: [], upcomingSuggestions: [] };
    const standardCart = basket.length === 0 || (cartContext.mode === 'standard' && Number(cartShopId) === Number(shopId));
    if (!shopId || context.mode !== 'standard' || voucherApplied?.ok || !standardCart || !window.WSQuote || typeof window.WSQuote.quote !== 'function') {
      setDetailPromotionPreview({ ...empty, status: 'ready' });
      markDetailOptionReady(productId, 'promotionsReady');
      return;
    }
    // Quantity changes keep the same cards mounted. Different products, portions
    // and shopping contexts must never reuse the preceding eligibility results.
    setDetailPromotionPreview(current => ({
      ...empty, status: 'loading',
      suggestions: current.contextKey === contextKey ? current.suggestions : [],
      upcomingSuggestions: current.contextKey === contextKey ? current.upcomingSuggestions : [],
    }));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const previewLine = {
        line: `promotion-preview-${productId}-${id_product_portion ?? 0}`,
        productId: Number(productId), qty: Number(quantity),
        id_product_portion: id_product_portion ?? null, shopping_context: context,
      };
      window.WSQuote.quote({ shopId, mode, basket: [...basket, previewLine], promotionPreviewLineKey: previewLine.line,
        shoppingContext: context, deliveryDate: date, signal: controller.signal })
        .then(quote => {
          if (requestId !== detailPromotionRequest.current) return;
          const targetPortion = id_product_portion == null ? null : Number(id_product_portion);
          const forProduct = suggestions => (Array.isArray(suggestions) ? suggestions : []).filter(suggestion => (suggestion.items || []).some(item =>
            Number(item.id_product) === Number(productId)
            && (item.id_product_portion == null ? null : Number(item.id_product_portion)) === targetPortion
          ));
          setDetailPromotionPreview({
            ...empty, status: 'ready',
            suggestions: forProduct(quote?.promotion_suggestions || quote?.bundle_suggestions),
            upcomingSuggestions: forProduct(quote?.upcoming_promotion_suggestions),
          });
          markDetailOptionReady(productId, 'promotionsReady');
        })
        .catch(() => {
          if (requestId !== detailPromotionRequest.current) return;
          setDetailPromotionPreview({ ...empty, status: 'error' });
          markDetailOptionReady(productId, 'promotionsReady');
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (requestId === detailPromotionRequest.current) ++detailPromotionRequest.current;
    };
  }, [shopId, mode, basket, date, browseContext, cartContext.mode, cartShopId, user?.id, voucherApplied?.ok, markDetailOptionReady]);
  React.useEffect(() => {
    if (!basket.length) { setQuoteState({ status: 'idle', quote: null, error: '' }); return; }
    if (!shopId || !window.WSQuote || typeof window.WSQuote.quote !== 'function') {
      setQuoteState({ status: 'error', quote: null, error: wsText("error.quote") });
      return;
    }
    const controller = new AbortController();
    setQuoteState((current) => ({ status: 'loading', quote: current.quote, error: '' }));
    const voucherCode = voucherApplied?.ok ? voucherApplied.voucher?.code : null;
    window.WSQuote.quote({ shopId: cartShopId, mode, basket, voucherCode, shoppingContext: cartContext, deliveryDate: date, includeLoyalty: loyaltyEnabled && cartContext.mode === 'standard', signal: controller.signal })
      .then((quote) => {
        if (controller.signal.aborted) return;
        const valid = !voucherCode || (quote.voucher?.valid === true && quote.voucher?.matches_cart === true);
        setQuoteState({ status: valid ? 'ready' : 'error', quote,
          error: valid ? '' : wsText('error.codeInvalid'), key: quoteKey });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setQuoteState((current) => ({ status: 'error', quote: current.quote, error: error?.message || wsText("error.quote"), key: quoteKey }));
      });
    return () => controller.abort();
  }, [cartShopId, mode, basket, date, user?.id, loyaltyEnabled, quoteRevision, voucherApplied?.ok ? voucherApplied.voucher?.code : '']);
  React.useEffect(() => {
    if (quoteResult.status !== 'ready' || !quoteResult.quote?.next_recalculation_at) return;
    const delay = Date.parse(quoteResult.quote.next_recalculation_at) - Date.parse(quoteResult.quote.server_time);
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(() => setQuoteRevision(value => value + 1), Math.max(1000, Math.min(delay, 2147483647)));
    return () => clearTimeout(timer);
  }, [quoteResult]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Refresh cutoff presentation in the shop's timezone every minute.
  const [cutoffNow, setCutoffNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setCutoffNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const [availabilitySettings, setAvailabilitySettings] = React.useState(null);
  const availabilityShopId = shopId == null ? '' : String(shopId);
  // No settings from another shop may affect this render.
  const activeSettings = availabilitySettings?.shopKey === availabilityShopId ? availabilitySettings.value : null;
  const lineNotesEnabled = false; // No backend configuration for line notes yet.
  // ── DELIVERY SLOTS (midi / soir) ────────────────────────────────────
  // The slot is an ATTRIBUTE of the order, resolved server-side from the
  // route that serves the office. Front only renders /slots + /next-slot.
  // Déclaré AVANT le slot-effect ci-dessous (qui lit `user` dans ses deps), sinon TDZ.
  const [sessionRestored, setSessionRestored] = useState(false);
  const officeHintHandled = React.useRef(false);
  const [inviteToken, setInviteToken] = useState(() => allowOfficeLinking ? new URLSearchParams(location.search).get('office_invite') : null);
  const [invitation, setInvitation] = useState(null);
  const [inviteError, setInviteError] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [inviteAuthPending, setInviteAuthPending] = useState(false);
  const inviteAttempt = React.useRef(null);
  const inviteAccountAfterJoin = React.useRef(false);
  const [authInitialTab, setAuthInitialTab] = useState('login');
  useEffect(() => {
    if (!inviteToken) return;
    let alive = true;
    window.WSOffices.invitation('resolve', inviteToken).then(data => {
      if (!alive) return;
      setInvitation(data);
      setShopId(data.shop_id);
    }).catch(() => { if (alive) setInviteError(true); });
    return () => { alive = false; };
  }, [inviteToken]);
  function closeInvitation() {
    setInviteToken(null); setInvitation(null); setInviteError(false); setInviteAuthPending(false);
    const url = new URL(location.href); url.searchParams.delete('office_invite'); history.replaceState(null, '', url);
  }
  function authenticateInvitation(tab) {
    setAuthInitialTab(tab); setInviteAuthPending(true); setAuthOpen(true);
    inviteAccountAfterJoin.current = tab === 'register';
  }
  async function acceptInvitation() {
    if (!user?.id) { authenticateInvitation('login'); return; }
    setInviteBusy(true); setInviteError(false);
    try {
      const result = await window.WSOffices.invitation('accept', inviteToken);
      setBasket([]); setVoucherApplied(null); setVoucherInput(''); setMode('collect');
      setQuoteState({status:'idle',quote:null,error:''});
      setShopId(result.shop_id); setInviteTarget(result);
      closeInvitation();
      if (inviteAccountAfterJoin.current) setAccountOpen(true);
      setNotice({titre:t('officeAccess.title'),texte:t('officeAccess.joined',{name:result.office.name})});
    } catch (_) { setInviteError(true); }
    finally { setInviteBusy(false); }
  }
  useEffect(() => {
    if (!inviteAuthPending || !user?.id || !invitation || !inviteToken) return;
    const attempt = `${inviteToken}:${user.id}`;
    if (inviteAttempt.current === attempt) return;
    inviteAttempt.current = attempt;
    acceptInvitation();
  }, [inviteAuthPending, user?.id, invitation, inviteToken]);
  useEffect(() => {
    if (!inviteTarget || Number(shopId)!==Number(inviteTarget.shop_id) || !user?.id) return;
    let alive=true;
    window.WSOffices.listMemberships(shopId).then(list=>{
      if(!alive)return;
      setOfficeMemberships(list);setMembershipsError(false);setOfficeMembershipsReady(true);
      setBrowseContext(normaliseShoppingContext(null));
      manualMenuChoice.current = true;
      setCat('home');setSubCat(null);setInviteTarget(null);
    }).catch(()=>{if(alive)setMembershipsError(true);});
    return ()=>{alive=false;};
  }, [inviteTarget,shopId,user?.id]);
  const officeHint = React.useMemo(() => { const query = new URLSearchParams(window.location.search); return allowOfficeLinking && query.get('open') === 'offices' ? (query.get('office_tax') || '') : null; }, []);
  async function refreshOfficeMemberships() {
    if (!user?.id || !shopId) { setOfficeMemberships([]); setOfficeMembershipsReady(false); return; }
    try {
      const list = await window.WSOffices.listMemberships(shopId);
      setOfficeMemberships(list); setMembershipsError(false); setOfficeMembershipsReady(true);
      if (!manualMenuChoice.current && !latestBasket.current.length) setBrowseContext(fulfilmentMode.current === 'delivery' ? defaultShoppingContext(list) : normaliseShoppingContext(null));
    } catch (_) { setMembershipsError(true); throw new Error('Office memberships unavailable.'); }
  }
  React.useEffect(() => {
    let alive = true;
    manualMenuChoice.current = false;
    setOfficeMemberships([]); setOfficeMembershipsReady(false); setBrowseContext(basket.length ? basketShoppingContext(basket) : normaliseShoppingContext(null)); setMembershipsError(false);
    if (!user?.id || !shopId) return;
    window.WSOffices.listMemberships(shopId).then(list => { if (alive) { setOfficeMemberships(list); setOfficeMembershipsReady(true); if (!manualMenuChoice.current && !latestBasket.current.length) setBrowseContext(fulfilmentMode.current === 'delivery' ? defaultShoppingContext(list) : normaliseShoppingContext(null)); } })
      .catch(() => { if (alive) setMembershipsError(true); });
    return () => { alive = false; };
  }, [user?.id, shopId]);
  function browseOfficeMenu(context) {
    manualMenuChoice.current = true;
    context = normaliseShoppingContext(context);
    if ((mode === 'collect') !== (context.mode === 'standard')) return;
    if (basket.length && !sameShoppingContext(browseContext, context)) { setPendingMenu(context); return; }
    setBrowseContext(normaliseShoppingContext(context)); setCat('home'); setSubCat(null); setDetailProduct(null);
  }
  function confirmMenuChange() {
    setBasket([]); setVoucherApplied(null); setVoucherInput('');
    setQuoteState({status:'idle',quote:null,error:''});
    if (pendingMenu.mode === 'standard') setMode('collect');
    setBrowseContext(normaliseShoppingContext(pendingMenu)); setPendingMenu(null);
    setCat('home'); setSubCat(null); setDetailProduct(null);
  }

  // Refresh verification state when returning from the activation email/tab.
  useEffect(() => {
    if (user?.activationRequired !== true) return;
    let alive = true;
    const refreshActivation = async () => {
      if (document.hidden) return;
      try {
        const updated = await window.WSAuth.me();
        if (alive && updated?.id === user.id) setUser(updated);
      } catch { /* Keep the current session during a temporary network failure. */ }
    };
    window.addEventListener('focus', refreshActivation);
    document.addEventListener('visibilitychange', refreshActivation);
    return () => {
      alive = false;
      window.removeEventListener('focus', refreshActivation);
      document.removeEventListener('visibilitychange', refreshActivation);
    };
  }, [user?.id, user?.activationRequired]);

  // Fidelity uses this storefront's CLIENT session. Old prototype links must
  // not replace it with a single token or force a reload that loses the cart.
  React.useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (!p.has('handoff')) return;
      p.delete('handoff');
      const qs = p.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
    } catch (_) {}
  }, []);
  // Restauration de la session au chargement. Le jeton était bien écrit dans
  // la session de cet onglet à la connexion et WSAuth.me() existait pour le revalider, mais
  // RIEN ne l'appelait : après le moindre rechargement, le client redevenait
  // invité, et un checkout traité en visiteur alors
  // qu'il a un compte.
  React.useEffect(() => {
    let alive = true;
    if (!window.WSAuth || typeof window.WSAuth.me !== 'function') return;
    const restore = () => Promise.resolve(window.WSAuth.me())
      .then((u) => { if (alive && u && u.id) setUser(u); })
      .catch((e) => bug('session', 'session non restaurée', e))
      .finally(() => { if (alive) setSessionRestored(true); });
    restore();
    window.addEventListener('ws:session-available', restore);
    return () => { alive = false; window.removeEventListener('ws:session-available', restore); };
  }, []);
  const [officeSlots, setOfficeSlots] = React.useState([]);
  const [slotCta, setSlotCta] = React.useState(null);
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [pendingSlot, setPendingSlot] = React.useState(null);
  // One cart = one route. Changing slot drops items unavailable on the target.
  function requestSlotChange(slotType) {
    if (slotType === selectedSlot) return;
    const target = officeSlots.find((s) => s.slot_type === slotType);
    const dropped = basket.filter((l) => Array.isArray(l.available_slots) && !l.available_slots.includes(slotType));
    if (dropped.length > 0) { setPendingSlot({ slot_type: slotType, route: target, dropped }); return; }
    setSelectedSlot(slotType);
  }
  function confirmSlotChange() {
    if (!pendingSlot) return;
    setBasket((b) => b.filter((l) => !(Array.isArray(l.available_slots) && !l.available_slots.includes(pendingSlot.slot_type))));
    setSelectedSlot(pendingSlot.slot_type);
    setPendingSlot(null);
  }
  React.useEffect(() => {
    let alive = true;
    setAvailabilitySettings(null);
    if (!availabilityShopId || !window.WSAvailability) return;
    window.WSAvailability.getShopSettings({ shopId: availabilityShopId })
      .then(value => { if (alive) setAvailabilitySettings({ shopKey: availabilityShopId, value }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [availabilityShopId]);
  const cutoffMinutes = (cutoff) => cutoff && Number.isInteger(cutoff.hour)
    ? cutoff.hour * 60 + (cutoff.minutes || 0) : null;
  const deliveryCutoffMinutes = cutoffMinutes(activeSettings?.delivery_cutoff);
  const collectCutoffMinutes = cutoffMinutes(activeSettings?.collect_cutoff);
  let nowHour = null;
  let selectedDateIsShopToday = false;
  if (activeSettings?.timezone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: activeSettings.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(cutoffNow).map(part => [part.type, part.value]));
    nowHour = Number(parts.hour) * 60 + Number(parts.minute);
    selectedDateIsShopToday = window.WSAvailability.isoOf(date) === `${parts.year}-${parts.month}-${parts.day}`;
  }
  const deliveryCutoffPassed = selectedDateIsShopToday && deliveryCutoffMinutes !== null && nowHour >= deliveryCutoffMinutes;
  const collectCutoffPassed = selectedDateIsShopToday && collectCutoffMinutes !== null && nowHour >= collectCutoffMinutes;
  // Human-readable cutoff labels for tooltips (e.g. "11h00", "16h00")
  function fmtCutoff(mins) {
    if (mins === null || mins === undefined) return '';
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h}h${m > 0 ? String(m).padStart(2,'0') : ''}`;
  }
  // A closed day, or today once its cutoff has passed, is never the starting date:
  // until the customer picks a date or fills the basket, move to the first open day.
  const datePickedByHand = React.useRef(false);
  useEffect(() => {
    const api = window.WSAvailability;
    if (datePickedByHand.current || basket.length || !shopId || !api?.listAvailableDays) return;
    const todayClosed = mode === 'delivery' ? deliveryCutoffPassed : collectCutoffPassed;
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 13);
    let alive = true;
    api.listAvailableDays({ shopId, mode, from: api.isoOf(start), to: api.isoOf(end) }).then(rows => {
      if (!alive || datePickedByHand.current) return;
      const closed = new Set((rows || []).filter(row => row.available === false).map(row => row.iso));
      for (let k = 0; k < 14; k++) {
        const d = new Date(start); d.setDate(d.getDate() + k);
        if ((k === 0 && todayClosed) || closed.has(api.isoOf(d))) continue;
        if (k > 0) setDate(d);
        return;
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [shopId, mode, date, basket.length, collectCutoffPassed, deliveryCutoffPassed]);
  const deliveryCutoffLabel = fmtCutoff(deliveryCutoffMinutes);
  const collectCutoffLabel  = fmtCutoff(collectCutoffMinutes);
  // Minimum lead days required by any item currently in basket
  const minLeadDays = useMemo(
    () => basket.reduce((m, l) => Math.max(m, l.lead_time || 0), 0),
    [basket]
  );
  const [authOpen, setAuthOpen] = useState(false);
  React.useEffect(() => {
    if (officeHint === null || officeHintHandled.current || !sessionRestored) return;
    if (user?.id) { setAuthOpen(false); setAccountOpen(false); setOfficeAccessOpen(true); officeHintHandled.current = true; }
    else setAuthOpen(true);
  }, [officeHint, user?.id, sessionRestored]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [requestedAccountTab, setRequestedAccountTab] = useState(null);
  const [pendingReceipt, setPendingReceipt] = useState(receiptIntent);
  const [requestedReceipt, setRequestedReceipt] = useState(null);
  useEffect(() => {
    if (!pendingReceipt) return;
    if (receiptIntent() === pendingReceipt) {
      history.replaceState(history.state, '', location.pathname + location.search);
    }
    if (!sessionRestored) return;
    if (!user?.id) {
      setAuthOpen(true);
      return;
    }
    setRequestedReceipt(pendingReceipt);
    setPendingReceipt(null);
    setRequestedAccountTab('transactions');
    setAuthOpen(false);
    setAccountOpen(true);
  }, [pendingReceipt, sessionRestored, user?.id]);
  const [loyaltyWalletOpen,setLoyaltyWalletOpen]=useState(false);
  const handleLoyalty = () => { if(user) setLoyaltyWalletOpen(true); else setAuthOpen(true); };
  const loyaltyIdentity=useLoyaltyIdentity(user?.id,loyaltyEnabled);
  useEffect(()=>{setLoyaltyWalletOpen(false);},[user?.id,shopId]);
  const [allergensOpen, setAllergensOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Set only by an explicit successful login/register. A restored token must
  // not repeat the confirmation after every browser refresh.
  const [shopConfirmationPending, setShopConfirmationPending] = useState(false);
  const [shopConfirmationOpen, setShopConfirmationOpen] = useState(false);
  const [pendingShopChange, setPendingShopChange] = useState(null);
  const [orderToast, setOrderToast] = useState(null);

  // Shops directory : sourced from API stub (or remote endpoint when wired).
  const [shops, setShops] = useState(() => (window.WSShops ? window.WSShops.getCacheSync() : []));
  const [shopsFailed, setShopsFailed] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    if (window.WSShops) {
      window.WSShops.list()
        .then((s) => { if (!alive) return; setShops(s || []); setShopsFailed(!s || !s.length); })
        .catch(() => { if (alive) setShopsFailed(true); });
    } else { setShopsFailed(true); }
    return () => { alive = false; };
  }, []);

  // Deep-link : normalise la réf boutique (id numérique OU slug) vers l'id
  // canonique dès que l'annuaire des boutiques est chargé, pour que tous les
  // appels API utilisent le vrai shopId.
  React.useEffect(() => {
    if (!shops || !shops.length) return;
    const m = shops.find((s) => String(s.id) === String(shopId) || s.slug === shopId);
    if (m) { if (String(m.id) !== String(shopId)) setShopId(m.id); }
    else {
      /* AUCUN REPLI. On ne choisit PAS de boutique à la place du visiteur.
         Le code prenait shops[0] : et /shops trie PAR NOM, donc ce n'était même
         pas « la boutique par défaut » mais la première par ordre alphabétique.
         Relevé en production : un visiteur sans ?shop= atterrissait sur
         « Atelier by - Halle » (id 4) pendant que la console franchisé montrait
         « Atelier by Berlo - Corbais » (id 2). Deux catalogues différents, et
         rien à l'écran pour le dire : on a cherché une heure un produit
         manquant qui n'a jamais manqué.

         Une boutique servie à la place d'une autre est une donnée fausse, pas
         un moindre mal. On rend donc la main : shopId reste nul, et l'écran
         demande de choisir. */
      if (shopId != null) console.warn('[webshop] boutique « ' + shopId +
        ' » inconnue de /shops : aucun repli : le visiteur choisit.');
      setShopId(null);
    }
  }, [shops]);

  // Products, categories and seasons are populated from a single shop response.
  const [categories, setCategories] = React.useState([]);
  const [assortments, setAssortments] = React.useState([]);

  // Delivery uses the same M:N office membership as the catalogue/profile.
  const [officeDeliveryOpen, setOfficeDeliveryOpen] = useState(false);
  const [defaultDeliveryBusy, setDefaultDeliveryBusy] = useState(false);
  const [pendingDefaultDelivery, setPendingDefaultDelivery] = useState(null);
  const defaultDeliveryRequest = React.useRef(0);
  React.useEffect(() => {
    defaultDeliveryRequest.current++;
    setDefaultDeliveryBusy(false); setPendingDefaultDelivery(null);
  }, [shopId, user?.id]);
  const [deliverySelection, setDeliverySelection] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const deliveryContext = basket.length ? basketShoppingContext(basket) : browseContext;
  const requiredDeliveryOffice = deliveryContext.mode === 'standard' ? null : deliveryContext.office_id;
  const deliverySelectionValid = deliverySelection
    && Number(deliverySelection.shopId) === Number(shopId)
    && Number(deliverySelection.clientId) === Number(user?.id)
    && (!requiredDeliveryOffice || Number(deliverySelection.office.id) === Number(requiredDeliveryOffice));
  const userOffice = deliverySelectionValid ? deliverySelection.office : null;
  const officeSites = deliverySelectionValid ? deliverySelection.sites.filter(s => s.routes.length > 0) : [];
  const selectedSite = officeSites.find(s => Number(s.id) === Number(selectedSiteId)) || null;
  const userTour = selectedSite?.routes[0] ? {...selectedSite.routes[0], window: ''} : null;
  // This iteration explicitly has free office delivery; billing remains quote-owned.
  const deliveryFeeResult = userOffice && selectedSite ? {fee_amount: 0, free_delivery: true,
    payment_type: quoteState.quote?.billing?.mode === 'company' ? 'deferred' : 'immediate', site: selectedSite} : null;
  const deliveryFeeErr = mode === 'delivery' && (!userOffice || !selectedSite) ? t('officeDelivery.chooseRequired') : '';
  useEffect(() => {
    if (!user?.id) { setDeliverySelection(null); setSelectedSiteId(null); setOfficeDeliveryOpen(false); }
  }, [user?.id, shopId]);
  async function confirmOfficeDelivery(result, siteId) {
    const selectedOfficeId = Number(result?.office?.id);
    let memberships = officeMemberships;
    if (!memberships.some(office => Number(office.id) === selectedOfficeId)) {
      try {
        memberships = await window.WSOffices.listMemberships(shopId);
        setOfficeMemberships(memberships);
      } catch (_) { /* The delivery API already confirmed this office. */ }
    }
    const membership = memberships.find(office => Number(office.id) === selectedOfficeId)
      || { id: selectedOfficeId, status: 'active', offers: [] };

    setDeliverySelection({...result, shopId, clientId: user.id});
    // Dostawa do biura zawsze odbywa się w kontekście tego biura. Katalog
    // standardowy nie może zostać zachowany ani pokazany obok jego ofert.
    manualMenuChoice.current = true;
    setBrowseContext(defaultShoppingContext([membership]));
    setCat('home'); setSubCat(null); setDetailProduct(null);
    setSelectedSiteId(siteId); setMode('delivery'); setOfficeDeliveryOpen(false); setNotice(null);
    if (basket.length) { setBasket([]); setVoucherApplied(null); setVoucherInput(''); }
  }

  // After a manual shop switch we may prompt the user to make it their preferred shop.
  const [prefNudge, setPrefNudge] = useState(null); // { shopId, shopName } | null

  const mainScrollRef = React.useRef(null);
  function updateScrollState() {
    const el = mainScrollRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight - el.clientHeight - el.scrollTop > 24;
    const canScrollUp = el.scrollTop > 24;
    el.dataset.canScroll = canScroll ? '1' : '0';
    el.dataset.canScrollUp = canScrollUp ? '1' : '0';
  }
  React.useEffect(() => {
    updateScrollState();
    const id = setTimeout(updateScrollState, 200);
    window.addEventListener('resize', updateScrollState);
    return () => { clearTimeout(id); window.removeEventListener('resize', updateScrollState); };
  });

  function handleCheckout() {
    if (!basket.length || quoteState.status !== 'ready' || !quoteState.quote?.totals) return;
    setCartDrawerOpen(false);
    analyticsEvent('begin_checkout', basket, Number(quoteState.quote.totals.gross_after_discount));
    setCheckoutOpen(true);
  }
  function handlePlaced(payload) {
    setCheckoutOpen(false);
    if (payload.paymentPending) {
      // The placed order owns its reservation; only clear this browser's display.
      setBasket([]); setVoucherAppliedLocal(null); setVoucherInput('');
      setCatalogueRefresh(value => value + 1);
      return;
    }
    // Analytics uses the saved order fetched by OrderConfirmation.
    setOrderToast({ ...payload, ts: Date.now() });
    setBasket([]);
    setCatalogueRefresh(value => value + 1); // Accepted orders may change availability.

  }

  // Deep-link peut passer un id numérique (en string) OU un slug → match souple.
  // `|| shops[0]` retiré : le meme repli, une seconde fois. Il rattrapait un
  // shopId nul en servant la premiere boutique par ordre alphabetique, donc
  // meme sans repli dans la resolution ci-dessus, l'ecran en aurait affiche une.
  const shop = shops.find((s) => String(s.id) === String(shopId) || s.slug === shopId) || null;
  // The cart is the source of truth for an order. Keep the login confirmation
  // and checkout wording tied to the shop that will receive POST /webshop/orders.
  const orderingShop = (shops || []).find((item) => Number(item.id) === Number(cartShopId)) || shop;
  React.useEffect(() => {
    if (!shopConfirmationPending || !orderingShop) return;
    setShopConfirmationPending(false);
    setShopConfirmationOpen(true);
  }, [shopConfirmationPending, orderingShop?.id]);
  // Langue de la boutique : default_lang / languages (servis par /shops) →
  // Halle ouvre en néerlandais, le sélecteur se limite aux langues offertes.
  // N'impose la langue que si le visiteur n'a pas choisi lui-même (voir applyShop).
  React.useEffect(() => {
    if (shop && window.WSI18n && window.WSI18n.applyShop) window.WSI18n.applyShop(shop);
  }, [shop && shop.id, shop && shop.default_lang, shop && shop.languages]);
  const hideOfficePeriods = mode === 'delivery' || browseContext.mode !== 'standard';
  const isAssortment = typeof cat === 'string' && cat.startsWith('season:');
  React.useEffect(() => {
    if (hideOfficePeriods && isAssortment) { setCat('home'); setSubCat(null); }
  }, [hideOfficePeriods, isAssortment]);
  const assortmentId = isAssortment ? cat.slice('season:'.length) : null;
  const assortment = assortmentId ? assortments.find((a) => a.id === assortmentId) : null;
  const [allProducts, setAllProducts] = React.useState([]);
  const [catalogueLoading, setCatalogueLoading] = React.useState(false);
  const [catalogueError, setCatalogueError] = React.useState(false);
  const [catalogueRefresh, setCatalogueRefresh] = React.useState(0);
  const loadedCatalogueKey = React.useRef(null);
  // Refresh on return without removing the currently visible same-context catalogue.
  React.useEffect(() => {
    const refresh = () => { if (!document.hidden) setCatalogueRefresh(value => value + 1); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  // Mode livraison : marque <body> pour recolorer (CSS, mobile) les boutons
  // d'action principaux du parcours en Abricot Pastel. Retiré hors livraison.
  React.useEffect(() => {
    try { document.body.classList.toggle('ws-mode-delivery', mode === 'delivery'); } catch (_) {}
    return () => { try { document.body.classList.remove('ws-mode-delivery'); } catch (_) {} };
  }, [mode]);
  React.useEffect(() => {
    let alive = true;
    const contextKey = JSON.stringify([shop?.id, mode, date, lang, user?.id, user?.officeId, browseContext]);
    const background = loadedCatalogueKey.current === contextKey;
    setCatalogueError(false);
    if (!background) { loadedCatalogueKey.current = null; setAllProducts([]); setCategories([]); setAssortments([]); setCatalogueContextData(null); }
    if (!shop || !window.WSCatalog) { loadedCatalogueKey.current = null; setCatalogueLoading(false); return; }
    setCatalogueLoading(!background);
    const load = () => window.WSCatalog.loadCatalogue({ shopId: shop.id, mode, date, shoppingContext: browseContext });
    load()
      .catch(error => {
        if (alive && error?.code === 'SESSION_CHANGED') return load();
        throw error;
      })
      .then((catalogue) => {
        if (!alive) return;
        loadedCatalogueKey.current = contextKey;
        window.WSBug?.clear?.('catalogue');
        setAllProducts(current => JSON.stringify(current) === JSON.stringify(catalogue.products) ? current : catalogue.products);
        setCatalogueContextData(catalogue);
        setCategories(catalogue.categories);
        setAssortments(catalogue.assortments);
      })
      .catch((error) => {
        if (alive) { setCatalogueError(true); console.warn('[catalogue]', error); }
      })
      .finally(() => { if (alive) setCatalogueLoading(false); });
    return () => { alive = false; };
  }, [shop?.id, mode, date, lang, user?.id, user?.officeId, catalogueRefresh, JSON.stringify(browseContext)]);
  // Source commune GRILLE + LIGNE DE NAV : le catalogue restreint au créneau
  // et à la date en cours. La règle d'affichage de la nav (« n'afficher que ce
  // qui contient au moins un produit disponible ») est ainsi exactement celle
  // de la grille : même source, jamais deux vérités.
  const slotFiltered = useMemo(() => {
    let src = allProducts;
    if (mode === 'delivery') {
      // Canal livraison bureau (« apricot ») : n'exposer QUE les produits activés
      // pour ce canal côté marque (ws_products.office_delivery). C'est un vrai
      // filtre : les produits désactivés disparaissent de la grille ET de la nav
      // (catégories/sous-catégories vides masquées). Absent/undefined = disponible
      // (rétro-compat seed). Indépendant du click & collect.
      src = src.filter((p) => p.office_delivery !== false);
      if (selectedSlot) {
        src = src.filter((p) => !Array.isArray(p.available_slots) || p.available_slots.includes(selectedSlot));
      }
    }
    return src;
  }, [allProducts, mode, selectedSlot]);

  const [productQuery, setProductQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchingProducts = /[\p{L}\p{N}]/u.test(productQuery);
  const searchResults = useMemo(() => {
    if (!searchingProducts) return [];
    const labels = new Map();
    for (const category of categories || []) {
      for (const item of [category, ...(category.subs || [])]) {
        labels.set(String(item.categoryId ?? item.id), window.WSI18n.tCategory(item.id, item.label));
      }
    }
    return searchProducts(slotFiltered, productQuery, product => labels.get(String(product.cat_id)) ?? product.cat);
  }, [slotFiltered, searchingProducts, productQuery, categories, window.WSI18n.getLang()]);

  const products = useMemo(() => {
    let src = slotFiltered;
    // Evening → surface "Plats préparés" first.
    if (mode === 'delivery' && selectedSlot === 'soir') {
      src = [...src].sort((a, b) => (a.cat === 'plats' ? -1 : 0) - (b.cat === 'plats' ? -1 : 0));
    }
    if (cat === 'all' || cat === 'home') return src;
    if (isAssortment) {
      if (hideOfficePeriods) return src;
      // Filtre par SAISON réelle (product.season = slug de la gamme ERP).
      return src.filter((p) => (p.seasons || []).includes(String(assortmentId)));
    }
    const selectedRoot = (categories || []).find((item) => String(item.id) === String(cat));
    // product_category_group is the parent level and product_category is the
    // child level. The API carries both: groupIds contains the parent groups,
    // while cat_id identifies the product category itself.
    let out = selectedRoot?.kind === 'group'
      ? src.filter((p) => (p.groupIds || []).includes(String(selectedRoot.groupId)))
      : src.filter((p) => String(p.cat_id) === String(selectedRoot?.categoryId ?? cat) || p.cat === cat);
    if (subCat != null) {
      const selectedSub = (selectedRoot?.subs || []).find((item) => String(item.id) === String(subCat));
      const categoryId = selectedSub?.categoryId ?? subCat;
      out = out.filter((p) => String(p.cat_id) === String(categoryId) || p.cat === categoryId);
    }
    return out;
  }, [cat, subCat, isAssortment, assortmentId, slotFiltered, mode, selectedSlot, categories, hideOfficePeriods]);

  // Ligne de nav : catégories/sous-catégories qui contiennent au moins un
  // produit disponible pour le créneau + la date en cours. Une sous-catégorie
  // vide ne se grise pas : elle ne s'affiche pas. Idem pour une catégorie.
  const navCats = useMemo(() => {
    const inCat = (p, c) => c.kind === 'group'
      ? (p.groupIds || []).includes(String(c.groupId))
      : String(p.cat_id) === String(c.categoryId);
    const inSub = (p, s) => String(p.cat_id) === String(s.categoryId);
    return (categories || [])
      .map((c) => ({ ...c, subs: (c.subs || []).filter((s) => slotFiltered.some((p) => inSub(p, s))) }))
      .filter((c) => slotFiltered.some((p) => inCat(p, c)));
  }, [categories, slotFiltered]);

  // Puces de saison = saisons réellement présentes dans les produits du
  // créneau (comme les catégories, on n'affiche que ce qui est disponible).
  const seasonChips = useMemo(() => {
    const seen = {};
    (slotFiltered || []).forEach((p) => {
      if (p.season && !seen[p.season]) seen[p.season] = { id: p.season, label: p.season_name || p.season, img: p.season_img || 'img/cat-all.png' };
    });
    const arr = Object.values(seen);
    return arr.length ? arr : assortments;
  }, [slotFiltered, assortments]);

  // ── Nav catégories : icônes des touches « Tout » / retour (ws_param via
  //    /config : pas de fichier en dur dans le composant), et synchro URL. ──
  const [navIcons, setNavIcons] = React.useState({ all: null, back: null });
  React.useEffect(() => {
    let alive = true;
    if (window.WSAuth && typeof window.WSAuth.config === 'function') {
      window.WSAuth.config().then((c) => {
        if (alive && c) setNavIcons({ all: c.categoryNavAllIcon || null, back: c.categoryNavBackIcon || null });
      }).catch(() => {});
    }
    return () => { alive = false; };
  }, [shopId]);

  // L'URL est la vérité partageable : category= / sub= (fusionnés dans la
  // query existante : shop, mode, voucher… restent intacts). Les BASCULES de
  // niveau créent une étape d'historique (pushState) ; les changements de
  // filtre au sein d'un niveau la remplacent (replaceState). Le « précédent »
  // du navigateur remonte donc d'un cran, comme la touche de retour, il ne
  // quitte pas la boutique tant qu'il reste des étapes.
  const syncCatUrl = React.useCallback((nextCat, nextSub, push) => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (nextCat && nextCat !== 'home') p.set('category', String(nextCat)); else p.delete('category');
      if (nextSub != null && nextSub !== '') p.set('sub', String(nextSub)); else p.delete('sub');
      const qs = p.toString();
      const url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      if (push) window.history.pushState({ wsCatNav: 1 }, '', url);
      else window.history.replaceState(window.history.state, '', url);
    } catch (_) {}
  }, []);
  // MÊME SEUIL QUE CategoryRow, obligatoirement : celui-ci décide de l'étape
  // d'historique, celui-là de l'affichage. Deux valeurs différentes et le
  // bouton Retour du navigateur ne correspond plus à ce qu'on voit.
  const catHasSubLevel = React.useCallback((cid) => {
    const c = (navCats || []).find((x) => String(x.id) === String(cid));
    return !!c && (c.subs || []).length >= 1;
  }, [navCats]);
  const selectCat = React.useCallback((cid) => {
    setCat(cid); setSubCat(null);
    // Entrer au niveau sous-catégories = étape d'historique ; une catégorie
    // sans aucune sous-catégorie peuplée filtre sans changer de niveau.
    syncCatUrl(cid, null, cid !== 'all' && catHasSubLevel(cid));
  }, [syncCatUrl, catHasSubLevel]);
  const backToCats = React.useCallback(() => {
    setCat('home'); setSubCat(null);
    syncCatUrl('home', null, true);       // sortie de niveau = étape d'historique
  }, [syncCatUrl]);
  const selectSub = React.useCallback((sid) => {
    setSubCat(sid);
    syncCatUrl(cat, sid, false);         // même niveau : pas d'étape
  }, [syncCatUrl, cat]);
  React.useEffect(() => {
    // Retour navigateur : mêmes étapes que la touche de retour, l'état suit
    // l'URL de l'étape sur laquelle on retombe.
    const onPop = () => {
      try {
        const p = new URLSearchParams(window.location.search);
        setCat(p.get('category') || 'home');
        setSubCat(p.get('sub'));
      } catch (_) {}
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  React.useEffect(() => {
    // Cohérence après un changement de créneau/date : si la catégorie ou la
    // sous-catégorie active n'a plus de produit disponible, on ne filtre pas
    // à l'aveugle : retour à un état visible. Gardé silencieux tant que les
    // données ne sont pas chargées (sinon un chargement lent « reset » l'URL).
    if (!slotFiltered.length || !(categories || []).length) return;
    if (cat === 'all' || cat === 'home' || isAssortment) return;
    const c = navCats.find((x) => String(x.id) === String(cat));
    if (!c) { setCat('home'); setSubCat(null); syncCatUrl('home', null, false); return; }
    if (subCat != null && !(c.subs || []).some((s) => String(s.id) === String(subCat))) {
      setSubCat(null); syncCatUrl(cat, null, false);
    }
  }, [navCats]); // volontairement déclenché par le seul recalcul de la nav

  const cartCount = basket.reduce((t, l) => t + l.qty, 0);
  // The basket only reads availability; the order API owns reservations.
  const [stockErr, setStockErr] = React.useState('');
  /* MOTIF DE CE QUE L'APP VIENT DE FAIRE, ou de ce qu'elle refuse. Toute
     action décidée à la place du client s'annonce ici : refus de la livraison,
     bascule automatique de mode, panier vidé, boutique changée. Une app qui
     agit sans le dire oblige à deviner, et sur un panier perdu, à recommencer. */
  const [notice, setNotice] = React.useState(null);
  function appendContextLine(line) {
    if (browseContext.mode !== 'standard' && hasUnsupportedOfficeConfiguration(line)) {
      setStockErr(t('officeAccess.configurationUnsupported')); return false;
    }
    const candidate = { ...line, shop_id: shopId, shopping_context: normaliseShoppingContext(browseContext),
      context_label: { office_name: catalogueContextData?.office?.name, offer_name: catalogueContextData?.offer?.name } };
    if (needsCartReplacement(basket, candidate.shopping_context, shopId)) { setPendingContextLine(candidate); return false; }
    setBasket(current => [...current, candidate]);
    analyticsEvent('add_to_cart', [candidate]);
    return true;
  }
  function confirmContextReplacement() {
    if (!pendingContextLine) return;
    setVoucherApplied(null); setVoucherInput(''); setBasket([pendingContextLine]); analyticsEvent('add_to_cart', [pendingContextLine]); setPendingContextLine(null);
  }
  function canAddProduct(productId, qty, portion) {
    const product = allProducts.find(item => String(item.id) === String(productId));
    if (!product || catalogueLoading) { setStockErr(wsText('stock.unavailable')); return false; }
    const available = availablePortions(product.availability, portion, Number(cartShopId) === Number(shopId) && sameShoppingContext(cartContext, browseContext) ? basketProductUnits(basket, productId) : 0);
    if (available !== null && qty > available) {
      setStockErr(wsText(product.availability.status === 'uninitialized' ? 'stock.uninitialized' : 'stock.quantityChanged'));
      return false;
    }
    setStockErr('');
    return true;
  }

  function handleAdd(p, portion) {
    if (p.has_personalization && browseContext.mode==='standard') { openProductDetail(p); return; }
    if (!canAddProduct(p.id, 1, portion)) return;
    const lineId = Date.now();
    const added = appendContextLine({
      line: lineId, productId: p.id,
      name: p.name + (portion === 'demi' ? ', 1/2' : portion === 'quart' ? ', 1/4' : ''),
      qty: 1, price: p.price, options: [],
      portion: portion || null, cat: p.cat, crossPortion: !!p.crossPortion,
      lead_time: p.lead_time || 0, no_delivery: !!p.no_delivery,
      available_slots: Array.isArray(p.available_slots) ? p.available_slots : null,
    });
  }

  // Configurable-product detail
  function handleRemove(lineIds) {
    setBasket((current) => wsRemoveBasketLines(current, lineIds));
  }
  function handleNote(lineId, note) {
    setBasket((b) => b.map((l) => (l.line === lineId ? { ...l, note } : l)));
  }
  // − / + on a basket row: the last line of the row carries the change; « + » goes
  // through the same stock check as adding from the catalogue, « − » at one unit
  // removes the line.
  function handleQty(lineIds, delta) {
    const ids = new Set(lineIds);
    const target = [...basket].reverse().find((l) => ids.has(l.line));
    if (!target) return;
    if (delta > 0) {
      if (!canAddProduct(target.productId, 1, target.portion)) return;
      setBasket((b) => b.map((l) => (l.line === target.line ? { ...l, qty: (Number(l.qty) || 1) + 1 } : l)));
    } else if ((Number(target.qty) || 1) > 1) {
      setStockErr('');
      setBasket((b) => b.map((l) => (l.line === target.line ? { ...l, qty: Number(l.qty) - 1 } : l)));
    } else handleRemove([target.line]);
  }

  const [detailProduct, setDetailProduct] = useState(null);
  // Le catalogue (grille) ne porte que le drapeau has_menu_options, pas la
  // composition. Quand on ouvre un produit déclencheur (menu), on récupère à la
  // demande son arbre formule → étapes → choix (ws_bundles) et on l'attache en
  // available_bundles pour que le composer s'affiche. Sans ça, un menu ne
  // montrait jamais ses étapes côté webshop.
  /* BOUTON RETOUR DU TÉLÉPHONE = fermer la fiche, pas quitter le site.
     Ouvrir la fiche pousse une étape d'historique (même URL) ; « back » la
     retire et le popstate ferme la fiche. La croix fait la même chose en
     passant par history.back(), pour ne pas laisser traîner une étape qui
     ferait « reculer dans le vide » au retour suivant. */
  const detailOpenRef = React.useRef(false);
  React.useEffect(() => {
    const opening = !!detailProduct && !detailOpenRef.current;
    detailOpenRef.current = !!detailProduct;
    if (opening) { try { window.history.pushState({ wsDetail: 1 }, ''); } catch (_) {} }
  }, [detailProduct]);
  React.useEffect(() => {
    const onPopDetail = () => { setDetailProduct((cur) => (cur ? null : cur)); };
    window.addEventListener('popstate', onPopDetail);
    return () => window.removeEventListener('popstate', onPopDetail);
  }, []);
  const closeProductDetail = React.useCallback(() => {
    try {
      if (window.history.state && window.history.state.wsDetail) { window.history.back(); return; }
    } catch (_) {}
    setDetailProduct(null);
  }, []);
  const menuRequest = React.useRef(0);
  const openProductDetail = React.useCallback((p) => {
    if (!p) return;
    analyticsEvent('view_item', [{ productId: p.id, qty: 1, price: p.price }]);
    const request = ++menuRequest.current;
    const menuRequired = p.has_menu_options && browseContext.mode === 'standard' && !!window.WSCatalog?.listBundles;
    const standardCart = basket.length === 0 || (cartContext.mode === 'standard' && Number(cartShopId) === Number(shopId));
    const promotionsRequired = !p.is_weighted && browseContext.mode === 'standard' && !voucherApplied?.ok
      && standardCart && !!window.WSQuote?.quote;
    const personalRequired = p.has_personalization && browseContext.mode==='standard' && !p.is_weighted;
    setDetailOptionsState({ productId: Number(p.id), menuReady: !menuRequired, promotionsReady: !promotionsRequired, personalizationReady: !personalRequired });
    setDetailProduct({...p,personalization:null});
    if (personalRequired) {
      window.WSCatalog.personalization({productId:p.id,shopId:shop?.id,date,lang,mode})
        .then(definition=>{if(request===menuRequest.current) setDetailProduct(cur=>cur?.id===p.id?{...cur,personalization:definition}:cur);})
        .catch(()=>{if(request===menuRequest.current) setDetailProduct(cur=>cur?.id===p.id?{...cur,personalization_error:true}:cur);})
        .finally(()=>{if(request===menuRequest.current) markDetailOptionReady(p.id,'personalizationReady');});
    }
    if (menuRequired) {
      window.WSCatalog.listBundles({ productId: p.id, shopId: shop?.id, date, lang, mode })
        .then(bundles => {
          if (request !== menuRequest.current) return;
          setDetailProduct(cur => cur && cur.id === p.id ? {...cur, available_bundles: Array.isArray(bundles) ? bundles : []} : cur);
          markDetailOptionReady(p.id, 'menuReady');
        })
        .catch(() => {
          if (request !== menuRequest.current) return;
          setDetailProduct(cur => cur && cur.id === p.id ? {...cur, menu_load_error:true} : cur);
          markDetailOptionReady(p.id, 'menuReady');
        });
    }
  }, [shop?.id, date, lang, mode, browseContext.mode, basket, cartContext.mode, cartShopId, shopId, voucherApplied?.ok, markDetailOptionReady]);

  function promotionAdditionLines(suggestion, createdAt, promotionGroup, promotionDisplay) {
    return (suggestion?.items || []).flatMap((item, index) => {
      // A selected offer is a full, dedicated composition. Never complete it
      // with a matching ordinary item already present in the basket.
      const quantity = Number(item.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return [];
      const product = allProducts.find(entry => Number(entry.id) === Number(item.id_product));
      const option = product ? portionOptionList(product).find(entry => (entry.id_product_portion == null ? null : Number(entry.id_product_portion)) === (item.id_product_portion == null ? null : Number(item.id_product_portion))) : null;
      const portionLabel = item.id_product_portion == null ? '1/1' : (option?.name || item.product_portion_label || item.product_portion_type);
      return [{
        line: `${createdAt}-bundle-${suggestion.id_promotion}-${index}`,
        productId: Number(item.id_product),
        id_product_portion: item.id_product_portion == null ? null : Number(item.id_product_portion),
        name: item.product_name || product?.name || `Product #${item.id_product}`,
        qty: quantity,
        price: Number(product?.price || 0),
        options: [{ label: portionLabel }],
        portion: option?.v || null,
        portion_label: portionLabel,
        cat: product?.cat || null,
        lead_time: product?.lead_time || 0,
        no_delivery: !!product?.no_delivery,
        available_slots: Array.isArray(product?.available_slots) ? product.available_slots : null,
        promotion_group: promotionGroup,
        promotion_id: Number(suggestion.id_promotion),
        promotion_display: promotionDisplay,
        shop_id: shopId,
        shopping_context: normaliseShoppingContext(browseContext),
      }];
    });
  }

  async function handleAddConfigured(line, selectedPromotion = null) {
    const product = allProducts.find((p) => p.id === line.productId);
    if (!canAddProduct(line.productId, line.qty || 1, line.portion)) return false;
    const lineId = line.line != null ? line.line : `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const candidate = {
      ...line,
      line: lineId,
      lead_time: line.lead_time ?? product?.lead_time ?? 0,
      no_delivery: line.no_delivery ?? !!product?.no_delivery,
    };
    if (selectedPromotion && (voucherApplied?.ok || browseContext.mode !== 'standard'
        || needsCartReplacement(latestBasket.current, normaliseShoppingContext(browseContext), shopId))) {
      throw new Error('error.promotionConditions');
    }
    if (selectedPromotion) {
      const promotionGroup = `promotion-${lineId}-${selectedPromotion.id_promotion}`;
      const promotionDisplay = {
        id_promotion: selectedPromotion.id_promotion,
        display_name: selectedPromotion.name,
        promotion_type: selectedPromotion.promotion_type,
        total_gross_after_discount: selectedPromotion.total_gross_after_discount,
        promotion_total_gross_after_discount: selectedPromotion.promotion_total_gross_after_discount,
        bundle_price: selectedPromotion.bundle_price,
        reward: selectedPromotion.reward,
      };
      // Keep raw product lines for the receipt, VAT and stock. The UI groups
      // them into one promotion object and the API validates the composition.
      if (selectedPromotion.is_available === false) throw new Error('error.promotionConditions');
      const snapshot = latestBasket.current;
      const nextBasket = [...snapshot, ...promotionAdditionLines(selectedPromotion, lineId, promotionGroup, promotionDisplay)];
      await window.WSQuote.quote({ shopId, mode, basket: nextBasket,
        shoppingContext: normaliseShoppingContext(browseContext), deliveryDate: date });
      if (latestBasket.current !== snapshot) throw new Error('error.quote');
      setBasket(nextBasket);
      analyticsEvent('add_to_cart', nextBasket.slice(snapshot.length));
      return true;
    }
    return appendContextLine(candidate);
  }

  /* Heure de RETRAIT du créneau choisi, décision validée : c'est elle que les
     règles de ventes croisées comparent, jamais l'heure de la commande.
     Les créneaux sont libellés « 12:00 – 12:30 » ; on en prend le début.
     Tant qu'aucun créneau n'est choisi (cas du panier, avant le paiement),
     l'heure reste inconnue et la contrainte horaire ne s'applique pas : à
     l'étape de paiement, où le créneau est choisi, elle s'applique exactement. */
  const crossSlotTime = React.useMemo(() => {
    const hit = (officeSlots || []).find((s) => s.slot_type === selectedSlot || s.id === selectedSlot);
    const m = String((hit && hit.label) || '').match(/([01]\d|2[0-3]):[0-5]\d/);
    return m ? m[0] : null;
  }, [officeSlots, selectedSlot]);

  // Cross-sell uses the same availability check as ordinary additions.
  function handleCrossAdd(it) {
    const p = allProducts.find((x) => String(x.id) === String(it.productId));
    handleAddConfigured({
      productId: it.productId,
      name: p ? p.name : it.name,
      qty: 1,
      price: Number(it.price) || (p ? p.price : 0),
      options: [],
      portion: null,
      cat: p ? p.cat : null,
      basePrice: p ? p.price : Number(it.price) || 0,
    });
  }

  const Nav = variant === 'A' ? NavbarA : variant === 'B' ? NavbarB : NavbarC;

  async function handleMode(next) {
    if (next === 'delivery') {
      if (!user) { setAuthOpen(true); return; }
      if (defaultDeliveryBusy) return;
      if (mode === 'delivery') { setOfficeDeliveryOpen(true); return; }
      const request = ++defaultDeliveryRequest.current;
      setDefaultDeliveryBusy(true);
      try {
        const saved = await window.WSOffices.deliveryPreference(shopId);
        if (request !== defaultDeliveryRequest.current) return;
        if (!saved?.officeId || !saved?.siteId) { setOfficeDeliveryOpen(true); return; }
        const result = await window.WSOffices.delivery({shop:shopId,officeId:saved.officeId});
        if (request !== defaultDeliveryRequest.current) return;
        const site = result.sites?.find(site=>Number(site.id)===Number(saved.siteId) && site.routes?.length>0);
        if (!site || result.office?.status !== 'active') { setOfficeDeliveryOpen(true); return; }
        if (latestBasket.current.length) setPendingDefaultDelivery({result,siteId:site.id});
        else await confirmOfficeDelivery(result,site.id);
      } catch (_) { if (request === defaultDeliveryRequest.current) setOfficeDeliveryOpen(true); }
      finally { if (request === defaultDeliveryRequest.current) setDefaultDeliveryBusy(false); }
      return;
    }
    defaultDeliveryRequest.current++;
    setDefaultDeliveryBusy(false); setPendingDefaultDelivery(null);
    if (next === mode) return;
    if (basket.length) { setPendingMenu(normaliseShoppingContext(null)); return; }
    manualMenuChoice.current = true;
    setMode('collect'); setBrowseContext(normaliseShoppingContext(null));
    setCat('home'); setSubCat(null); setDetailProduct(null);
    setVoucherApplied(null); setVoucherInput('');
    setQuoteState({status:'idle',quote:null,error:''});
    setNotice(null);
  }
  function handleDate(next) {
    datePickedByHand.current = true;
    const a = date instanceof Date ? date.toDateString() : String(date);
    const b = next instanceof Date ? next.toDateString() : String(next);
    if (a === b) return;
    const avait = basket.length > 0;
    setDate(next);
    setBasket([]);
    if (avait) {
      // Règle du design : changer de date vide le panier. Encore faut-il le dire.
      setNotice({
        titre: wsText("ui.basketCleared"),
        texte: wsText("ui.dateClearsBasket"),
      });
    }
  }
  function handleAccount() {
    if (user) setAccountOpen(true);
    else setAuthOpen(true);
  }
  function applyShopChange(id) {
    if (!id || String(id) === String(shopId)) return;
    setShopId(id);
    // A manual change may be saved as the preferred shop, but must never be
    // made silently just because the customer has logged in.
    if (user && String(user.preferredShopId || '') !== String(id)) {
      const picked = shops.find((s) => String(s.id) === String(id));
      setPrefNudge({ shopId: id, shopName: picked ? picked.name : id });
    }
  }
  function requestShopChange(id) {
    if (!id || String(id) === String(shopId)) return;
    // A basket cannot be priced or fulfilled across shops. Make its removal
    // explicit instead of carrying a hidden old-shop order into the new view.
    if (basket.length && String(cartShopId) !== String(id)) {
      setPendingShopChange(id);
      return;
    }
    applyShopChange(id);
  }
  function handleLogin(u) {
    setUser(u);
    // Use the preferred shop only as a first-shop default. An explicit deep
    // link, a selected shop or an existing basket must remain authoritative.
    if (!inviteToken && officeHint === null && u && u.preferredShopId && shopId == null) {
      setShopId(u.preferredShopId);
    }
    if (!inviteToken && officeHint === null && !pendingReceipt) setShopConfirmationPending(true);
    // If freshly logged-in user already has delivery enabled & was on collect, leave mode alone (don't surprise the user).
  }
  function handleLogout() {
    if (window.WSAuth?.logout) window.WSAuth.logout();
    else clearAccountContext();
  }
  function clearAccountContext() {
    setUser(null); setPendingContextLine(null); setOfficeAccessOpen(false);
    setAccountOpen(false); setRequestedReceipt(null); setCheckoutOpen(false);
    setQuoteState({status:'idle',quote:null,error:''});
    setBrowseContext(normaliseShoppingContext(null)); setPendingMenu(null);
    // La livraison au bureau exige un compte : à la déconnexion, le mode revient
    // à Click & Collect et le panier tombe. Perdre un panier sans un mot oblige
    // à tout refaire sans comprendre.
    if (mode === 'delivery' || cartContext.mode !== 'standard') {
      const avait = basket.length > 0;
      setMode('collect');
      setBasket([]);
      setNotice({
        titre: wsText("ui.returnCollect"),
        texte: wsText(avait ? 'ui.logoutBasket' : 'ui.deliveryNeedsOffice'),
      });
    }
  }

  // Revocation and local expiry must clear an already mounted account as well
  // as storage. This also unmounts account-scoped Fidelity views on switching.
  React.useEffect(() => {
    window.addEventListener('ws:session-ended', clearAccountContext);
    return () => window.removeEventListener('ws:session-ended', clearAccountContext);
  }, [mode, cartContext.mode, basket.length]);

  const loginDialog = <LoginModal open={authOpen} initialTab={authInitialTab}
    invitationRegistration={!!inviteToken && inviteAuthPending}
    onClose={() => { setAuthOpen(false); setAuthInitialTab('login'); }}
    onLogin={handleLogin} onRegister={handleLogin}
    onGoToAccount={u => { handleLogin(u); if (inviteToken) inviteAccountAfterJoin.current = true; else setAccountOpen(true); }}
    shopId={shopId}/>;
  const accountProps = {
    open: accountOpen, user, shops, currentShopId: shopId,
    requestedTab: requestedAccountTab, requestedReceipt,
    onReceiptHandled: () => setRequestedReceipt(null),
    onClose: () => { setAccountOpen(false); setRequestedAccountTab(null);  setRequestedReceipt(null); },
    onChangePreferredShop: requestShopChange, onLogout: handleLogout, onUpdateUser: setUser,
    office: userOffice, tour: userTour,
  };

  // Go-live : sans boutique resolue (API /shops en echec ou vide), on affiche
  const invitationDialog = inviteToken && !authOpen && <div className="ws-office-overlay"><section className="ws-office-modal" role="dialog" aria-modal="true" aria-labelledby="ws-invitation-title">
    <h2 id="ws-invitation-title">{t('officeAccess.invitationTitle')}</h2>
    {inviteError ? <p role="alert">{t('officeAccess.invitationError')}</p> : <p>{invitation ? t('officeAccess.invitationDescription', {name: invitation.office.name}) : t('common.loading2')}</p>}
    {invitation && basket.length>0 && <p>{t('officeAccess.menuChange')}</p>}
    <div className="ws-office-confirm-actions"><button type="button" className="ws-office-secondary" disabled={inviteBusy} onClick={closeInvitation}>{t('common.close2')}</button>
    {invitation && <button type="button" className="ws-cta" disabled={inviteBusy} onClick={acceptInvitation}>{inviteBusy ? t('common.loading2') : t(user?.id?'officeAccess.invitationAccept':'co.auth.signin')}</button>}
    {invitation && !user?.id && <button type="button" className="ws-office-secondary" onClick={() => authenticateInvitation('register')}>{t('officeAccess.registerAndJoin')}</button>}</div>
  </section></div>;

  // Go-live : sans boutique resolue (API /shops en echec ou vide), on affiche
  // un etat explicite - jamais de boutique de demonstration.
  /* TROIS ÉTATS SANS BOUTIQUE, ET ILS NE SE CONFONDENT PAS. L'écran n'en
     connaissait que deux : « chargement » et « API injoignable », parce que le
     troisième n'existait pas : un repli choisissait une boutique en silence.
     Sans repli, il faut le dire et laisser choisir, sinon le visiteur attend un
     chargement qui ne viendra jamais. */
  if (!shop) {
    const aChoisir = !shopsFailed && shops && shops.length > 0;
    return (<>{invitationDialog}
      <div className={`ws ws--${variant} ws-shopselect`}>
        <div className="ws-shopselect__wash" aria-hidden="true"/>
        <header className="ws-shopselect__header">
          <div className="ws-shopselect__brand" aria-label="L'Atelier By">
            <img className="ws-shopselect__logo" src={import.meta.env.BASE_URL + 'logo.png'} alt="L'Atelier By"/>
          </div>
          {window.LangChip && <window.LangChip className="ws-shopselect__language"/>}
        </header>
        <main className="ws-shopselect__main" aria-live="polite">
          <div className="ws-shopselect__intro">
            <span className="ws-shopselect__kicker">{wsText('shoppick.title')}</span>
            <h1>{shopsFailed ? wsText("ui.shopsUnavailable")
                              : (aChoisir ? wsText("ui.pickShop") : wsText("ui.loadingShop"))}</h1>
            <p>{shopsFailed
              ? wsText("ui.shopsError")
              : (aChoisir ? wsText("ui.pickShopHint") : wsText("ui.connecting"))}</p>
          </div>
          {aChoisir ? (
            <div className="ws-shopselect__grid" role="list">
              {shops.map((s) => (
                <button key={s.id} type="button" className="ws-shopselect__card" role="listitem"
                        onClick={() => setShopId(s.id)} style={{ '--shop-accent': s.accent || 'var(--color-primary)' }}>
                  <span className="ws-shopselect__cardbar" aria-hidden="true"/>
                  <ShopPhoto shop={s}/>
                  <span className="ws-shopselect__cardcopy">
                    {s.city && <span className="ws-shopselect__city">{s.city}</span>}
                    <strong>{s.name}</strong>
                    {s.address && <span className="ws-shopselect__address">{s.address}</span>}
                  </span>
                  <span className="ws-shopselect__choose" aria-hidden="true">
                    <Pict d={ICONS.chev} s={16}/>
                  </span>
                </button>
              ))}
            </div>
          ) : !shopsFailed && (
            <div className="ws-shopselect__loading">
              <span className="ws-shopselect__spinner" aria-hidden="true"/>
              <span>{wsText("ui.connecting")}</span>
            </div>
          )}
          {shopsFailed && <p className="ws-shopselect__help">{wsText("ui.connecting")}</p>}
          {/* A shop is already chosen (link or memory) and the list is still loading:
              this screen is only a moment, so the cookie banner waits for the shop
              instead of mounting here and again a second later. */}
          {!(shopId && !shops.length && !shopsFailed) && <CookieConsent />}
        </main>
        <footer className="ws-shopselect__footer">© {new Date().getFullYear()} L'Atelier By</footer>
        {loginDialog}
        <AccountModal {...accountProps}/>
      </div><PwaInstallPrompt /></>
    );
  }

  // PRIX MASQUÉS (0113) : le bureau du client l'impose ; le prix reste résolu
  // et facturé serveur, seul l'affichage disparaît (classe sur la racine).
  const cartShop = (shops || []).find(item => Number(item.id) === Number(cartShopId)) || shop;
  const hidePrices = false; // Office membership never silently changes the standard catalogue.
  const activeVoucher = voucherApplied?.ok ? voucherApplied.voucher : null;
  const handleUseVoucher = (code,name,targets) => {
    if(activeVoucher)return;
    setVoucherApplied({ok:true,voucher:{code,name,targets}});
  };
  const clearActiveVoucher = () => {setVoucherApplied(null);setVoucherInput('');};
  const browseVoucherTarget = target => {
    const product=target.kind==='product'?allProducts.find(item=>Number(item.id)===Number(target.id)):null;
    const categoryId=target.kind==='category'?target.id:product?.cat_id;
    const root=navCats.find(item=>Number(item.categoryId)===Number(categoryId)||(item.subs||[]).some(sub=>Number(sub.categoryId)===Number(categoryId)));
    if(browseContext.mode!=='standard'||(target.kind==='product'&&!product)||(target.kind==='category'&&!root)) {
      setNotice({titre:wsText('vouchers.unavailableProduct'),texte:''});return;
    }
    setLoyaltyWalletOpen(false);setAccountOpen(false);setRequestedAccountTab(null);
    const sub=(root?.subs||[]).find(item=>Number(item.categoryId)===Number(categoryId));
    setCat(root?.id||'all');setSubCat(sub?.id||null);syncCatUrl(root?.id||'all',sub?.id||null,true);
    if(product)openProductDetail(product);
  };
  const hasOfficeMembership = officeMemberships.length > 0;
  const menuOffices = mode === 'delivery' && userOffice
    ? officeMemberships.filter(office => Number(office.id) === Number(userOffice.id))
    : [];
  const officeMenus = user ? (<div className="ws-office-menus" aria-label={t('officeAccess.title')}>
              <div className="ws-office-menu-links">
              {menuOffices.map(office => <React.Fragment key={office.id}>
                <button type="button" className="ws-office-catalog-button" aria-label={t('officeAccess.catalogue', { name: office.name })} title={office.name} aria-pressed={browseContext.mode === 'office_catalog' && Number(browseContext.office_id) === Number(office.id)} onClick={() => browseOfficeMenu({ mode: 'office_catalog', office_id: office.id })}>
                  <OfficeIdentity office={office} compact/>
                </button>
                {(office.offers || []).map(offer => <button type="button" key={offer.id} aria-pressed={browseContext.mode === 'office_offer' && Number(browseContext.offer_id) === Number(offer.id)} onClick={() => browseOfficeMenu({ mode: 'office_offer', office_id: office.id, offer_id: offer.id })}>{t('officeAccess.offer', { name: offer.name })}</button>)}
              </React.Fragment>)}
              </div>{allowOfficeLinking && <button type="button" className="ws-office-manage" onClick={() => setOfficeAccessOpen(true)}><img className={hasOfficeMembership ? 'is-linked' : undefined} src={hasOfficeMembership ? linkedOfficeIcon : noLinkedOfficeIcon} alt="" aria-hidden="true"/><span>{t('officeAccess.manage')}</span></button>}
            </div>) : null;
  return (
    <div className={`ws ws--${variant}${hidePrices ? ' ws-noprice' : ''}`} data-mode={mode}>
      {invitationDialog}
      <Nav productSearch={<ProductSearchField query={productQuery} onChange={setProductQuery} disabled={accountOpen}/>}
           searchToggle={<button type="button" className="ws-nav__icon ws-product-search-toggle"
             aria-label={t('productSearch.label')} aria-expanded={mobileSearchOpen}
             onClick={() => {
               if (mobileSearchOpen) setProductQuery('');
               setMobileSearchOpen(!mobileSearchOpen);
             }}><Pict d={ICONS.search} s={20}/></button>}
           officeMenus={officeMenus} shop={shop} mode={mode} onMode={handleMode} onSwitchShop={() => setSwitcherOpen(true)}
           cartCount={cartCount} date={date} onDate={handleDate} user={user} onAccount={handleAccount}
           loyaltyEnabled={loyaltyEnabled} onLoyalty={handleLoyalty} activeVoucher={!!activeVoucher} newVouchers={voucherNotifications.hasUnread}
           onAllergens={() => setAllergensOpen(true)}
           collectCutoffPassed={collectCutoffPassed} collectCutoffLabel={collectCutoffLabel}
           deliveryCutoffPassed={deliveryCutoffPassed} deliveryCutoffLabel={deliveryCutoffLabel}
           minLeadDays={minLeadDays}/>
      {variant !== 'A' && officeMenus}
      {user?.activationRequired === true && <aside className="ws-activation-banner" role="status">
        <span>{t('activation.accountWarning')}</span>
        <button type="button" className="ws-linkbtn" onClick={handleAccount}>{t('activation.accountSettings')}</button>
      </aside>}


      <div className="ws-body">
        <main className="ws-main" ref={mainScrollRef} onScroll={updateScrollState}>
          {variant === 'C' && (
            <div className="ws-hero" style={{ '--shop-accent': shop.accent }}>
              <div className="ws-hero__copy">
                <span className="ws-hero__eyebrow">{t('hero.eyebrow')}</span>
                <h1 className="ws-hero__slogan">{wsText("ui.sloganTake")}<br/>{wsText("ui.sloganShare")}<br/><em style={{ color: 'var(--color-primary)' }}>{wsText("ui.sloganTaste")}</em></h1>
                <p className="ws-hero__lede">{t('hero.lede')}</p>
              </div>
              <div className="ws-hero__chip" style={{ background: 'var(--color-primary)' }}>
                <span>{shop.name}</span>
                <span className="ws-hero__chip-sub">{shop.city}</span>
              </div>
            </div>
          )}

          {user && <>
            {membershipsError && <p role="alert" className="ws-co-error">{t('officeAccess.loadError')} <button type="button" onClick={() => refreshOfficeMemberships().catch(() => {})}>{t('officeAccess.search')}</button></p>}
            {browseContext.mode === 'office_offer' && <p className="ws-office-context">{t('officeAccess.offerPriceNote')}</p>}
          </>}




          {mode === 'delivery' && officeSlots.length >= 2 && (
            <SlotSegmented slots={officeSlots} selected={selectedSlot} onSelect={(t) => requestSlotChange(t)}/>
          )}
          {mode === 'delivery' && officeSlots.length === 1 && officeSlots[0].slot_type === 'midi' && (
            <p className="ws-slot-ask">{t('evening.q')} <button type="button" className="ws-linkbtn" onClick={() => window.WSSlots && window.WSSlots.requestEvening && window.WSSlots.requestEvening({ officeId: (user && user.officeId) || null })}>{t('evening.tellUs')}</button></p>
          )}

          {mobileSearchOpen && <ProductSearchField mobile query={productQuery} onChange={setProductQuery} disabled={accountOpen}/>}
          <CategoryRow active={cat} sub={subCat} onSelect={selectCat} onSelectSub={selectSub} onBack={backToCats} navIcons={navIcons} accent={mode === 'delivery' ? '#c17a2a' : 'var(--color-primary)'} tint={mode === 'delivery' ? 'invert(45%) sepia(60%) saturate(600%) hue-rotate(5deg)' : 'invert(15%) sepia(85%) saturate(2400%) hue-rotate(335deg)'} categories={navCats} assortments={hideOfficePeriods ? [] : seasonChips}/>

          {catalogueError && <div className="ws-catalogue-loading" role="alert">
            <span>{t('serviceProblem.message')}</span>
            <button type="button" className="ws-linkbtn" onClick={() => setCatalogueRefresh(value => value + 1)}>{t('stock.refresh')}</button>
          </div>}
          {!catalogueLoading && allProducts.some(product => stockMessageKey(product.availability)) &&
            <div className="pdm-delivery-notice" role="status">{t('stock.unavailable')}</div>}
          {catalogueLoading && (
            <div className="ws-catalogue-loading" role="status" aria-live="polite">
              <span className="ws-catalogue-loading__spinner" aria-hidden="true" />
              <span>{t('common.loading2')}</span>
            </div>
          )}
          {searchingProducts && !catalogueLoading && <p className="ws-product-search-empty" role="status">
            {searchResults.length ? t('productSearch.results', { count: searchResults.length }) : t('productSearch.empty')}
          </p>}
          <div className="ws-grid" aria-busy={catalogueLoading}>
            {cat === 'home' && !searchingProducts ? navCats.map((category, index) => (
              <button key={category.id} type="button" className="ws-card ws-category-card"
                onClick={() => selectCat(category.id)}>
                <span className="ws-card__photo">
                  {category.img && <img className="ws-category-card__image" src={category.img} alt=""
                    loading={index < 4 ? 'eager' : 'lazy'} decoding="async" onError={event => { event.currentTarget.hidden = true; }}/>}
                </span>
                <span className="ws-card__body"><span className="ws-card__name">{window.WSI18n.tCategory(category.id, category.label)}</span></span>
              </button>
            )) : (searchingProducts ? searchResults : products).map((p, index) => {
              const bqty = Number(cartShopId) === Number(shopId) && sameShoppingContext(cartContext, browseContext) ? basketProductUnits(basket, p.id) : 0;
              const stock = p.availability;
              return <ProductCard key={p.id} p={p} imagePriority={index < 4} onAdd={handleAdd} onOpen={openProductDetail} mode={mode} basketQty={bqty} stock={stock} platsBadge={mode === 'delivery' && selectedSlot === 'soir' && p.cat === 'plats'}/>;
            })}
          </div>
          <CookieConsent />
        </main>

        <button
          type="button"
          className="ws-scrollcue ws-scrollcue--up"
          aria-label={t('scroll.upAria')}
          onClick={() => {
            const main = document.querySelector('.ws-main');
            if (!main) return;
            main.scrollBy({ top: -main.clientHeight * 0.85, behavior: 'smooth' });
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6"/></svg>
        </button>
        <button
          type="button"
          className="ws-scrollcue ws-scrollcue--down"
          aria-label={t('scroll.downAria')}
          onClick={() => {
            const main = document.querySelector('.ws-main');
            if (!main) return;
            const atBottom = main.scrollTop + main.clientHeight >= main.scrollHeight - 24;
            main.scrollBy({ top: atBottom ? -main.scrollHeight : main.clientHeight * 0.85, behavior: 'smooth' });
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>

        <Basket hidePrices={hidePrices} contextLabel={basket.length ? contextLabel : null} officeName={userOffice?.name || ''} shop={cartShop} mode={mode} basket={basket} quoteState={quoteState} onCheckout={handleCheckout} onRemove={handleRemove} onQty={handleQty} onNote={handleNote} notesEnabled={lineNotesEnabled} deliveryFeeResult={deliveryFeeResult} date={date} slotTime={crossSlotTime} onCrossAdd={Number(cartShopId) === Number(shopId) && cartContext.mode === 'standard' && browseContext.mode === 'standard' ? handleCrossAdd : undefined}/>
      </div>

      {/* Mobile navigation with direct access to the customer loyalty QR. */}
      <nav className={`ws-tabbar${loyaltyEnabled ? ' ws-tabbar--loyalty' : ''}`} aria-label={t('nav.navAria')}>
        <button className="ws-tabbar__btn ws-tabbar__btn--cart" onClick={() => setCartDrawerOpen(true)} aria-label={t('nav.cart')}>
          <span className="ws-tabbar__cart-wrap">
            <Pict d={ICONS.bag} s={20}/>
            {cartCount > 0 && <span className="ws-tabbar__badge">{cartCount}</span>}
          </span>
          <span className="ws-tabbar__label">{t('nav.cart')}</span>
        </button>
        {loyaltyEnabled && <button className="ws-tabbar__btn ws-tabbar__btn--loyalty" aria-label={t('loyaltyWallet.open')} aria-haspopup="dialog" onClick={handleLoyalty}>
          <LoyaltyCardIcon active={!!activeVoucher} updated={voucherNotifications.hasUnread}/>
        </button>}
        <button className="ws-tabbar__btn ws-tabbar__btn--account" onClick={handleAccount} aria-label={user ? t('nav.profile') : t('nav.signin')}>
          <Pict d={ICONS.user} s={20}/>
          <span className="ws-tabbar__label">{user ? t('nav.profile') : t('nav.signin')}</span>
        </button>
      </nav>

      {/* Slot change confirmation : one cart = one route + one date */}
      {pendingSlot && (
        <SlotChangeModal
          items={pendingSlot.dropped}
          targetLabel={(pendingSlot.route && pendingSlot.route.cta && window.WSI18n.translateKnown(pendingSlot.route.cta.label)) || (pendingSlot.slot_type === 'soir' ? wsText("ui.evening") : wsText("ui.noon"))}
          onConfirm={confirmSlotChange}
          onCancel={() => setPendingSlot(null)}
        />
      )}

      {/* Mobile cart drop-up drawer */}
      {cartDrawerOpen && (
        <div className="ws-drawer is-open" onClick={(e) => { if (e.target === e.currentTarget) setCartDrawerOpen(false); }}>
          <div className="ws-drawer__panel">
            <button className="ws-drawer__close" onClick={() => setCartDrawerOpen(false)} aria-label={t('common.close2')}>×</button>
            <div className="ws-drawer__handle" aria-hidden="true"/>
            <Basket hidePrices={hidePrices} contextLabel={basket.length ? contextLabel : null} officeName={userOffice?.name || ''} shop={cartShop} mode={mode} basket={basket} quoteState={quoteState} onCheckout={handleCheckout} onRemove={handleRemove} onQty={handleQty} onNote={handleNote} notesEnabled={lineNotesEnabled} date={date} slotTime={crossSlotTime} onCrossAdd={Number(cartShopId) === Number(shopId) && cartContext.mode === 'standard' && browseContext.mode === 'standard' ? handleCrossAdd : undefined}/>
          </div>
        </div>
      )}

      <ShopSwitcher
        open={switcherOpen}
        currentId={shopId}
        shops={shops}
        onPick={requestShopChange}
        onClose={() => setSwitcherOpen(false)}
      />
      {loginDialog}
      {/* Rattrapage CP : s'affiche seule après toute connexion (login, handoff
          PWA, session restaurée) tant que le code postal manque en base. */}
      <PostcodeCatchupModal user={accountOpen && requestedAccountTab === 'transactions' ? null : user} onUpdateUser={(u) => setUser(u)}/>
      <StripeReturnDialog />
      {loyaltyWalletOpen && user && loyaltyEnabled && <LoyaltyWallet key={`${user.id}:${shopId}`} identity={loyaltyIdentity} user={user} shopId={shopId} onUseVoucher={handleUseVoucher} activeVoucherCode={activeVoucher?.code} onClearVoucher={clearActiveVoucher} onVouchersViewed={voucherNotifications.markViewed} onBrowseVoucher={browseVoucherTarget} onClose={()=>setLoyaltyWalletOpen(false)}/>}
      <AccountModal {...accountProps}
        onRequestOffice={allowOfficeLinking ? () => setOfficeAccessOpen(true) : undefined}
        onManageOffices={allowOfficeLinking ? () => { setAccountOpen(false); setOfficeAccessOpen(true); } : undefined}
        onUseVoucher={handleUseVoucher}
        activeVoucherCode={activeVoucher?.code}
        onClearVoucher={clearActiveVoucher}
        onVouchersViewed={voucherNotifications.markViewed}
        onBrowseVoucher={browseVoucherTarget}
      />
      {officeDeliveryOpen && !!user && <OfficeDeliveryModal open={true} shopId={shopId} officeId={basket.length ? requiredDeliveryOffice : null}
        selectedOfficeId={userOffice?.id} selectedSiteId={userOffice ? selectedSiteId : null} clearBasket={basket.length > 0}
        onClose={() => setOfficeDeliveryOpen(false)} onConfirm={confirmOfficeDelivery}
        onManageOffices={allowOfficeLinking ? () => { setOfficeDeliveryOpen(false); setOfficeAccessOpen(true); } : undefined}/>}
      {defaultDeliveryBusy && <div className="ws-toast" role="status">{t('common.loading2')}</div>}
      {pendingDefaultDelivery && <div className="ws-office-overlay"><section className="ws-office-modal" role="alertdialog" aria-modal="true" aria-labelledby="ws-default-delivery-title">
        <h2 id="ws-default-delivery-title">{t('officeAccess.replaceTitle')}</h2><p>{t('officeAccess.menuChange')}</p>
        <div className="ws-office-confirm-actions"><button type="button" className="ws-office-secondary" onClick={()=>setPendingDefaultDelivery(null)}>{t('officeAccess.cancel')}</button><button type="button" className="ws-cta" onClick={()=>{const pending=pendingDefaultDelivery;setPendingDefaultDelivery(null);confirmOfficeDelivery(pending.result,pending.siteId);}}>{t('officeAccess.menuConfirm')}</button></div>
      </section></div>}
      <OfficeMembershipModal open={allowOfficeLinking && officeAccessOpen && !!user} shopId={shopId} initialTax={officeHint || ''} offices={officeMemberships} onClose={() => setOfficeAccessOpen(false)} onChanged={refreshOfficeMemberships}/>
      {pendingMenu && <div className="ws-office-overlay"><section className="ws-office-modal" role="alertdialog" aria-modal="true" aria-labelledby="ws-menu-title">
        <h2 id="ws-menu-title">{t('officeAccess.replaceTitle')}</h2><p>{t('officeAccess.menuChange')}</p>
        <div className="ws-office-confirm-actions"><button type="button" className="ws-office-secondary" onClick={() => setPendingMenu(null)}>{t('officeAccess.cancel')}</button><button type="button" className="ws-cta" onClick={confirmMenuChange}>{t('officeAccess.menuConfirm')}</button></div>
      </section></div>}
      {pendingContextLine && <div className="ws-office-overlay"><section className="ws-office-modal" role="alertdialog" aria-modal="true" aria-labelledby="ws-context-title" aria-describedby="ws-context-body">
        <h2 id="ws-context-title">{t('officeAccess.replaceTitle')}</h2><p id="ws-context-body">{t('officeAccess.replaceBody')}</p>
        <div className="ws-office-confirm-actions"><button type="button" className="ws-office-secondary" onClick={() => setPendingContextLine(null)}>{t('officeAccess.cancel')}</button><button type="button" className="ws-cta" onClick={confirmContextReplacement}>{t('officeAccess.replaceConfirm')}</button></div>
      </section></div>}
      <OrderingShopConfirmation
        open={shopConfirmationOpen}
        shop={orderingShop}
        onConfirm={() => setShopConfirmationOpen(false)}
        onChange={() => { setShopConfirmationOpen(false); setSwitcherOpen(true); }}
      />
      {pendingShopChange && <div className="ws-office-overlay"><section className="ws-office-modal" role="alertdialog" aria-modal="true" aria-labelledby="ws-shop-change-title">
        <h2 id="ws-shop-change-title">{wsShopConfirmText('shopConfirm.clearBasketTitle')}</h2>
        <p>{wsShopConfirmText('shopConfirm.clearBasketBody')}</p>
        <div className="ws-office-confirm-actions">
          <button type="button" className="ws-office-secondary" onClick={() => setPendingShopChange(null)}>{t('officeAccess.cancel')}</button>
          <button type="button" className="ws-cta" onClick={() => {
            const nextShopId = pendingShopChange;
            setPendingShopChange(null);
            setBasket([]); setVoucherApplied(null); setVoucherInput('');
            setMode('collect'); setBrowseContext(normaliseShoppingContext(null));
            setQuoteState({ status: 'idle', quote: null, error: '' });
            applyShopChange(nextShopId);
          }}>{wsShopConfirmText('shopConfirm.clearBasketConfirm')}</button>
        </div>
      </section></div>}
      <ProductDetail open={!!detailProduct} product={detailProduct} mode={mode} activeVoucher={browseContext.mode==='standard'?activeVoucher:null} onClose={closeProductDetail} onAdd={handleAddConfigured}
        onPromotionPreview={previewPromotionsForDetail} promotionSuggestions={Number(detailPromotionPreview.productId) === Number(detailProduct?.id) ? detailPromotionPreview.suggestions : []}
        upcomingPromotionSuggestions={Number(detailPromotionPreview.productId) === Number(detailProduct?.id) ? detailPromotionPreview.upcomingSuggestions : []}
        promotionProducts={allProducts}
        promotionPreviewPending={Number(detailPromotionPreview.productId) === Number(detailProduct?.id) && detailPromotionPreview.status === 'loading'}
        optionsLoading={Number(detailOptionsState.productId) === Number(detailProduct?.id) && (!detailOptionsState.menuReady || !detailOptionsState.promotionsReady || detailOptionsState.personalizationReady===false)}
        stock={detailProduct ? allProducts.find(p => p.id === detailProduct.id)?.availability : null} basketUnits={detailProduct && Number(cartShopId) === Number(shopId) && sameShoppingContext(cartContext, browseContext) ? basketProductUnits(basket, detailProduct.id) : 0}/>
      {window.AllergensModal && <window.AllergensModal open={allergensOpen} onClose={() => setAllergensOpen(false)}/>}
      <CheckoutWizard open={checkoutOpen} onClose={() => setCheckoutOpen(false)} shop={cartShop} mode={mode} basket={basket} quoteState={quoteState} user={user} onLogin={() => setAuthOpen(true)} onPlaced={handlePlaced} onQuoteChanged={() => setQuoteRevision(value => value + 1)}
        voucherInput={voucherInput} setVoucherInput={setVoucherInput}
        voucherApplied={voucherApplied} setVoucherApplied={setVoucherApplied}
        office={userOffice} tour={userTour} date={date} onDate={setDate}
        deliveryFeeResult={deliveryFeeResult} deliveryFeeErr={wsMessage(deliveryFeeErr)}
        officeSites={officeSites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId}
      />
      {prefNudge && (
        <div className="ws-pref-nudge" role="dialog" aria-label={t('prefshop.title')}>
          <div className="ws-pref-nudge__body">
            <div className="ws-pref-nudge__title">{tRich(t, 'prefshop.q', { shop: prefNudge.shopName })}</div>
            <div className="ws-pref-nudge__sub">{tRich(t, 'prefshop.sub', { shop: prefNudge.shopName })}</div>
          </div>
          <div className="ws-pref-nudge__btns">
            <button type="button" className="ws-pref-nudge__no" onClick={() => setPrefNudge(null)}>{t('common.later')}</button>
            <button type="button" className="ws-pref-nudge__yes" onClick={() => {
              if (user) {
                const updated = { ...user, preferredShopId: prefNudge.shopId };
                setUser(updated);
                if (window.WSI18n && window.WSI18n.setCustomer) {
                  const existing = window.WSI18n.getCustomer() || {};
                  window.WSI18n.setCustomer({ ...existing, ...updated });
                }
              }
              setPrefNudge(null);
            }}>{t('prefshop.set')}</button>
          </div>
        </div>
      )}
      {notice && (
        /* Le motif reste à l'écran jusqu'à ce qu'on le ferme : il porte une
           consigne, et une bulle qui s'efface toute seule se lit rarement en
           entier sur un téléphone. */
        <div className="ws-toast ws-toast--notice" role="alert">
          <div className="ws-toast__body">
            <div className="ws-toast__title">{wsMessage(notice.titre)}</div>
            <div className="ws-toast__sub">{wsMessage(notice.texte)}</div>
          </div>
          {/* « Fermer » EN BAS : à droite du texte, il comprimait le titre sur
              deux lignes et tombait haut dans l'écran, loin du pouce. */}
          <button type="button" className="ws-toast__close" onClick={() => setNotice(null)}>{t('common.close2')}</button>
        </div>
      )}
      {stockErr && (
        <div className="ws-toast ws-toast--err" role="alert" style={{ background: '#7a1f1f' }}>
          <div>
            <div className="ws-toast__title">{t('stock.checkAvailability')}</div>
            <div className="ws-toast__sub">{wsMessage(stockErr)}</div>
          </div>
          <button type="button" onClick={() => setStockErr('')}
            style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', font: '600 13px var(--font-ui)' }}>{t('common.close2')}</button>
        </div>
      )}
      {orderToast && <OrderConfirmation orderRef={orderToast.orderRef} total={orderToast.total} shop={cartShop} onClose={() => setOrderToast(null)}/>}
      <PwaInstallPrompt />
    </div>
  );
}

// =========================================================================
window.WSI18n.detectFromIp()
  .then(() => window.WSI18n.load())
  .then((ready) => {
    if (ready) ReactDOM.createRoot(document.getElementById('root')).render(<ShopFrame variant="A"/>);
  });
