import {useEffect, useRef, useState} from 'react';
import {billingRequest, billingError, saveInvoicePdf} from './webshop-billing-api.js';
import './webshop-billing.css';

const countries = ['AT','BE','BG','CY','CZ','DE','DK','EE','EL','ES','FI','FR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK','XI'];

export function BillingCompanies({allowAdd = true}) {
  const t = window.WSI18n.t;
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [country, setCountry] = useState('BE');
  const [vat, setVat] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    billingRequest('/companies').then(rows => { if (mounted.current) setCompanies(rows); })
      .catch(e => { if (mounted.current) setError(billingError(e)); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, []);
  async function change(path, options) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await billingRequest(path, options);
      if (mounted.current) { setCompanies(result); setVat(''); }
    } catch (e) { if (mounted.current) setError(billingError(e)); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="ws-acc__section ws-billing-companies" aria-busy={busy || loading}>
    <h3 className="ws-acc__section-h">{t('acc.companies')}</h3>
    {allowAdd && <p className="ws-acc__hint">{t('billing.companyHelp')}</p>}
    {loading && <p role="status">{t('common.loading2')}</p>}
    {companies.map(company => <div className="ws-acc__card" key={company.id}>
      <strong>{company.name}</strong><p>{company.vat}</p><p>{company.address}</p>
      {company.isDefault && <p className="ws-acc__saved">{t('billing.default')}</p>}
      <div className="ws-acc__row-foot">
        {!company.isDefault && <button type="button" className="ws-linkbtn" disabled={busy}
          onClick={() => change('/companies/'+company.id+'/default', {method:'POST'})}>{t('billing.setDefault')}</button>}
        <button type="button" className="ws-acc__unplug" disabled={busy}
          onClick={() => change('/companies/'+company.id, {method:'DELETE'})}>{t('common.remove')}</button>
      </div>
    </div>)}
    {allowAdd && <form className="ws-acc__card" onSubmit={e => {e.preventDefault(); change('/companies', {method:'POST', body:{country, vat}});}}>
      <div className="ws-acc__form ws-acc__form--vat">
        <label className="ws-acc__field"><span>{t('co2.country')}</span>
          <select className="ws-acc__input" value={country} onChange={e => setCountry(e.target.value)} disabled={busy}>
            {countries.map(code => <option key={code}>{code}</option>)}
          </select></label>
        <label className="ws-acc__field"><span>{t('co2.vat')}</span>
          <input className="ws-acc__input" value={vat} onChange={e => setVat(e.target.value)} required maxLength={30} disabled={busy}/>
        </label>
      </div>
      <button type="submit" className="ws-cta" disabled={busy || loading || !vat.trim()}>{t(busy ? 'ui.verifying' : 'co2.add')}</button>
    </form>}
    {error && <p role="alert" className="ws-acc__vat-msg ws-acc__vat-msg--err">{error}</p>}
  </section>;
}

export function validInvoiceBuyer(buyer) {
  return buyer.type === 'none' || (buyer.type === 'company' ? Number(buyer.companyId) > 0
    : ['name', 'address', 'postalCode', 'city'].every(key => buyer[key]?.trim()));
}

export function InvoiceBuyerFields({buyer, setBuyer, companies, disabled, allowNone = false}) {
  const t = window.WSI18n.t;
  const update = (key, value) => setBuyer(previous => ({...previous, [key]: value}));
  return <fieldset className="ws-acc__form" disabled={disabled}>
    <legend className="ws-acc__field-label">{t('billing.invoice')}</legend>
    <label className="ws-acc__field">
      <span>{t('billing.buyerType')}</span>
      <select className="ws-acc__input" value={buyer.type} onChange={event => {
        const type = event.target.value;
        setBuyer(previous => ({...previous, type, companyId: previous.companyId ||
          String((companies.find(company => company.isDefault) || companies[0])?.id || '')}));
      }}>
        {allowNone && <option value="none">{t('billing.noInvoice')}</option>}
        <option value="personal">{t('billing.personalInvoice')}</option>
        <option value="company">{t('billing.companyInvoice')}</option>
      </select>
    </label>
    {buyer.type === 'personal' && Object.entries({name: 200, address: 200, postalCode: 20, city: 100}).map(([key, limit]) =>
      <label className="ws-acc__field" key={key}><span>{t('billing.buyerField.' + key)}</span>
        <input className="ws-acc__input" required maxLength={limit} value={buyer[key] || ''} onChange={event => update(key, event.target.value)}/>
      </label>)}
    {buyer.type === 'company' && (companies.length > 0 ? <label className="ws-acc__field"><span>{t('billing.buyer')}</span>
      <select className="ws-acc__input" required value={buyer.companyId || ''} onChange={event => update('companyId', event.target.value)}>
        <option value="" disabled>{t('billing.selectCompany')}</option>
        {companies.map(company => <option key={company.id} value={company.id}>{company.name} · {company.vat}</option>)}
      </select>
    </label> : <p>{t('billing.addCompanyFirst')}</p>)}
  </fieldset>;
}

export function invoiceBuyerPayload(buyer) {
  if (buyer.type === 'company') return {type: 'company', companyId: Number(buyer.companyId)};
  const {type, name, address, postalCode, city} = buyer;
  return {type, name, address, postalCode, city};
}

export function PurchaseInvoice({orderRef, refreshKey = ''}) {
  const t = window.WSI18n.t;
  const [status, setStatus] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [buyer, setBuyer] = useState({type: 'personal'});
  const [po, setPo] = useState('');
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const path = '/orders/' + encodeURIComponent(orderRef);
  useEffect(() => {
    const current = ++generation.current;
    setStatus(null); setError(''); setSent(false); setBusy(false);
    Promise.all([billingRequest(path), billingRequest('/companies').catch(() => [])]).then(([data, rows]) => {
      if (generation.current !== current) return;
      setStatus(data); setCompanies(rows);
      setBuyer({type: 'personal'});
    }).catch(e => { if (generation.current === current) setError(billingError(e)); });
    return () => { generation.current++; };
  }, [path, revision, refreshKey]);
  async function action(operation) {
    if (busy) return;
    const current = generation.current;
    setBusy(true); setError(''); setSent(false);
    try {
      await operation(current);
    } catch (e) { if (generation.current === current) setError(billingError(e)); }
    finally { if (generation.current === current) setBusy(false); }
  }
  function issue() {
    return action(async current => {
      const result = await billingRequest(path, {method:'POST', body:status.requested ? {} : {...invoiceBuyerPayload(buyer), po, reference}});
      if (generation.current === current) setStatus({invoice:result.invoice, eligible:false});
    });
  }
  function download() {
    return action(async current => {
      const blob = await billingRequest(path+'/pdf', {pdf:true});
      if (generation.current !== current) return;
      saveInvoicePdf(blob, status.invoice.invoice_number);
    });
  }
  return <section className="ws-acc__section ws-purchase-invoice" aria-busy={busy}>
    <h3>{t('billing.invoice')}</h3>
    {!status && !error && <p role="status">{t('common.loading2')}</p>}
    {!status && error && <button type="button" className="ws-linkbtn" onClick={() => setRevision(n => n+1)}>{t('stock.refresh')}</button>}
    {status?.invoice ? <div className="ws-acc__card">
      <strong>{status.invoice.invoice_number}</strong>
      <p>{status.invoice.consignee_name}{status.invoice.consignee_tax_number && ` · ${status.invoice.consignee_tax_number}`}</p>
      {status.invoice.po_hash && <p>PO#: {status.invoice.po_hash}</p>}
      {status.invoice.reference_comment && <p>{status.invoice.reference_comment}</p>}
      <button type="button" className="ws-cta" disabled={busy} onClick={download}>{t('billing.download')}</button>
      <form onSubmit={e => {e.preventDefault(); action(async current => {
        await billingRequest(path+'/email', {method:'POST', body:{email}});
        if (generation.current === current) setSent(true);
      });}}>
        <label className="ws-acc__field"><span>{t('billing.email')}</span>
          <input className="ws-acc__input" type="email" required maxLength={255} value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/>
        </label>
        <button className="ws-cta" type="submit" disabled={busy}>{t('billing.send')}</button>
      </form>
      {sent && <p role="status">{t('billing.sent')}</p>}
    </div> : status?.eligible ? <form onSubmit={e => {e.preventDefault(); issue();}}>
      {status.requested ? <p>{t('billing.invoiceRequested')}</p> : <>
        <InvoiceBuyerFields buyer={buyer} setBuyer={setBuyer} companies={companies} disabled={busy}/>
        <label className="ws-acc__field"><span>PO#</span><input className="ws-acc__input" value={po} maxLength={100} disabled={busy} onChange={e => setPo(e.target.value)}/></label>
        <label className="ws-acc__field"><span>{t('billing.reference')}</span><textarea className="ws-acc__input" value={reference} maxLength={255} disabled={busy} onChange={e => setReference(e.target.value)}/></label>
      </>}
      <p className="ws-acc__hint">{t('billing.issueHint')}</p>
      <button className="ws-cta" type="submit" disabled={busy || (!status.requested && !validInvoiceBuyer(buyer))}>{t(busy ? 'ui.saving' : 'billing.issue')}</button>
    </form> : status && <p>{t((status.pending || status.waitingForOrder) && !status.contactShop ? 'billing.invoicePending' : 'billing.contactShop')}</p>}
    {error && <p role="alert" className="ws-acc__vat-msg ws-acc__vat-msg--err">{error}</p>}
  </section>;
}
