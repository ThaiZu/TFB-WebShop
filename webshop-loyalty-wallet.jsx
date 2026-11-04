import {useLoyaltyPage} from './webshop-loyalty.jsx';
import {LoyaltyProgram} from './webshop-loyalty-program.jsx';
import {AccountVouchers} from './webshop-vouchers.jsx';
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
        if(!response.ok||data?.status!=='available'||!/^FID1-[0-9A-Z]{1,6}-[0-9A-F]{32}$/.test(data.code))throw new Error('LOYALTY_IDENTITY_UNAVAILABLE');
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
  const [selected,setSelected]=React.useState(null);
  const [view,setView]=React.useState('programs');
  const navigate=card=>{setSelected(card);dialog.current?.scrollTo({top:0});};
  React.useEffect(()=>{
    dialog.current?.querySelector(selected?'.ws-loyalty-wallet__back':'.ws-loyalty-wallet__identity')?.focus({preventScroll:true});
  },[selected]);
  const programs=useLoyaltyPage('cards',shopId,null,0);
  const activePrograms=programs.items.filter(card=>card.accepting);
  const svg=React.useMemo(()=>{
    if(identity.status!=='ready')return null;
    try{return window.QR?.render(identity.code,{size:260,margin:4,branded:false,color:'#000000',bg:'#ffffff'})||null;}catch{return null;}
  },[identity.status,identity.code]);
  React.useEffect(()=>{
    const node=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow;
    node.showModal();document.body.style.overflow='hidden';
    const ended=()=>onClose();window.addEventListener('ws:session-ended',ended);
    return()=>{window.removeEventListener('ws:session-ended',ended);document.body.style.overflow=overflow;node.close();previous?.focus?.();};
  },[]);
  return <dialog ref={dialog} className="ws-loyalty-wallet" aria-labelledby="ws-wallet-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{
    if(event.target!==dialog.current)return;const box=dialog.current.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();
  }}>
    <header><div><small>{t('loyaltyWallet.eyebrow')}</small><h2 id="ws-wallet-title">{t('loyaltyWallet.title')}</h2></div><button type="button" className="ws-loyalty-wallet__close" onClick={onClose} aria-label={t('loyaltyWallet.close')}>×</button></header>
    {selected?<>
      <nav className="ws-loyalty-wallet__navigation"><button type="button" className="ws-linkbtn ws-loyalty-wallet__back" onClick={()=>navigate(null)}>← {t('loyaltyHub.back')}</button><button type="button" className="ws-loyalty-wallet__show-qr" onClick={()=>navigate(null)}>{t('loyaltyHub.showQr')}</button></nav>
      <LoyaltyProgram key={selected.id} card={selected} shopId={shopId}/>
    </>:<>
    <section className="ws-loyalty-wallet__identity" tabIndex={-1} aria-label={t('loyaltyWallet.identity')}>
      <p>{user.firstName || user.name || ''}</p>
      {identity.status==='ready'&&svg?<>
        <div className="ws-loyalty-wallet__qr" role="img" aria-label={t('loyaltyWallet.qrAlt')} dangerouslySetInnerHTML={{__html:svg}}/>
        <code>{identity.code}</code>
      </>:identity.status==='error'||(identity.status==='ready'&&!svg)?<div role="alert"><p>{t('loyaltyWallet.error')}</p><button type="button" className="ws-linkbtn" onClick={identity.retry}>{t('loyalty.retry')}</button></div>:<div className="ws-loyalty-wallet__loading" role="status">{t('loyaltyWallet.loading')}</div>}
      <p className="ws-loyalty-wallet__hint">{t('loyaltyWallet.hint')}</p>
    </section>
    <div className="ws-loyalty-wallet__section-head">
      <button id="ws-wallet-programs" type="button" aria-pressed={view==='programs'} aria-controls="ws-wallet-content" onClick={()=>setView('programs')}>{t('loyaltyWallet.programs')}</button>
      <button id="ws-wallet-vouchers" type="button" aria-pressed={view==='vouchers'} aria-controls="ws-wallet-content" onClick={()=>setView('vouchers')}>{t('loyaltyWallet.vouchers')}</button>
    </div>
    <section id="ws-wallet-content" className="ws-loyalty-wallet__programs" aria-labelledby={view==='programs'?'ws-wallet-programs':'ws-wallet-vouchers'}>
      {view==='vouchers'?<AccountVouchers shopId={shopId} onUse={onUseVoucher} activeCode={activeVoucherCode} onClear={onClearVoucher} onViewed={onVouchersViewed} onBrowse={onBrowseVoucher}/>:<>
      {programs.status==='loading'&&<p role="status">{t('loyalty.loading')}</p>}
      {programs.error&&<div role="alert"><p>{t('loyalty.unavailable')}</p><button type="button" className="ws-linkbtn" onClick={programs.retry}>{t('loyalty.retry')}</button></div>}
      {programs.status==='ready'&&!activePrograms.length&&<p>{t('loyalty.empty')}</p>}
      {activePrograms.map(card=><button type="button" key={card.id} className="ws-loyalty-wallet__program" onClick={()=>navigate(card)} style={{'--wallet-fill':/^#[0-9a-f]{6}$/i.test(card.colorFill)?card.colorFill:'#8d142c'}}>
        <span className="ws-loyalty-wallet__program-title"><strong>{card.name}</strong><span>{card.progress}/{card.required} <span aria-hidden="true">›</span></span></span>
        <span className="ws-loyalty-wallet__stamps" aria-hidden="true">{Array.from({length:Math.min(card.required,10)},(_,index)=><span key={index} className={index<card.progress?'is-filled':''}>{index<card.progress?'✓':index+1}</span>)}</span>
        <small>{card.required} {t('loyalty.cardStamps')} = {card.rewardLabel}</small>
        {card.readyRewards>0&&<span className="ws-loyalty-wallet__reward-badge">{t('loyaltyHub.readyRewards',{count:card.readyRewards})}</span>}
        {!card.accepting&&<small>{t('loyalty.closed')}</small>}
        {card.debt>0&&<small>{t('loyalty.debt',{count:card.debt})}</small>}
        {card.pendingEvents>0&&<small>{t('loyalty.pending')}</small>}
      </button>)}
      {programs.nextCursor&&!programs.error&&<button type="button" className="ws-linkbtn" disabled={programs.busy} onClick={programs.more}>{t('loyalty.more')}</button>}
      </>}
    </section>
    </>}
  </dialog>;
}
