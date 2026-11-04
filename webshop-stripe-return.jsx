import { analyticsPurchase } from './webshop-analytics.js';
import { OrderSummary } from './webshop-order-confirmation.jsx';
import { useEffect, useState } from 'react';
import { StripeEmbeddedPayment } from './webshop-stripe-embedded.jsx';

const validReference = value => /^WEB-\d+-\d{8}-[A-F0-9]{6}$/.test(value || '') ? value : '';

export function StripeReturnDialog() {
  const t = window.WSI18n.t;
  const [reference, setReference] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return ['return', 'cancel'].includes(params.get('stripe')) ? validReference(params.get('orderRef')) : '';
  });
  const [checkoutSession, setCheckoutSession] = useState(null);
  useEffect(() => {
    // Consume the return URL once; saved pending payments remain available on demand.
    const url = new URL(window.location.href);
    const returnedRef = validReference(url.searchParams.get('orderRef'));
    if (returnedRef && ['return', 'cancel'].includes(url.searchParams.get('stripe'))) {
      try { sessionStorage.setItem('ws.lastPay', returnedRef); } catch (_) {}
      url.searchParams.delete('stripe'); url.searchParams.delete('orderRef');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    const recover = event => {
      const ref = validReference(event.detail?.orderRef);
      if (ref) {
        const url = new URL(window.location.href);
        if (url.searchParams.get('orderRef') === ref && ['return', 'cancel'].includes(url.searchParams.get('stripe'))) {
          url.searchParams.delete('stripe'); url.searchParams.delete('orderRef');
          window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
        setCheckoutSession(event.detail?.session?.uiMode === 'embedded' ? event.detail.session : null);
        setReference(ref);
      }
    };
    const logout = () => { setCheckoutSession(null); setReference(''); const url = new URL(window.location.href); url.searchParams.delete('stripe'); url.searchParams.delete('orderRef'); window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); };
    const openVouchers=()=>{setCheckoutSession(null);setReference('');};
    window.addEventListener('ws:open-vouchers',openVouchers);
    window.addEventListener('ws:stripe-recovery', recover);
    window.addEventListener('ws:payment-logout', logout);
    return () => { window.removeEventListener('ws:open-vouchers',openVouchers);window.removeEventListener('ws:stripe-recovery', recover); window.removeEventListener('ws:payment-logout', logout); };
  }, []);
  const close = () => {
    setCheckoutSession(null);
    setReference('');
    const url = new URL(window.location.href);
    url.searchParams.delete('stripe'); url.searchParams.delete('orderRef');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  };
  if (!reference) return null;
  return <div className="ws-office-overlay"><section className="ws-office-modal ws-order-confirmation" role="dialog" aria-modal="true" aria-labelledby="ws-stripe-return-title">
    <div className="ws-office-heading"><h2 id="ws-stripe-return-title">{t('acc.orders.payment')}</h2><button type="button" onClick={close} aria-label={t('common.close2')}>×</button></div>
    {checkoutSession ? <StripeEmbeddedPayment session={checkoutSession} orderRef={reference} onComplete={() => setCheckoutSession(null)}/> : <StripePaymentStatus key={reference} orderRef={reference}/>}
  </section></div>;
}

export function StripePaymentStatus({ orderRef, onUpdated }) {
  const t = window.WSI18n.t;
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true, timer, count = 0;
    setBusy(true); setError(false);
    const check = async () => {
      try {
        const status = await window.WSOrders.paymentStatus(orderRef);
        const result = await window.WSOrders.get(orderRef);
        if (!result) throw new Error('Order unavailable');
        if (!alive) return;
        setPayment(status); setOrder(result); setBusy(false);
        onUpdated?.(result);
        if (status.status === 'paid') analyticsPurchase({ ...result, payment: { method: 'stripe', status: 'paid' } },
          Number.isSafeInteger(status.amountMinor) ? status.amountMinor / 100 : undefined);
        try {
          sessionStorage.setItem('ws.lastPay', orderRef);
          if (status.status === 'paid' && JSON.parse(sessionStorage.getItem('ws.pendingPay') || 'null')?.orderRef === orderRef) sessionStorage.removeItem('ws.pendingPay');
        } catch (_) {}
        if (['pending', 'processing'].includes(status.status) && ++count < 5) timer = setTimeout(check, 2500);
      } catch (_) { if (alive) { setError(true); setBusy(false); } }
    };
    check();
    return () => { alive = false; clearTimeout(timer); };
  }, [orderRef, revision]);
  const status = order?.payment?.status === 'paid' ? 'paid' : payment?.status;
  return <div className="ws-stripe-status">
    {busy && <p role="status">{t('stripe.checking')}</p>}
    {error && <p role="alert">{t('stripe.statusUnknown')}</p>}
    {!error && !busy && status && <div className={'ws-order-result' + (status === 'paid' ? ' ws-order-result--paid' : '')} role="status"><span className="ws-order-result__icon" aria-hidden="true">{status === 'paid' ? '✓' : '…'}</span><div>{status === 'paid' && <strong>{t('confirmation.thanks')}</strong>}<p>{t('stripe.status.' + status)}</p></div></div>}
    {order && <OrderSummary order={order} total={Number.isFinite(payment?.amountMinor) ? payment.amountMinor / 100 : null}/>}
    <div className="ws-payment-actions">
      {!busy && !error && ['unpaid', 'expired', 'not_started'].includes(status) && <StripeRetryButton orderRef={orderRef} onUpdated={() => setRevision(value => value + 1)}/>}
      <button type="button" className="ws-cta ws-payment-refresh" disabled={busy} onClick={() => setRevision(value => value + 1)}>{t('stock.refresh')}</button>
    </div>
  </div>;
}

export function StripeRetryButton({ orderRef, onUpdated, verifyFirst = false }) {
  const t = window.WSI18n.t;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);
  async function retry() {
    setBusy(true); setMessage('');
    try {
      if (verifyFirst) {
        const checked = await window.WSOrders.paymentStatus(orderRef);
        if (!['unpaid', 'expired', 'not_started'].includes(checked.status)) {
          setMessage(t('stripe.status.' + checked.status)); setBusy(false); onUpdated?.(); return;
        }
      }
      const session = await window.WSOrders.pay(orderRef);
      if (session.status === 'paid') { setMessage(t('acc.orders.payment.paid')); setBusy(false); onUpdated?.(); }
      else if (session.status === 'pending') { setMessage(t('stripe.pending')); setBusy(false); onUpdated?.(); }
      else if (session.uiMode === 'embedded') { setSession(session); setBusy(false); }
      else window.location.assign(session.checkoutUrl);
    } catch (error) { setMessage(error.code ? window.WSI18n.message(error.code) : t(verifyFirst ? 'stripe.statusUnknown' : 'stripe.retryError')); setBusy(false); }
  }
  async function complete() {
    setSession(null); setBusy(true); setMessage(t('stripe.checking'));
    try { const checked = await window.WSOrders.paymentStatus(orderRef); setMessage(t('stripe.status.' + checked.status)); onUpdated?.(); }
    catch (_) { setMessage(t('stripe.statusUnknown')); }
    finally { setBusy(false); }
  }
  if (session) return <div className="ws-payment-retry ws-payment-retry--embedded"><StripeEmbeddedPayment session={session} orderRef={orderRef} onComplete={complete}/></div>;
  return <div className="ws-payment-retry"><button type="button" className="ws-cta" disabled={busy} onClick={retry}>{t(busy ? 'stripe.loadingForm' : 'stripe.retry')}</button>{message && <p role="status">{message}</p>}</div>;
}
