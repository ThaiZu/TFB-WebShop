import { useEffect, useState } from 'react';

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
    {!loading && !error && (offices.length ? offices.map(office => <div className="ws-acc__card" key={office.id}>
      <strong>{office.name}</strong>
      <p>{t('acc.offices.shop', { name: office.shop_name || '' })}</p>
    </div>) : <p>{t('officeAccess.none')}</p>)}
    {onManage && <button type="button" className="ws-cta" onClick={onManage}>{t('acc.offices.manageShop', { name: currentShopName || '' })}</button>}
  </section>;
}
