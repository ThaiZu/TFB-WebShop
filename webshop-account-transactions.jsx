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
  return <div className="ws-acc__row-foot">
    <button type="button" className="ws-linkbtn" disabled={busy} onClick={download}>
      {t(busy ? 'common.loading2' : 'billing.download')} · {invoice.number}
    </button>
    {error && <p role="alert">{error}</p>}
  </div>;
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
    <button type="button" className="ws-transaction-action" disabled={busy} onClick={download}>
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
      <div className="ws-acc__card">
        <div className="ws-acc__card-head">
          <TransactionSource source={detail.source} t={t}/>
          <span>{detail.shop} · {date(detail.at)}</span>
        </div>
        <p>{t('acc.orders.total')} · {money(detail.total)}</p>
        <TransactionReceipt transaction={detail} t={t}/>
        <TransactionInvoice invoice={detail.invoice} t={t}/>
      </div>
      {detail.lines.map(line => <div className="ws-acc__card" key={line.id}>
        <strong>{line.name}</strong>
        <dl className="ws-purchase-values">
          <div><dt>{t('acc.orders.quantity')}</dt><dd>{line.quantity.toLocaleString(locale)}</dd></div>
          <div><dt>{t('acc.orders.unitPrice')}</dt><dd>{money(line.unitGrossPrice)}</dd></div>
          {line.discountValue > 0 && <div><dt>{t('acc.orders.discount')}</dt><dd>{money(line.discountValue)}</dd></div>}
          <div><dt>{t('acc.orders.lineTotal')}</dt><dd>{money(line.totalGross)}</dd></div>
        </dl>
      </div>)}
    </> : <>
      {!loading && error !== 'acc.transactions.error' && items.length === 0 && <p>{t('acc.transactions.empty')}</p>}
      {items.map(item => <div className="ws-acc__card" key={item.id} data-transaction-id={item.id}>
        <div className="ws-acc__card-head">
          <TransactionSource source={item.source} t={t}/>
          <strong>{money(item.total)}</strong>
        </div>
        <p>{item.shop} · {date(item.at)}</p>
        <div className="ws-transaction-actions">
          <button type="button" className="ws-transaction-action" disabled={loading} onClick={() => openTransaction(item.id)}>
            <TransactionActionIcon/>
            <span>{t('acc.transactions.detail')}</span>
          </button>
          <TransactionReceipt transaction={item} t={t}/>
        </div>
        <TransactionInvoice invoice={item.invoice} t={t}/>
      </div>)}
      {before && <button type="button" className="ws-linkbtn" disabled={loading} onClick={loadMore}>{t('acc.transactions.more')}</button>}
    </>}
  </section>;
}
