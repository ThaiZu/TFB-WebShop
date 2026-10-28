import { analyticsPurchase } from './webshop-analytics.js';
import { useEffect, useState, useRef } from 'react';
import './webshop-order-confirmation.css';

// Use saved order details: catalogue prices may already have changed.
export function OrderSummary({ order, total, shop }) {
  const t = window.WSI18n.t;
  const locale = window.WSI18n.getLang();
  const money = value => Number(value).toLocaleString(locale, { style: 'currency', currency: 'EUR' });
  const dateValue = order.slot?.dateTime;
  const parsed = new Date(String(dateValue || '').replace(' ', 'T'));
  const date = dateValue && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString(locale, {dateStyle:'long'}) : '';
  const delivery = order.delivery || {};
  const address = order.mode === 'delivery'
    ? [delivery.office_name, delivery.office_delivery_site_name, delivery.address].filter(Boolean).join(' · ')
    : [shop?.name, shop?.address, shop?.city].filter(Boolean).join(' · ');
  return <div className="ws-order-summary">
    <div className="ws-order-summary__reference"><span>{t('confirmation.reference')}</span><strong>{order.orderRef}</strong></div>
    <div className="ws-order-summary__facts">
      <section><span>{t(order.mode === 'delivery' ? 'acc.orders.delivery' : 'acc.orders.pickup')}</span>
        {date && <strong>{date}</strong>}<strong>{order.slot?.label || (date ? parsed.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) : '—')}</strong>
        {address && <p>{address}</p>}
      </section>
      <section><span>{t('acc.orders.payment')}</span><strong>{t('payment.method.' + (order.payment?.method === 'company_invoice' ? 'company_invoice' : order.payment?.method === 'stripe' ? 'stripe' : 'shop'))}</strong></section>
    </div>
    <h3>{t('acc.orders.details')}</h3>
    <ul className="ws-order-summary__items">{(order.items || []).map((line,index) => <li key={line.id || index}>
      <div><strong>{line.name}</strong>
        <small>{Number(line.quantity).toLocaleString(locale)} × {money(line.unitGrossPrice)}</small>
        {line.weightGrams != null && <small>{line.weightGrams} g</small>}
        {Array.isArray(line.options) && line.options.map((option,i) => <small key={i}>{option.label || option.name}</small>)}
        {line.note && <small>{line.note}</small>}
        {Number(line.discountValue)>0 && <small>{t('acc.orders.discount')}: −{money(line.discountValue)}</small>}
      </div><strong>{money(line.totalGross)}</strong>
    </li>)}</ul>
    {total != null && Number.isFinite(Number(total)) && <div className="ws-order-summary__total"><span>{t('acc.orders.total')}</span><strong>{money(total)}</strong></div>}
  </div>;
}

export function OrderConfirmation({ orderRef, total, shop, onClose }) {
  const t = window.WSI18n.t;
  const [order,setOrder] = useState(null);
  const [error,setError] = useState(false);
  const [revision,setRevision] = useState(0);
  const dialog = useRef(null);
  useEffect(() => {
    let alive = true;
    setError(false);
    Promise.resolve().then(() => window.WSOrders.get(orderRef)).then(result => {
      if (!result || !Array.isArray(result.items)) throw new Error('Order details unavailable');
      if(alive){setOrder(result);analyticsPurchase(result, total);}
    }).catch(() => {if(alive)setError(true);});
    return () => {alive=false;};
  },[orderRef,revision]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => {if(previous?.isConnected)previous.focus();};
  },[]);
  const onKeyDown = event => {
    if(event.key === 'Escape')onClose();
    if(event.key !== 'Tab')return;
    const elements = [...dialog.current.querySelectorAll('button:not(:disabled)')];
    const first=elements[0], last=elements[elements.length-1];
    if(event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement === last){event.preventDefault();first?.focus();}
  };
  return <div className="ws-office-overlay"><section ref={dialog} tabIndex={-1} onKeyDown={onKeyDown} className="ws-office-modal ws-order-confirmation" role="dialog" aria-modal="true" aria-labelledby="ws-order-confirmation-title">
    <div className="ws-office-heading"><h2 id="ws-order-confirmation-title">{t('order.confirmed')}</h2><button type="button" aria-label={t('common.close2')} onClick={onClose}>×</button></div>
    <div className="ws-order-result ws-order-result--paid" role="status"><span className="ws-order-result__icon" aria-hidden="true">✓</span><div><strong>{t('confirmation.thanks')}</strong><p>{t('confirmation.saved')}</p></div></div>
    {order ? <OrderSummary order={order} total={total} shop={shop}/> : error
      ? <div role="alert"><p>{t('acc.orders.detailError')}</p><button className="ws-linkbtn" onClick={()=>setRevision(value=>value+1)}>{t('stock.refresh')}</button></div>
      : <p role="status">{t('common.loading2')}</p>}
    <footer className="ws-order-confirmation__footer"><button type="button" className="ws-cta" onClick={onClose}>{t('confirmation.continue')}</button></footer>
  </section></div>;
}
