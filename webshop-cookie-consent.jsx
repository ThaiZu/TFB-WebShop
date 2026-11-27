import { useEffect, useRef, useState } from 'react';
import './webshop-cookie-consent.css';
import { PolicyLinks } from './webshop-policy-links.jsx';

export function CookieConsent() {
  const api = window.WSConsent;
  const [open, setOpen] = useState(() => !api?.get() || new URLSearchParams(location.search).get('cookies') === '1');
  const [details, setDetails] = useState(() => new URLSearchParams(location.search).get('cookies') === '1');
  const [analytics, setAnalytics] = useState(() => !!api?.get()?.analytics);
  const [storageError, setStorageError] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const [, refresh] = useState(0);
  const decisionSignature = useRef(JSON.stringify([api?.get(), api?.configuration()?.policyVersion || 'atelierby-2026-01']));
  const panel = useRef(null), trigger = useRef(null), returnFocus = useRef(null);
  const lang = window.WSI18n.getLang();
  const configuration = api?.configuration();
  const preview = typeof __WS_POLICY_PREVIEW__ !== 'undefined' && __WS_POLICY_PREVIEW__;
  const analyticsAvailable = configuration?.status === 'ready' && configuration?.integrations?.ga4?.enabled === true;
  const fallbackController = typeof __WS_POLICY_CONTROLLER__ !== 'undefined' ? __WS_POLICY_CONTROLLER__ : {};
  const controllerNotice = configuration?.controllerNotice?.[lang] || fallbackController[lang];
  const contact = configuration?.contact;
  const runtimeStatus = api?.status();
  const t = key => window.WSI18n.t('cookies.' + key);
  const show = () => {
    returnFocus.current = document.activeElement;
    const saved = api?.get();
    setAnalytics(!!saved?.analytics);
    setDetails(true); setOpen(true);
  };
  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.subscribe(value => {
      refresh(v => v + 1);
      const signature = JSON.stringify([value, api.configuration()?.policyVersion || 'atelierby-2026-01']);
      if (signature !== decisionSignature.current) {
        decisionSignature.current = signature;
        setAnalytics(!!value?.analytics);
        if (!value) setOpen(true);
      }
    });
    window.addEventListener('ws:consent-open', show);
    const unlang = window.WSI18n.onChange(() => refresh(v => v + 1));
    return () => { unsubscribe(); unlang(); window.removeEventListener('ws:consent-open', show); };
  }, []);
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
    else trigger.current?.focus({ preventScroll: true });
  }, [open, details]);
  const close = () => {
    setOpen(false);
    const target = returnFocus.current?.isConnected ? returnFocus.current : trigger.current;
    target?.focus({ preventScroll: true });
  };
  const save = next => {
    if (!api) return;
    const result = api.save({...next, analytics: analyticsAvailable && next.analytics === true});
    setStorageError(!result.persisted);
    close();
  };
  return <>
    {!open && <nav className="ws-policy-footer" aria-label={t('title')}>
      {/* One line « Cookies » that folds out the policies and the settings. Its open state
          lives here so it stays open when the settings panel closes and focus returns. */}
      <details className="ws-policy-drop" open={footerOpen} onToggle={e => setFooterOpen(e.currentTarget.open)}>
        <summary><span className="ws-policy-drop__ico" aria-hidden="true"/>{t('footer')}<span className="ws-policy-drop__chev" aria-hidden="true"/></summary>
        <div className="ws-policy-drop__list">
          <PolicyLinks configuration={configuration} preview={preview}/>
          <button ref={trigger} className="ws-cookie-settings" type="button" onClick={show}>{t('settings')}</button>
        </div>
      </details>
    </nav>}
    {runtimeStatus?.reloadRequired && !open && <p className="ws-cookie-storage" role="alert">{t('reloadRequired')}</p>}
    {storageError && !runtimeStatus?.reloadRequired && !open && <p className="ws-cookie-storage" role="status">{t('storage')}</p>}
    {open && <section ref={panel} tabIndex={-1} className="ws-cookie-panel" role="dialog" aria-modal="false" aria-labelledby="ws-cookie-title"
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <div className="ws-cookie-heading"><h2 id="ws-cookie-title">{t('title')}</h2><button type="button" onClick={close} aria-label={t('close')}>×</button></div>
      <p>{t(analyticsAvailable ? 'intro' : 'inactive')}</p>
      {runtimeStatus?.reloadRequired && <p role="alert">{t('reloadRequired')}</p>}
      {runtimeStatus?.cleanupIncomplete && <p role="status">{t('cleanupIncomplete')}</p>}
      {details && <div className="ws-cookie-details">
        {controllerNotice && <p>{controllerNotice}</p>}
        <p>{t('withdrawal')}</p>
        <p>{t('necessary')}</p>
        <label><input type="checkbox" disabled={!analyticsAvailable} checked={analyticsAvailable && analytics} onChange={e => setAnalytics(e.target.checked)}/><span>{t('analytics')}</span></label>
        <p>{t('duration')}</p>
        {contact?.verified && <p>{t('contact')} <a href={'mailto:' + contact.email}>{contact.email}</a></p>}
      </div>}
      {preview && <p>{t('policyPreview')}</p>}
      <p><PolicyLinks configuration={configuration} preview={preview}/></p>
      <div className="ws-cookie-actions" data-analytics={analyticsAvailable}>
        {!analyticsAvailable ? <>
          {!details && <button type="button" onClick={() => setDetails(true)}>{t('choose')}</button>}
          <button type="button" onClick={() => save({analytics:false,advertising:false})}>{t('acknowledge')}</button>
        </> : <>
        <button type="button" onClick={() => save({ analytics: false, advertising: false })}>{t('reject')}</button>
        <button type="button" onClick={() => details ? save({ analytics, advertising: false }) : setDetails(true)}>{t(details ? 'save' : 'choose')}</button>
        <button type="button" onClick={() => save({ analytics: true, advertising: false })}>{t('accept')}</button>
        </>}
      </div>
    </section>}
  </>;
}
