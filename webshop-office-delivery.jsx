import { useEffect, useRef, useState } from 'react';

export function OfficeDeliveryModal({ open, shopId, officeId, selectedOfficeId, selectedSiteId, clearBasket, onClose, onConfirm, onManageOffices }) {
  const t = (key) => window.WSI18n.t(key);
  const [offices, setOffices] = useState([]);
  const [chosen, setChosen] = useState('');
  const [data, setData] = useState(null);
  const [siteId, setSiteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const panel = useRef(null);
  const preference = useRef(null);
  const [saveDefault, setSaveDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    panel.current?.focus();
    return () => previous?.focus?.();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setOffices([]); setChosen(''); setData(null); setSiteId(''); setError(''); setBusy(true);
    setSaveDefault(true);
    Promise.all([window.WSOffices.listMemberships(shopId), window.WSOffices.deliveryPreference(shopId)]).then(([rows, saved]) => {
      if (!alive) return;
      preference.current = saved;
      const allowed = rows.filter(o => o.status === 'active' && (!officeId || Number(o.id) === Number(officeId)));
      setOffices(allowed);
      setChosen(String(allowed.find(o => Number(o.id) === Number(selectedOfficeId))?.id || allowed.find(o => Number(o.id) === Number(saved?.officeId))?.id || allowed[0]?.id || ''));
    }).catch(() => { if (alive) setError('officeDelivery.loadError'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [open, shopId, officeId, retry]);
  useEffect(() => {
    if (!open || !chosen) return;
    let alive = true;
    setData(null); setSiteId(''); setError(''); setBusy(true);
    window.WSOffices.delivery({shop: shopId, officeId: chosen}).then(result => {
      if (!alive) return;
      setData(result);
      const sites = result.sites.filter(site => site.routes.length > 0);
      setSiteId(String(sites.find(s => Number(s.id) === Number(selectedSiteId) && Number(chosen) === Number(selectedOfficeId))?.id || sites.find(s => Number(s.id) === Number(preference.current?.siteId) && Number(chosen) === Number(preference.current?.officeId))?.id || sites[0]?.id || ''));
    }).catch(() => { if (alive) setError('officeDelivery.loadError'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [open, chosen, shopId]);
  async function confirm() {
    if (saving || !data || !siteId) return;
    setSaving(true); setError('');
    try {
      if (saveDefault) await window.WSOffices.saveDeliveryPreference(shopId, Number(chosen), Number(siteId));
      await onConfirm(data, Number(siteId));
    } catch (_) { setError('officeDelivery.saveError'); }
    finally { setSaving(false); }
  }
  if (!open) return null;
  const sites = data?.sites.filter(site => site.routes.length > 0) || [];
  return <div className="ws-office-overlay" onClick={e => { if (!saving && e.target === e.currentTarget) onClose(); }}>
    <section className="ws-office-modal" role="dialog" aria-modal="true" aria-labelledby="ws-delivery-title" tabIndex={-1} ref={panel}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); if (!saving) onClose(); }
        if (e.key === 'Tab') {
          const fields = [...e.currentTarget.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled)')];
          const first = fields[0], last = fields[fields.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="ws-office-heading"><h2 id="ws-delivery-title">{t('officeDelivery.title')}</h2><button type="button" disabled={saving} onClick={onClose} aria-label={t('common.close2')}>×</button></div>
      <p>{t('officeDelivery.intro')}</p>
      {busy && <p role="status">{t('common.loading2')}</p>}
      {error && <p role="alert" className="ws-co-error">{t(error)} <button type="button" onClick={() => setRetry(n => n + 1)}>{t('co.slot.retry')}</button></p>}
      {!busy && !error && !offices.length && <p>{t('officeDelivery.noOffices')} <button type="button" className="ws-office-manage-action" onClick={onManageOffices}>{t('officeAccess.title')}</button></p>}
      {offices.length > 0 && <label className="ws-field"><span>{t('officeDelivery.office')}</span><select value={chosen} disabled={busy || saving} onChange={e => { setData(null); setSiteId(''); setChosen(e.target.value); }}>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
      {!busy && data && !sites.length && <p role="status">{t('officeDelivery.noSites')}</p>}
      {sites.length > 0 && <label className="ws-field"><span>{t('co.delivery.address')}</span><select value={siteId} disabled={saving} onChange={e => setSiteId(e.target.value)}>{sites.map(s => <option key={s.id} value={s.id}>{s.name} — {s.address}</option>)}</select></label>}
      {clearBasket && <p>{t('officeDelivery.clearBasket')}</p>}
      {sites.length > 0 && <label className="ws-acc__toggle"><input type="checkbox" role="switch" checked={saveDefault} disabled={saving} onChange={event => setSaveDefault(event.target.checked)}/><span className="ws-acc__toggle-track" aria-hidden="true"><span className="ws-acc__toggle-thumb"/></span><span className="ws-acc__toggle-label">{t('officeDelivery.saveDefault')}</span></label>}
      <div className="ws-office-confirm-actions"><button type="button" className="ws-office-secondary" disabled={saving} onClick={onClose}>{t('common.cancel2')}</button><button type="button" className="ws-cta" disabled={saving || busy || (!!error && error !== 'officeDelivery.saveError') || !data || !siteId} onClick={confirm}>{saving ? t('common.loading2') : t(clearBasket ? 'officeAccess.menuConfirm' : 'officeDelivery.confirm')}</button></div>
    </section>
  </div>;
}
