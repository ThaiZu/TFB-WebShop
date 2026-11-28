import { useEffect, useRef, useState } from 'react';
import gothamBook from './fonts/Gotham_Book.otf';
import gothamMedium from './fonts/Gotham_Medium.otf';

let stripeScript;
function loadStripe() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!stripeScript) {
    stripeScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/dahlia/stripe.js';
      script.async = true;
      const failed = () => { clearTimeout(timeout); script.remove(); reject(new Error('Stripe unavailable')); };
      const timeout = setTimeout(failed, 20000);
      script.onload = () => { clearTimeout(timeout); window.Stripe ? resolve(window.Stripe) : failed(); };
      script.onerror = failed;
      document.head.appendChild(script);
    }).catch(error => { stripeScript = null; throw error; });
  }
  return stripeScript;
}

// Stripe form (ui_mode « form ») dressed in the design system: Gotham, bordeaux,
// beige fields, 10 px corners. The page's CSS cannot reach inside Stripe's iframe:
// this object is the only way to style it. Stripe's form takes no `rules`.
const absolute = url => new URL(url, window.location.href).href;
export const STRIPE_APPEARANCE = {
  theme: 'flat',
  variables: {
    colorPrimary: '#8D1D2C',
    colorBackground: '#F4EFE8',
    colorText: '#222222',
    colorTextSecondary: '#666666',
    colorDanger: '#B3261E',
    fontFamily: 'Gotham, system-ui, sans-serif',
    fontSizeBase: '15px',
    borderRadius: '10px',
    spacingUnit: '4px',
    inputColorBorder: 'rgba(34, 34, 34, 0.14)',
    inputFocusColorBorder: '#8D1D2C',
  },
};
// Stripe loads these from its own domain: the server must send the fonts with
// Access-Control-Allow-Origin, otherwise Stripe falls back to system-ui.
const stripeFonts = () => [
  { family: 'Gotham', src: `url(${absolute(gothamBook)})`, weight: '400' },
  { family: 'Gotham', src: `url(${absolute(gothamMedium)})`, weight: '500' },
];

async function mountForm(stripe, current, target, isAlive, onConfirmed) {
  const checkout = stripe.initCheckoutFormSdk({ clientSecret: current.clientSecret, appearance: STRIPE_APPEARANCE, fonts: stripeFonts() });
  const form = checkout.createForm({ layout: 'expanded' });
  const handle = { destroy: () => { if (typeof form.destroy === 'function') form.destroy(); else form.unmount?.(); } };
  if (!isAlive()) { handle.destroy(); return null; }
  form.mount(target);
  const loaded = await checkout.loadActions();
  if (!isAlive()) { handle.destroy(); return null; }
  if (loaded?.type !== 'success') { handle.destroy(); throw new Error('Stripe form unavailable'); }
  // Cards confirm in place; Bancontact and other redirect methods go to Stripe's
  // page and come back on the return URL, which the webshop already verifies.
  form.on('confirm', async event => {
    try {
      const result = await loaded.actions.confirm({ formConfirmEvent: event, redirect: 'if_required' });
      if (result?.type !== 'error' && isAlive()) onConfirmed();
    } catch (_) { /* Stripe shows its own message inside the form. */ }
  });
  return handle;
}

async function mountEmbeddedPage(stripe, current, target, isAlive, onConfirmed) {
  const checkout = await stripe.createEmbeddedCheckoutPage({
    fetchClientSecret: () => Promise.resolve(current.clientSecret),
    onComplete: () => { if (isAlive()) onConfirmed(); },
  });
  if (!isAlive()) { checkout.destroy(); return null; }
  checkout.mount(target);
  return checkout;
}

// Only Stripe receives card details. Completion merely triggers API verification.
export function StripeEmbeddedPayment({ session, orderRef, onComplete }) {
  const t = window.WSI18n.t;
  const target = useRef(null);
  const completed = useRef(onComplete);
  completed.current = onComplete;
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true, checkout;
    setError(false); setLoading(true);
    (async () => {
      const current = revision ? await window.WSOrders.pay(orderRef) : session;
      if (!alive) return;
      if (current.status !== 'open') { completed.current(); return; }
      const mount = { form: mountForm, embedded: mountEmbeddedPage }[current.uiMode];
      if (!mount) throw new Error('Unexpected checkout mode');
      const Stripe = await loadStripe();
      if (!alive) return;
      const stripe = Stripe(current.publishableKey, { stripeAccount: current.stripeAccount });
      checkout = await mount(stripe, current, target.current, () => alive, () => completed.current());
      if (!checkout) return;
      setLoading(false);
    })().catch(() => { if (alive) { checkout?.destroy(); checkout = null; setLoading(false); setError(true); } });
    return () => { alive = false; checkout?.destroy(); };
  }, [session, orderRef, revision]);
  return <div className="ws-stripe-embedded">
    <p>{t('stripe.embeddedHint')}</p>
    {loading && <p role="status">{t('stripe.loadingForm')}</p>}
    {error && <div role="alert"><p>{t('stripe.formError')}</p><button type="button" className="ws-cta" onClick={() => setRevision(value => value + 1)}>{t('stripe.retry')}</button></div>}
    <div ref={target}/>
  </div>;
}
