import {createPortal} from 'react-dom';
import {loyaltyPreview,loyaltyLineKey} from './webshop-loyalty-preview.js';
import './webshop-loyalty-shopping.css';

export const LoyaltyShoppingContext = React.createContext(null);

/** The same disclosure in catalogue, product sheet and basket. No local accrual rules. */
export function LoyaltyIcon({card, candidate, lineKeys, preview}) {
  const context=React.useContext(LoyaltyShoppingContext);
  const {t}=window.useT();
  const [open,setOpen]=React.useState(false), [revision,setRevision]=React.useState(0);
  const [badImage,setBadImage]=React.useState(null);
  const [result,setResult]=React.useState(null), [position,setPosition]=React.useState({top:80,left:12});
  const button=React.useRef(null), panel=React.useRef(null);
  const id=React.useId();
  const key=JSON.stringify([context?.scope,candidate,card?.id,revision]);
  const visible=Boolean(context?.enabled && card && (lineKeys || context.canPreview));
  const close=React.useCallback(()=>{setOpen(false);button.current?.focus();},[]);
  React.useEffect(()=>{setOpen(false);setResult(null);},[context?.identity,visible]);
  React.useEffect(()=>{
    if(!open || !visible || lineKeys) return;
    let alive=true;
    const controller=new AbortController();
    setResult({key,status:'loading'});
    if (!candidate) {setResult({key,status:'choice'});return;}
    const line={...candidate,line:'fidelity-preview',shopping_context:{mode:'standard'}};
    const timer=setTimeout(()=>{
      window.WSQuote.quote({...context.request,basket:[...context.basket,line],includeLoyalty:true,signal:controller.signal})
        .then(quote=>{if(alive)setResult({key,status:'ready',data:loyaltyPreview(quote?.loyalty_preview)});})
        .catch(()=>{if(alive)setResult({key,status:'error'});});
    },150);
    const ended=()=>{alive=false;controller.abort();setResult(null);setOpen(false);};
    window.addEventListener('ws:session-ended',ended);
    return()=>{alive=false;clearTimeout(timer);controller.abort();window.removeEventListener('ws:session-ended',ended);};
  },[open,visible,key,Boolean(lineKeys)]);
  React.useEffect(()=>{
    if(!open)return;
    const place=()=>{
      const rect=button.current?.getBoundingClientRect();
      if(!rect)return;
      const width=Math.min(320,window.innerWidth-24);
      setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),
        top:window.innerWidth<600 ? 72 : Math.max(12,Math.min(rect.bottom+8,window.innerHeight-360))});
    };
    const outside=e=>{if(!button.current?.contains(e.target)&&!panel.current?.contains(e.target))setOpen(false);};
    const keyboard=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
    place();
    panel.current?.querySelector('button')?.focus();
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',keyboard,true);
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keyboard,true);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[open,close]);
  if(!visible)return null;
  const state=lineKeys ? preview : result?.key===key ? result : null;
  const data=state?.status==='ready' ? loyaltyPreview(state.data) : null;
  const pointSummary=data?.points?.cardId===card.id?data.points:null;
  const summary=data?.cards.find(item=>item.id===card.id);
  const ownKeys=lineKeys || [loyaltyLineKey({line:'fidelity-preview'})];
  const increment=summary ? data.lines.filter(line=>line.cardId===card.id && ownKeys.includes(line.lineKey)).reduce((sum,line)=>sum+line.increment,0) : null;
  const tap=context.tap(()=>setOpen(value=>!value),{stop:true});
  const stop=e=>e.stopPropagation();
  return <span className="ws-loyalty-icon" onClick={stop} onPointerDown={stop} onTouchStart={stop} onTouchEnd={stop} onKeyDown={stop}>
    <button ref={element=>{button.current=element;tap.ref(element);}} type="button" className="ws-loyalty-icon__button" aria-label={t('loyaltyShop.open',{name:card.name})}
      aria-expanded={open} aria-controls={open?id:undefined}
      onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();setOpen(value=>!value);}}}
      style={{color:/^#[0-9a-f]{6}$/i.test(card.colorAccent||'')?card.colorAccent:undefined}}>
      {typeof card.imagePath==='string' && /^\/(?!\/)[a-zA-Z0-9_/-]+\.(png|jpg|jpeg|webp|svg)$/.test(card.imagePath) && badImage!==card.imagePath
        ? <img src={card.imagePath} alt="" width="20" height="20" onError={()=>setBadImage(card.imagePath)}/>
        : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m8 12 2 2 5-5"/></svg>}
    </button>
    {open && createPortal(<section ref={panel} id={id} className="ws-loyalty-popover" style={position} role="dialog" aria-labelledby={`${id}-title`} onClick={stop} onKeyDown={stop}>
      <div className="ws-loyalty-popover__head"><strong id={`${id}-title`}>{card.name}</strong><button type="button" onClick={close} aria-label={t('common.close2')}>×</button></div>
      <p>{t('loyaltyShop.rule')}</p>
      {!state || state.status==='loading' ? <p role="status">{t('loyaltyShop.loading')}</p>
        : state.status==='choice' ? <p>{t('loyaltyShop.choose')}</p>
        : state.status==='error' || !data || data.status==='unavailable' ? <><p role="status">{t('loyaltyShop.unavailable')}</p>{!lineKeys && <button type="button" onClick={()=>setRevision(value=>value+1)}>{t('loyaltyShop.retry')}</button>}</>
        : data.status==='excluded' ? <p>{t('loyaltyShop.excluded')}</p>
        : !summary ? <p>{pointSummary?t('loyaltyShop.pointsCart',{count:pointSummary.points}):t('loyaltyShop.notEligible')}</p>
        : <>
          {pointSummary&&<p>{t('loyaltyShop.pointsCart',{count:pointSummary.points})}</p>}<p>{t('loyaltyShop.line',{count:increment})}</p><p>{t('loyaltyShop.cart',{count:summary.increment})}</p>
          {data.status==='signIn' ? <p>{t('loyaltyShop.signIn')}</p> : <>
            <p className="ws-loyalty-popover__balance">{t('loyaltyShop.balance',{before:summary.before,after:summary.after,required:summary.required})}</p>
            {summary.newRewards>0 && <p>{t('loyaltyShop.gifts',{count:summary.newRewards})}</p>}
            <p>{t('loyaltyShop.remaining',{count:summary.remaining})}</p>
            {summary.before<0 && <p>{t('loyaltyShop.debt')}</p>}
            {summary.pendingEvents>0 && <p>{t('loyaltyShop.pending')}</p>}
          </>}
          <p className="ws-loyalty-popover__note">{t('loyaltyShop.estimate')}</p>
        </>}
      <button type="button" className="ws-loyalty-popover__link" onClick={()=>{setOpen(false);context.onOpenCards();}}>{t(context.userId?'loyaltyShop.cards':'loyaltyShop.login')}</button>
    </section>,document.body)}
  </span>;
}

export function LoyaltyBasketIcons({rows,quoteState}) {
  const context=React.useContext(LoyaltyShoppingContext);
  if(!context?.enabled)return null;
  const data=quoteState.status==='ready' ? loyaltyPreview(quoteState.quote?.loyalty_preview) : null;
  // Never display the previous basket's progress while its price is being recalculated.
  if(!data || !['available','signIn'].includes(data.status))return <small className="ws-loyalty-basket-status">{window.WSI18n.t(quoteState.status==='loading'?'loyaltyShop.loading':'loyaltyShop.unavailable')}</small>;
  const keys=rows.map(line=>loyaltyLineKey(line));
  return data.cards.filter(card=>data.lines.some(line=>line.cardId===card.id && keys.includes(line.lineKey))).map(card=>
    <LoyaltyIcon key={card.id} card={card} lineKeys={keys} preview={{status:'ready',data}}/>);
}
