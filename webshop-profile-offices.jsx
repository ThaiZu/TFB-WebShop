import { useEffect, useState } from 'react';

function OfficeLogo({ office }) {
  const [failed, setFailed] = useState(false);
  return <span className="ws-office-row__logo" aria-hidden="true">
    {office.logo_url && !failed
      ? <img src={office.logo_url} alt="" onError={() => setFailed(true)}/>
      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 9h5a1 1 0 0 1 1 1v11"/><path d="M2 21h20"/><path d="M8 8h2M8 12h2M8 16h2"/></svg>}
  </span>;
}

export function ProfileOffices({ currentShopName, onManage }) {
  const t = window.WSI18n.t;
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false);
    Promise.resolve().then(() => window.WSOffices.listAllMemberships())
      .then(result => { if (alive) setOffices(result); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [revision]);
  return <section className="ws-acc__section">
    <h3 className="ws-acc__section-h">{t('acc.offices.title')}</h3>
    <p className="ws-acc__hint">{t('acc.offices.allShops')}</p>
    {loading && <p role="status">{t('common.loading2')}</p>}
    {error && <div role="alert"><p>{t('officeAccess.loadError')}</p><button type="button" className="ws-cta ws-payment-refresh" onClick={() => setRevision(value => value + 1)}>{t('stock.refresh')}</button></div>}
    {!loading && !error && (offices.length ? <ul className="ws-office-list">{offices.map(office => <li className="ws-office-row" key={office.id}>
      <OfficeLogo office={office}/>
      <span className="ws-office-row__main">
        <strong>{office.name}</strong>
        <span>{t('acc.offices.shop', { name: office.shop_name || '' })}</span>
      </span>
      <span className="ws-office-row__state">{t('officeAccess.connected')}</span>
    </li>)}</ul> : <p>{t('officeAccess.none')}</p>)}
    {onManage && <button type="button" className="ws-cta ws-office-list__manage" onClick={onManage}>{t('acc.offices.manageShop', { name: currentShopName || '' })}</button>}
  </section>;
}
