import {LoyaltyProgramArtwork} from './webshop-loyalty-points.jsx';
import {readLoyaltyPage} from './webshop-loyalty-api.js';
import './webshop-loyalty.css';
import fidelityLogo from './assets/fidelity/logo.jpg';

export function useLoyaltyPage(kind, shopId, cardId, revision, enabled=true) {
  const key = `${kind}:${shopId}:${cardId || ''}:${revision}:${enabled}`;
  const empty = {key, status:'loading', items:[], nextCursor:null, busy:false, error:false};
  const [state,setState] = React.useState(empty);
  const request = React.useRef(null);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true, busy = false;
    const controller = new AbortController();
    setState({key,status:'loading',items:[],nextCursor:null,busy:false,error:false});
    const load = async (cursor = null, append = false) => {
      if (!alive || busy) return;
      busy = true;
      setState(previous => ({...previous,busy:true,error:false}));
      try {
        const data = await readLoyaltyPage(kind,{shopId,cardId,cursor},controller.signal);
        if (!alive) return;
        setState(previous => ({key,status:'ready',items:append ? [...previous.items,...data.items] : data.items,
          nextCursor:data.nextCursor,busy:false,error:false,clockOffset:Date.parse(data.asOf)-Date.now()}));
      } catch (error) {
        if (!alive || error.name === 'AbortError') return;
        if (error.code === 'SESSION_CHANGED' || error.status === 401) {
          setState({key,status:'signedOut',items:[],nextCursor:null,busy:false,error:false});
        } else setState(previous => ({...previous,status:append ? 'ready' : 'error',busy:false,error:true}));
      } finally { busy = false; }
    };
    const ended = () => {
      alive = false; controller.abort();
      setState({key,status:'signedOut',items:[],nextCursor:null,busy:false,error:false});
    };
    request.current = load;
    window.addEventListener('ws:session-ended',ended);
    load();
    return () => { alive = false; controller.abort(); window.removeEventListener('ws:session-ended',ended); };
  },[key,kind,shopId,cardId,revision,enabled]);
  const current = state.key === key ? state : empty;
  return {...current, more:() => request.current?.(current.nextCursor,true), retry:() => request.current?.(current.nextCursor,current.items.length > 0)};
}

export function PageFeedback({page,t}) {
  if (page.status === 'loading') return <p role="status">{t('loyalty.loading')}</p>;
  if (page.status === 'signedOut') return <p role="status">{t('loyalty.signIn')}</p>;
  if (!page.error) return null;
  return <div role="alert"><p>{t('loyalty.unavailable')}</p><button type="button" className="ws-linkbtn" disabled={page.busy} onClick={page.retry}>{t('loyalty.retry')}</button></div>;
}

export function More({page,t}) {
  return page.nextCursor && !page.error ? <button type="button" className="ws-linkbtn" disabled={page.busy} onClick={page.more}>{t(page.busy ? 'loyalty.loading' : 'loyalty.more')}</button> : null;
}

export function CardDetails({card,shopId,revision,t,lang,collapseHistory=false,showRewards=true}) {
  const [historyOpen,setHistoryOpen] = React.useState(!collapseHistory);
  const HistoryContainer=collapseHistory?'details':'div';
  const rewards = useLoyaltyPage('rewards',shopId,card.id,revision,showRewards&&card.stampsEnabled!==false);
  const history = useLoyaltyPage('history',shopId,card.id,revision,historyOpen&&card.stampsEnabled!==false);
  const [now,setNow] = React.useState(Date.now());
  React.useEffect(() => { if (!showRewards) return; const timer = setInterval(() => setNow(Date.now()),1000); return () => clearInterval(timer); },[showRewards]);
  const date = value => new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'long'}).format(new Date(value));
  return <div className="ws-loyalty__details">
    {showRewards && <section aria-label={t('loyalty.rewards')}>
      <h3>{t('loyalty.rewards')}</h3><p>{card.rewardLabel}</p>
      <PageFeedback page={rewards} t={t}/>
      {rewards.status === 'ready' && !rewards.items.length && <p>{t('loyalty.noRewards')}</p>}
      {rewards.items.map(reward => {
        const status = reward.status === 'READY' && reward.expiresAt && Date.parse(reward.expiresAt) <= now+(rewards.clockOffset || 0) ? 'EXPIRED' : reward.status;
        return <article className="ws-loyalty__reward" key={reward.id}>
          <strong>{t(`loyalty.status.${status}`)}</strong>
          <p>{t('loyalty.earned',{date:date(reward.earnedAt)})}</p>
          <p>{reward.expiresAt ? t('loyalty.expires',{date:date(reward.expiresAt)}) : t('loyalty.noExpiry')}</p>
          {status === 'RESERVED' && <p>{t('loyalty.reservedHint')}</p>}
          {status === 'READY' && <button type="button" className="ws-linkbtn" onClick={()=>window.dispatchEvent(new CustomEvent('ws:open-vouchers'))}>{t('vouchers.open')}</button>}
        </article>;
      })}
      <More page={rewards} t={t}/>
    </section>}
    <HistoryContainer {...(collapseHistory?{open:historyOpen,onToggle:event=>setHistoryOpen(event.currentTarget.open)}:{})}>
      {collapseHistory&&<summary>{t('loyalty.history')}</summary>}
    {historyOpen && <section aria-label={t('loyalty.history')}>
      <h3>{t('loyalty.history')}</h3><PageFeedback page={history} t={t}/>
      {history.status === 'ready' && !history.items.length && <p>{t('loyalty.noHistory')}</p>}
      <ol className="ws-loyalty__history">{history.items.map(entry => <li key={entry.id}>
        <div><strong>{t(`loyalty.kind.${entry.kind}`)}</strong><time dateTime={entry.occurredAt}>{date(entry.occurredAt)}</time></div>
        <div><b>{entry.delta > 0 ? '+' : ''}{entry.delta}</b><small>{t('loyalty.balanceAfter',{balance:entry.balanceAfter})}</small></div>
      </li>)}</ol>
      <More page={history} t={t}/>
    </section>}
    </HistoryContainer>
  </div>;
}

export function AccountLoyalty({shopId,shopName,initialCardId=null}) {
  const {t,lang} = window.useT();
  const [revision,setRevision] = React.useState(0);
  const [selected,setSelected] = React.useState(initialCardId);
  React.useEffect(()=>setSelected(initialCardId),[initialCardId]);
  if (!shopId) return <p>{t('loyalty.chooseShop')}</p>;
  return <LoyaltyCards key={String(shopId)} {...{shopId,shopName,revision,selected,setSelected,t,lang}} onRefresh={() => setRevision(value => value+1)}/>;
}

export function LoyaltyCardArtwork({card,t}) {
  const safeColor=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  const custom=typeof card.imagePath==='string' && /^\/(?!\/)[a-zA-Z0-9_/-]+\.(png|jpg|jpeg|webp|svg)$/.test(card.imagePath);
  const [failedImage,setFailedImage]=React.useState(null);
  let image=fidelityLogo;
  if(custom && failedImage!==card.imagePath){
    try {
      const url=new URL(card.imageUrl || '/shared-assets'+card.imagePath,new URL(__WS_API_BASE_URL__,window.location.origin));
      if(['http:','https:'].includes(url.protocol))image=url.href;
    } catch { /* Use the same default brand logo as the administrator preview. */ }
  }
  const total=Math.min(card.required,20),filled=Math.min(card.progress,card.required);
  return <div className="ws-loyalty__artwork" style={{'--card-tint':safeColor(card.colorTint,'#fbf3e7'),'--card-fill':safeColor(card.colorFill,'#8d142c'),'--card-accent':safeColor(card.colorAccent,'#573a23')}}>
    <img className="ws-loyalty__logo" src={image} alt="" onError={()=>{if(image!==fidelityLogo)setFailedImage(card.imagePath);}}/>
    <h3>{card.name}</h3>
    <div className="ws-loyalty__tagline">{t('loyalty.cardTagline')}</div>
    <div className="ws-loyalty__stamps" role="img" aria-label={t('loyalty.progress',{count:card.progress,required:card.required})}>
      {Array.from({length:total},(_,index)=><span key={index} aria-hidden="true" className={'ws-loyalty__stamp'+(index<filled?' is-filled':'')}>
        {index<filled?<span className="ws-loyalty__croissant"/>:index+1}
      </span>)}
    </div>
    {card.required>20 && <p className="ws-loyalty__stamp-limit">{t('loyalty.cardStampLimit',{count:20})}</p>}
    <div className="ws-loyalty__reward-band"><span className="ws-loyalty__croissant" aria-hidden="true"/><span>{card.required} {t('loyalty.cardStamps')} = {card.rewardLabel}</span></div>
    <p className="ws-loyalty__thanks">{t('loyalty.cardThanks')} <span aria-hidden="true">♡</span></p>
  </div>;
}

function LoyaltyCards({shopId,shopName,revision,selected,setSelected,t,lang,onRefresh}) {
  const page = useLoyaltyPage('cards',shopId,null,revision);
  const card = page.items.find(item => item.id === selected);
  return <section className="ws-loyalty" aria-label={t('loyalty.title')}>
    <div className="ws-loyalty__head"><h3>{t('loyalty.title')}</h3><button type="button" className="ws-linkbtn" disabled={page.busy} onClick={onRefresh}>{t('loyalty.refresh')}</button></div>
    <p className="ws-loyalty__shop">{shopName}</p>
    <PageFeedback page={page} t={t}/>
    {page.status === 'ready' && !page.items.length && <p>{t('loyalty.empty')}</p>}
    {card && <button type="button" className="ws-linkbtn" onClick={() => setSelected(null)}>{t('loyalty.back')}</button>}
    {(card ? [card] : page.items).map(item => <article className="ws-loyalty__card" key={item.id}>
      <LoyaltyProgramArtwork card={item} shopId={shopId} t={t} lang={lang} compact={!card} StampArtwork={LoyaltyCardArtwork}/>
      <div className="ws-loyalty__card-meta">
      <p>{item.scope === 'NETWORK' ? t('loyalty.network') + ' · ' : ''}{item.shops.map(shop => shop.name).join(', ')}</p>
      {!item.accepting && <p className="ws-loyalty__note">{t('loyalty.closed')}</p>}
      {item.stampsEnabled!==false&&<strong className="ws-loyalty__balance">{t('loyalty.progress',{count:item.progress,required:item.required})}</strong>}
      {item.debt > 0 && <p className="ws-loyalty__note">{t('loyalty.debt',{count:item.debt})}</p>}
      {item.pendingEvents > 0 && <p role="status">{t('loyalty.pending')}</p>}
      {!card && <button type="button" className="ws-linkbtn" onClick={() => setSelected(item.id)}>{t('loyalty.details')}</button>}
      </div>
    </article>)}
    {card && card.stampsEnabled!==false ? <CardDetails key={`${card.id}:${revision}`} {...{card,shopId,revision,t,lang}}/> : <More page={page} t={t}/>}
  </section>;
}
