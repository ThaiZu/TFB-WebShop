import { orderStatusName, paymentStatusName } from './webshop-order-status.js';
import { StripePaymentStatus } from './webshop-stripe-return.jsx';
import { useEffect, useState } from 'react';
import { PurchaseInvoice } from './webshop-billing.jsx';

// Read saved order lines, never reconstruct historical prices from today's catalogue.
export function PurchaseDetails({ order, onBack }) {
  const t = window.WSI18n.t;
  const locale = window.WSI18n.getLang();
  const date = value => { const parsed = new Date(String(value || '').replace(' ', 'T')); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale, {dateStyle:'medium',timeStyle:'short'}); };
  const money = value => Number(value || 0).toLocaleString(locale, { style: 'currency', currency: 'EUR' });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false); setDetail(null);
    Promise.resolve().then(() => window.WSOrders.get(order.orderRef)).then(result => {
      if (!result || !Array.isArray(result.items)) throw new Error('Invalid order details');
      if (alive) setDetail(result);
    }).catch(() => { if (alive) setError(true); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [order.orderRef, revision]);
  return <section className="ws-acc__section ws-purchase-details">
    <button type="button" className="ws-linkbtn" onClick={onBack}>← {t('acc.orders.back')}</button>
    <h3>{t('acc.orders.details')} · {order.orderRef}</h3>
    {loading && <p role="status">{t('common.loading2')}</p>}
    {error && <div role="alert"><p>{t('acc.orders.detailError')}</p><button type="button" className="ws-cta ws-payment-refresh" onClick={() => setRevision(value => value + 1)}>{t('stock.refresh')}</button></div>}
    {detail && <>
      <div className={'ws-acc__card' + (orderStatusName(detail.status) === 'cancelled' ? ' ws-purchase--cancelled' : paymentStatusName(detail.payment?.status) === 'paid' ? ' ws-purchase--paid' : '')}>
        <p>{t('acc.orders.status.' + orderStatusName(detail.status))}</p>
        <p>{t(detail.mode === 'delivery' ? 'acc.orders.delivery' : 'acc.orders.pickup')}: {date(detail.slot?.dateTime)}</p>
        <p>{t('acc.orders.payment')}: {orderStatusName(detail.status) === 'cancelled' ? '-' : t('acc.orders.payment.' + paymentStatusName(detail.payment?.status))}</p>
        <p>{detail.billing?.mode === 'company' ? t('officeAccess.companyPays', { name: detail.billing?.company?.company_name || detail.billing?.company?.name || '' }) : t('officeAccess.personPays')}</p>
      </div>
      {detail.items.map(line => <article key={line.id} className="ws-acc__card">
        <strong>{line.name}</strong>
        {line.weightGrams != null && <p>{line.weightGrams} g</p>}
        {Array.isArray(line.options) && line.options.length > 0 && <ul>{line.options.map((option, index) => <li key={index}>{option.label || option.name || ''}</li>)}</ul>}
        {line.note && <p>{line.note}</p>}
        <dl className="ws-purchase-values">
          <div><dt>{t('acc.orders.quantity')}</dt><dd>{Number(line.quantity).toLocaleString(locale)}</dd></div>
          <div><dt>{t('acc.orders.unitPrice')}</dt><dd>{money(line.unitGrossPrice)}</dd></div>
          <div><dt>{t('acc.orders.discount')}</dt><dd>{money(line.discountValue)}</dd></div>
          <div><dt>{t('acc.orders.lineTotal')}</dt><dd>{money(line.totalGross)}</dd></div>
        </dl>
      </article>)}
      {detail.pricing?.applied_promotions?.map((promotion, index) => <div className="ws-acc__card-row" key={promotion.id_promotion ?? index}>
        <span>{promotion.promotion_name || promotion.name || t('co.promo.title')}</span>
        <span>−{money(promotion.discount_value ?? promotion.discount_amount ?? promotion.discount_total)}</span>
      </div>)}
      {detail.pricing?.voucher?.code && <p>{t('sum.code')}: {detail.pricing.voucher.code}</p>}
      {orderStatusName(detail.status) !== 'cancelled' && detail.payment?.method === 'stripe' && <StripePaymentStatus orderRef={order.orderRef} onUpdated={setDetail}/>}
      <div className="ws-acc__card-row"><strong>{t('acc.orders.total')}</strong><strong>{money(detail.pricing?.totals?.gross_after_discount ?? order.total)}</strong></div>
      <PurchaseInvoice key={order.orderRef} orderRef={order.orderRef} refreshKey={String(detail.status)+':'+String(detail.payment?.status)}/>
    </>}
  </section>;
}
