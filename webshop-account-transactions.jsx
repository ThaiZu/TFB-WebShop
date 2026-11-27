import { useEffect, useState } from 'react';
import { normalizeReceiptToken } from './webshop-receipt-token.js';
import { billingError, billingRequest, saveInvoicePdf, savePdf } from './webshop-billing-api.js';

function TransactionActionIcon({ download = false }) {
  return <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {download ? <path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>
      : <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>}
  </svg>;
}

function TransactionSource({ source, t }) {
  const label = t('acc.orders.source.' + source);
  return <svg className="ws-transaction-source" role="img" aria-label={label}
    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <title>{label}</title>
    {source === 'webshop'
      ? <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>
      : <path d="M4 10v10h16V10M3 10l2-6h14l2 6H3zm6 10v-6h6v6"/>}
  </svg>;
}

function TransactionInvoice({ invoice, t }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setBusy(true);
    setError('');
    try {
      const blob = await billingRequest('/orders/' + encodeURIComponent(invoice.orderRef) + '/pdf', { pdf: true });
      saveInvoicePdf(blob, invoice.number);
    } catch (exception) {
      setError(billingError(exception));
    } finally {
      setBusy(false);
    }
  }

  if (!invoice) return null;
  if (invoice.status === 'pending') return <p role="status">{t('billing.invoicePending')}</p>;
  return <>
    <button type="button" className="ws-transaction-action" disabled={busy} onClick={download}>
      <TransactionActionIcon download/>
      <span>{t(busy ? 'common.loading2' : 'billing.download')} · {invoice.number}</span>
    </button>
    {error && <p role="alert">{error}</p>}
  </>;
}

function TransactionReceipt({ transaction, t }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    setBusy(true);
    setError(false);
    try {
      const pdf = await window.WSOrders.getTransactionReceipt(transaction.id);
      savePdf(pdf, 'receipt', transaction.reference || transaction.id);
    } catch (_) {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (transaction.receiptAvailable === false || transaction.invoice?.status === 'issued') return null;

  return <>
    <button type="button" className="ws-transaction-action" disabled={busy} onClick={download} title={t('acc.transactions.salesDocument')}>
      <TransactionActionIcon download/>
      <span>{t(busy ? 'common.loading2' : 'acc.transactions.salesDocument')}</span>
    </button>
    {error && <p role="alert">{t('acc.transactions.salesDocumentError')}</p>}
  </>;
}

export function receiptIntent() {
  const token = new URLSearchParams(location.hash.slice(1)).get('receipt');
  return normalizeReceiptToken(token);
}

export function AccountTransactions({ receiptToken, t, locale, onReceiptHandled }) {
  const [items, setItems] = useState([]);
  const [before, setBefore] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const date = value => {
    const parsed = new Date(String(value || '').replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const money = value => Number(value).toLocaleString(locale, { style: 'currency', currency: 'EUR' });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (receiptToken) {
          const receipt = await window.WSOrders.resolveReceipt(receiptToken, controller.signal);
          if (controller.signal.aborted) return;
          if (receipt) {
            setDetail(receipt);
            return;
          }
          setError('acc.transactions.unavailable');
        }
        const payload = await window.WSOrders.listTransactions(null, controller.signal);
        if (controller.signal.aborted) return;
        setItems(payload.items);
        setBefore(payload.nextBefore);
      } catch (_) {
        if (!controller.signal.aborted) setError('acc.transactions.error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [receiptToken, revision]);

  async function loadMore() {
    setLoading(true);
    setError('');
    try {
      const payload = await window.WSOrders.listTransactions(before);
      setItems(current => [...current, ...payload.items]);
      setBefore(payload.nextBefore);
    } catch (_) {
      setError('acc.transactions.error');
    } finally {
      setLoading(false);
    }
  }

  async function openTransaction(id) {
    setLoading(true);
    setError('');
    try {
      setDetail(await window.WSOrders.getTransaction(id));
    } catch (_) {
      setError('acc.transactions.error');
    } finally {
      setLoading(false);
    }
  }

  function closeDetail() {
    setDetail(null);
    if (receiptToken) {
      onReceiptHandled();
    }
  }

  return <section className="ws-acc__section" aria-label={t('acc.transactions.title')}>
    <h3 className="ws-acc__section-h">{t('acc.transactions.title')}</h3>
    {loading && <p role="status">{t('common.loading2')}</p>}
    {error && <p role={error === 'acc.transactions.unavailable' ? 'status' : 'alert'}>{t(error)}</p>}
    {!loading && error === 'acc.transactions.error' && <button type="button" className="ws-linkbtn"
      onClick={() => setRevision(value => value + 1)}>{t('stock.refresh')}</button>}
    {detail ? <>
      <button type="button" className="ws-linkbtn" onClick={closeDetail}>← {t('acc.transactions.back')}</button>
      <div className="ws-acc__card ws-tx-summary">
        <div className="ws-acc__card-head">
          <span className="ws-tx-row__src"><TransactionSource source={detail.source} t={t}/></span>
          <span className="ws-tx-row__main"><strong>{detail.shop}</strong><span>{date(detail.at)}</span></span>
        </div>
        <p className="ws-tx-summary__total"><span>{t('acc.orders.total')}</span><strong>{money(detail.total)}</strong></p>
        <div className="ws-transaction-actions">
          <TransactionReceipt transaction={detail} t={t}/>
          {detail.invoice?.status === 'issued' && <TransactionInvoice invoice={detail.invoice} t={t}/>}
        </div>
        {detail.invoice?.status === 'pending' && <TransactionInvoice invoice={detail.invoice} t={t}/>}
      </div>
      <table className="ws-tx-lines">
        <thead><tr>
          <th scope="col">{t('acc.orders.quantity')}</th>
          <th scope="col">{detail.lines.length === 1 ? t('acc.orders.itemsOne') : t('acc.orders.items', { count: detail.lines.length })}</th>
          <th scope="col">{t('acc.orders.unitPrice')}</th>
          <th scope="col">{t('acc.orders.lineTotal')}</th>
        </tr></thead>
        <tbody>
          {detail.lines.map(line => <tr key={line.id}>
            <td className="ws-tx-lines__qty">{line.quantity.toLocaleString(locale)}×</td>
            <td className="ws-tx-lines__name">{line.name}
              <span className="ws-tx-lines__unit-m">{line.quantity.toLocaleString(locale)} × {money(line.unitGrossPrice)}</span>
              {line.discountValue > 0 && <span>{t('acc.orders.discount')} · {money(line.discountValue)}</span>}</td>
            <td className="ws-tx-lines__unit">{money(line.unitGrossPrice)}</td>
            <td className="ws-tx-lines__total">{money(line.totalGross)}</td>
          </tr>)}
        </tbody>
      </table>
    </> : <>
      {!loading && error !== 'acc.transactions.error' && items.length === 0 && <p>{t('acc.transactions.empty')}</p>}
      {items.length > 0 && <ul className="ws-tx-list">
        {items.map(item => <li className="ws-tx-row" key={item.id} data-transaction-id={item.id}>
          <span className="ws-tx-row__src"><TransactionSource source={item.source} t={t}/></span>
          <span className="ws-tx-row__main">
            <strong>{item.shop}</strong>
            <span>{date(item.at)} · {t('acc.orders.source.' + item.source)}</span>
          </span>
          <strong className="ws-tx-row__amount">{money(item.total)}</strong>
          <div className="ws-transaction-actions ws-tx-row__actions">
            <TransactionReceipt transaction={item} t={t}/>
            {item.invoice?.status === 'issued' && <TransactionInvoice invoice={item.invoice} t={t}/>}
            <button type="button" className="ws-transaction-action ws-tx-row__open" disabled={loading} onClick={() => openTransaction(item.id)}
              title={t('acc.transactions.detail')}>
              <span>{t('acc.transactions.detail')}</span>
              <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </div>
          {item.invoice?.status === 'pending' && <div className="ws-tx-row__note"><TransactionInvoice invoice={item.invoice} t={t}/></div>}
        </li>)}
      </ul>}
      {before && <button type="button" className="ws-linkbtn" disabled={loading} onClick={loadMore}>{t('acc.transactions.more')}</button>}
    </>}
  </section>;
}
