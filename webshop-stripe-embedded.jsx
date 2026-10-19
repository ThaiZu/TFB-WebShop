import { useEffect, useRef, useState } from 'react';

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
      if (current.uiMode !== 'embedded') throw new Error('Unexpected checkout mode');
      const Stripe = await loadStripe();
      if (!alive) return;
      const stripe = Stripe(current.publishableKey, { stripeAccount: current.stripeAccount });
      checkout = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: () => Promise.resolve(current.clientSecret),
        onComplete: () => { if (alive) completed.current(); },
      });
      if (!alive) { checkout.destroy(); checkout = null; return; }
      checkout.mount(target.current);
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
