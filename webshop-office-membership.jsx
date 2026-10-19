import { OfficeIdentity } from './webshop-office-identity.jsx';
import { useEffect, useState } from 'react';

// Access is granted only by the server after selecting a VAT search result.
export function OfficeMembershipModal({ open, shopId, initialTax = '', offices, onClose, onChanged }) {
  const t = (key, params) => window.WSI18n.t(key, params);
  const [tax, setTax] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { if (open) { setTax(initialTax); setResults(null); setError(''); setSuccess(''); } }, [open, shopId, initialTax]);
  useEffect(() => {
    if (!open) return;
    const escape = event => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, busy, onClose]);
  if (!open) return null;
  async function search(event) {
    event.preventDefault(); setBusy(true); setError(''); setResults(null); setSuccess('');
    try { setResults(await window.WSOffices.searchMemberships({ shop: shopId, tax_number: tax })); }
    catch (_) { setError(t('officeAccess.searchError')); }
    finally { setBusy(false); }
  }
  async function join(office) {
    setBusy(true); setError(''); setSuccess('');
    try {
      await window.WSOffices.joinMembership({ shop: shopId, officeId: office.id, tax_number: tax });
      await onChanged(); setSuccess(t('officeAccess.joined', { name: office.name })); setResults(null);
    } catch (_) { setError(t('officeAccess.joinError')); }
    finally { setBusy(false); }
  }
  return <div className="ws-office-overlay" onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="ws-office-modal" role="dialog" aria-modal="true" aria-labelledby="ws-office-title">
      <div className="ws-office-heading"><h2 id="ws-office-title">{t('officeAccess.title')}</h2><button type="button" onClick={onClose} disabled={busy} aria-label={t('common.close2')}>×</button></div>
      <p>{t('officeAccess.intro')}</p>
      <form onSubmit={search} className="ws-office-search">
        <label htmlFor="ws-office-tax">{t('officeAccess.tax')}</label>
        <div><input id="ws-office-tax" value={tax} onChange={event => { setTax(event.target.value); setResults(null); }} autoComplete="off" maxLength={32} required disabled={busy}/><button className="ws-cta" disabled={busy || !tax.trim()}>{busy ? '…' : t('officeAccess.search')}</button></div>
      </form>
      {error && <p role="alert" className="ws-co-error">{error}</p>}
      {success && <p role="status" className="ws-office-success">{success}</p>}
      {results && !results.length && <p role="status">{t('officeAccess.notFound')}</p>}
      {results && results.length > 0 && <div className="ws-office-results"><p>{t('officeAccess.choose')}</p>{results.map(office => {
        const joined = offices.some(item => Number(item.id) === Number(office.id));
        return <div className="ws-office-result" key={office.id}><div><strong><OfficeIdentity office={office}/></strong><span>{office.company_name || office.company?.name || ''}</span></div><button type="button" className="ws-cta" disabled={busy || joined} onClick={() => join(office)}>{t(joined ? 'officeAccess.connected' : 'officeAccess.join')}</button></div>;
      })}</div>}
      <h3>{t('officeAccess.memberships')}</h3>
      {offices.length ? <ul className="ws-office-membership-list">{offices.map(office => <li key={office.id}><OfficeIdentity office={office}/></li>)}</ul> : <p>{t('officeAccess.none')}</p>}
    </section>
  </div>;
}
