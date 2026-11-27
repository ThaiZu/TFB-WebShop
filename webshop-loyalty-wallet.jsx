import {renderLoyaltyBarcode,isLoyaltyCardCode,isShortLoyaltyCardCode} from './webshop-loyalty-barcode.js';
import {PersonalLoyalty} from './webshop-personal-loyalty.jsx';
import {AccountVouchers} from './webshop-vouchers.jsx';
import {PointsIcon, BingoIcon, VoucherIcon} from './webshop-loyalty-icons.jsx';
import './webshop-loyalty-wallet.css';

export function LoyaltyCardIcon({size=26,active=false,updated=false}) {
  const {t}=window.useT();
  const [motion,setMotion]=React.useState(0);
  return <><span className={`ws-loyalty-shortcut${active?' is-active':''}`}>
    <svg className="ws-loyalty-shortcut__card" data-motion={motion} onAnimationIteration={()=>setMotion(value=>(value+1)%3)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="M3 9h18M6 14h5"/><circle cx="17" cy="14.5" r="1.5"/></svg>
  </span>{active&&<span className="ws-loyalty-shortcut__badge" role="img" aria-label={t('vouchers.active')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z"/><path d="m8 12 3 3 5-6"/></svg></span>}{updated&&<span className="ws-loyalty-shortcut__notice" role="img" aria-label={t('vouchers.new')}>!</span>}</>;
}

export function useLoyaltyIdentity(clientId,enabled) {
  const [revision,setRevision]=React.useState(0);
  const [state,setState]=React.useState(null);
  React.useEffect(()=>{
    if(!clientId||!enabled){setState(null);return;}
    let alive=true;const controller=new AbortController();
    setState({clientId,status:'loading'});
    const ended=()=>{alive=false;controller.abort();setState(null);};
    window.addEventListener('ws:session-ended',ended);
    window.WSAuth.authenticatedJson(`${__WS_API_BASE_URL__}/webshop/loyalty/identity`,{method:'GET',cache:'no-store',signal:controller.signal})
      .then(({response,data})=>{
        if(!alive)return;
        if(!response.ok||data?.status!=='available'||!isLoyaltyCardCode(data.code))throw new Error('LOYALTY_IDENTITY_UNAVAILABLE');
        setState({clientId,status:'ready',code:data.code});
      })
      .catch(error=>{if(alive&&error.name!=='AbortError')setState({clientId,status:'error'});});
    return()=>{alive=false;controller.abort();window.removeEventListener('ws:session-ended',ended);};
  },[clientId,enabled,revision]);
  return {...(enabled&&state?.clientId===clientId?state:{status:'loading'}),retry:()=>setRevision(value=>value+1)};
}


export function LoyaltyWallet({identity,shopId,user,onClose,onUseVoucher,activeVoucherCode,onClearVoucher,onVouchersViewed,onBrowseVoucher}) {
  const {t}=window.useT();
  const dialog=React.useRef(null);
  const [view,setView]=React.useState('programs');
  // A tap on Points / Bingo / Vouchers brings the tabs to the top of the sheet,
  // so what was asked for is in view (the code above can fill the whole phone).
  const tabs=React.useRef(null);
  const [viewTap,setViewTap]=React.useState(0);
  const pickView=next=>{setView(next);setViewTap(value=>value+1);};
  React.useEffect(()=>{
    // On a computer the card shows no code: the tabs are already at the top.
    if(!viewTap||window.matchMedia?.('(min-width: 900px)').matches)return;
    const box=dialog.current,head=tabs.current,content=document.getElementById('ws-wallet-content');
    if(!box||!head)return;
    // The title bar stays fixed at the top of the card: land the tabs just below it.
    const sticky=box.querySelector(':scope > header')?.offsetHeight||0;
    // Short content (a Bingo with two tasks) could not scroll that far: give it the room.
    if(content){
      const gap=content.getBoundingClientRect().top-head.getBoundingClientRect().bottom;
      const pad=parseFloat(getComputedStyle(box).paddingBottom)||0;
      content.style.minHeight=Math.max(0,box.clientHeight-head.offsetHeight-gap-pad-12-sticky)+'px';
    }
    const top=head.getBoundingClientRect().top-box.getBoundingClientRect().top+box.scrollTop-sticky-12;
    const still=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({top:Math.max(0,top),behavior:still?'auto':'smooth'});
  },[viewTap]);
  const [codeFormat,setCodeFormat]=React.useState('barcode');
  const [scanExpanded,setScanExpanded]=React.useState(false);
  const scanTrigger=React.useRef(null);
  const scanBack=React.useRef(null);
  const svg=React.useMemo(()=>{
    if(identity.status!=='ready')return null;
    try{return codeFormat==='barcode'?renderLoyaltyBarcode(identity.code):window.QR?.render(identity.code,{size:260,margin:4,branded:false,color:'#000000',bg:'#ffffff'})||null;}catch{return null;}
  },[identity.status,identity.code,codeFormat]);
  React.useEffect(()=>{
    if(!scanExpanded)return;
    scanBack.current?.focus();
    return()=>scanTrigger.current?.focus();
  },[scanExpanded]);
  React.useEffect(()=>{
    const node=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow;
    node.showModal();document.body.style.overflow='hidden';
    const ended=()=>onClose();window.addEventListener('ws:session-ended',ended);
    return()=>{window.removeEventListener('ws:session-ended',ended);document.body.style.overflow=overflow;node.close();previous?.focus?.();};
  },[]);
  return <dialog ref={dialog} className={`ws-loyalty-wallet${codeFormat==='barcode'?' ws-loyalty-wallet--barcode':''}${scanExpanded?' ws-loyalty-wallet--scan':''}`} aria-labelledby={scanExpanded?undefined:'ws-wallet-title'} aria-label={scanExpanded?t('loyaltyWallet.barcodeAlt'):undefined} onCancel={event=>{event.preventDefault();if(scanExpanded)setScanExpanded(false);else onClose();}} onClick={event=>{
    if(event.target!==dialog.current)return;const box=dialog.current.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();
  }}>
    {scanExpanded?<>
      <button ref={scanBack} type="button" className="ws-loyalty-wallet__scan-back" onClick={()=>setScanExpanded(false)}>← {t('loyaltyWallet.scanBack')}</button>
      <div className="ws-loyalty-wallet__scan-code" role="img" aria-label={t('loyaltyWallet.barcodeAlt')} dangerouslySetInnerHTML={{__html:svg}}/>
    </>:<>
    <header><div><h2 id="ws-wallet-title">{t('loyaltyWallet.title')}</h2></div><button type="button" className="ws-loyalty-wallet__close" onClick={onClose} aria-label={t('loyaltyWallet.close')}>×</button></header>
    <section className="ws-loyalty-wallet__identity" tabIndex={-1} aria-label={t('loyaltyWallet.identity')}>
      <p>{user.firstName || user.name || ''}</p>
      {identity.status==='ready'&&<div className="ws-loyalty-wallet__formats" role="group" aria-label={t('loyaltyWallet.codeFormat')}>
        <button type="button" aria-pressed={codeFormat==='barcode'} onClick={()=>setCodeFormat('barcode')}>{t('loyaltyWallet.barcode')}</button>
        <button type="button" aria-pressed={codeFormat==='qr'} onClick={()=>setCodeFormat('qr')}>{t('loyaltyWallet.qr')}</button>
      </div>}
      {identity.status==='ready'&&svg?<>
        <div className={codeFormat==='barcode'?'ws-loyalty-wallet__barcode':'ws-loyalty-wallet__qr'} role="img" aria-label={t(codeFormat==='barcode'?'loyaltyWallet.barcodeAlt':'loyaltyWallet.qrAlt')} dangerouslySetInnerHTML={{__html:svg}}/>
        {codeFormat==='barcode'&&!isShortLoyaltyCardCode(identity.code)&&<button ref={scanTrigger} type="button" className="ws-loyalty-wallet__expand" onClick={()=>setScanExpanded(true)}>{t('loyaltyWallet.scanExpand')}</button>}
        {codeFormat==='barcode'&&!isShortLoyaltyCardCode(identity.code)&&<p className="ws-loyalty-wallet__scan-hint">{t('loyaltyWallet.scanHint')}</p>}
      </>:identity.status==='error'||(identity.status==='ready'&&!svg)?<div role="alert"><p>{t('loyaltyWallet.error')}</p><button type="button" className="ws-linkbtn" onClick={identity.retry}>{t('loyalty.retry')}</button></div>:<div className="ws-loyalty-wallet__loading" role="status">{t('loyaltyWallet.loading')}</div>}
    </section>
    <div ref={tabs} className="ws-loyalty-wallet__section-head">
      <button id="ws-wallet-programs" type="button" aria-pressed={view==='programs'} aria-controls="ws-wallet-content" onClick={()=>pickView('programs')}><PointsIcon/>{t('personal.points')}</button>
      <button id="ws-wallet-bingo" type="button" aria-pressed={view==='bingo'} aria-controls="ws-wallet-content" onClick={()=>pickView('bingo')}><BingoIcon/>Bingo</button>
      <button id="ws-wallet-vouchers" type="button" aria-pressed={view==='vouchers'} aria-controls="ws-wallet-content" onClick={()=>pickView('vouchers')}><VoucherIcon/>{t('loyaltyWallet.vouchers')}</button>
    </div>
    <section id="ws-wallet-content" className="ws-loyalty-wallet__programs" aria-labelledby={'ws-wallet-' + view}>
      {view === 'vouchers'
        ? <AccountVouchers shopId={shopId} onUse={onUseVoucher} activeCode={activeVoucherCode} onClear={onClearVoucher} onViewed={onVouchersViewed} onBrowse={onBrowseVoucher}/>
        : <PersonalLoyalty view={view}/>}
    </section>
    </>}
  </dialog>;
}
