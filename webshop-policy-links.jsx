import {useEffect,useState} from 'react';
import {policyLinks} from './webshop-policy-links.js';
export function PolicyLinks({configuration=window.WSConsent?.configuration(),preview=false}) {
  const [lang,setLang]=useState(()=>window.WSI18n.getLang());
  useEffect(()=>window.WSI18n.onChange(setLang),[]);
  const base=(import.meta.env.BASE_URL||'/').replace(/\/?$/,'/');
  const published=typeof __WS_PUBLIC_POLICIES__!=='undefined'&&__WS_PUBLIC_POLICIES__;
  const links=policyLinks(lang,configuration,base,preview,published),t=k=>window.WSI18n.t('cookies.'+k);
  return <span className="ws-policy-links">
    {links.privacyUrl&&<a href={links.privacyUrl} target="_blank" rel="noopener noreferrer" aria-label={t('privacyPolicy')+' — '+t('newTab')}>{t('privacyPolicy')}</a>}
    {' '}
    {links.cookiesUrl&&<a href={links.cookiesUrl} target="_blank" rel="noopener noreferrer" aria-label={t('cookiePolicy')+' — '+t('newTab')}>{t('cookiePolicy')}</a>}
  </span>;
}
