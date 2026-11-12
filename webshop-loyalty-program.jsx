import {LoyaltyProgramArtwork} from './webshop-loyalty-points.jsx';
import {readLoyaltyProgram} from './webshop-loyalty-api.js';
import {CardDetails,LoyaltyCardArtwork} from './webshop-loyalty.jsx';

export function LoyaltyProgram({card,shopId}) {
  const {t,lang}=window.useT();
  const [revision,setRevision]=React.useState(0);
  const [state,setState]=React.useState({status:'loading'});
  const [search,setSearch]=React.useState('');
  const [limit,setLimit]=React.useState(20);
  React.useEffect(()=>{
    let alive=true;const controller=new AbortController();
    setState({status:'loading'});
    const ended=()=>{alive=false;controller.abort();setState({status:'signedOut'});};
    window.addEventListener('ws:session-ended',ended);
    readLoyaltyProgram({shopId,cardId:card.id},controller.signal).then(data=>{if(alive)setState({status:'ready',data});})
      .catch(error=>{if(alive&&error.name!=='AbortError')setState({status:error.status===401||error.code==='SESSION_CHANGED'?'signedOut':'error'});});
    return()=>{alive=false;controller.abort();window.removeEventListener('ws:session-ended',ended);};
  },[shopId,card.id,revision]);
  const date=value=>new Intl.DateTimeFormat(lang,{dateStyle:'medium'}).format(new Date(value));
  const data=state.data;
  const products=data?.products.filter(item=>item.name.toLocaleLowerCase(lang).includes(search.trim().toLocaleLowerCase(lang)))||[];
  return <div className="ws-loyalty ws-loyalty-wallet__detail">
    <details className="ws-loyalty-wallet__panel ws-loyalty-wallet__card" open>
    <summary>{card.name}</summary>
    <LoyaltyProgramArtwork card={card} shopId={shopId} t={t} lang={lang} StampArtwork={LoyaltyCardArtwork}/>
    {card.stampsEnabled!==false&&<p className="ws-loyalty-wallet__progress">{t('loyaltyHub.progress',{count:card.progress,required:card.required})}</p>}
    {!card.accepting&&<p>{t('loyalty.closed')}</p>}
    {card.debt>0&&<p>{t('loyalty.debt',{count:card.debt})}</p>}
    {card.pendingEvents>0&&<p role="status">{t('loyalty.pending')}</p>}
    </details>
    {state.status==='loading'&&<p role="status">{t('loyalty.loading')}</p>}
    {state.status==='signedOut'&&<p role="status">{t('loyalty.signIn')}</p>}
    {state.status==='error'&&<div role="alert"><p>{t('loyalty.unavailable')}</p><button className="ws-linkbtn" type="button" onClick={()=>setRevision(value=>value+1)}>{t('loyalty.retry')}</button></div>}
    {data&&<>
      <details className="ws-loyalty-wallet__panel">
        <summary>{t('loyaltyHub.rules')}</summary>
        <section aria-label={t('loyaltyHub.rules')}>
        {card.stampsEnabled!==false&&<><p>{t('loyaltyHub.earning')}</p><p>{t(data.rewardValidityDays===0?'loyaltyHub.rewardNoExpiry':'loyaltyHub.reward',{count:card.required,reward:card.rewardLabel,days:data.rewardValidityDays})}</p></>}
        <p>{t('loyaltyHub.starts',{date:date(data.startsAt)})}<br/>{data.endsAt?t('loyaltyHub.ends',{date:date(data.endsAt)}):t('loyaltyHub.noEnd')}</p>
        <h4>{t('loyaltyHub.shops')}</h4><ul>{card.shops.map(shop=><li key={shop.id}>{shop.name}</li>)}</ul>
        </section>
      </details>
      <details className="ws-loyalty-wallet__panel">
        <summary>{t('loyaltyHub.products')}</summary>
        <section aria-label={t('loyaltyHub.products')}>
        <p className="ws-loyalty-wallet__note">{t('loyaltyHub.productHint')}</p>
        {data.categories.length>0&&<p><strong>{t('loyaltyHub.categories')}: </strong>{data.categories.map(item=>item.name).join(', ')}</p>}
        {data.excludedProducts.length>0&&<p><strong>{t('loyaltyHub.excluded')}: </strong>{data.excludedProducts.map(item=>item.name).join(', ')}</p>}
        <label className="ws-loyalty-wallet__search">{t('loyaltyHub.search')}<input type="search" value={search} onChange={event=>{setSearch(event.target.value);setLimit(20);}}/></label>
        <p className="ws-loyalty-wallet__note">{t('loyaltyHub.count',{count:products.length})}</p>
        {!products.length&&<p>{t('loyaltyHub.noProducts')}</p>}
        <ul className="ws-loyalty-wallet__products">{products.slice(0,limit).map(item=><li key={item.id}>{item.name}</li>)}</ul>
        {products.length>limit&&<button type="button" className="ws-linkbtn" onClick={()=>setLimit(value=>value+20)}>{t('loyalty.more')}</button>}
        </section>
      </details>
      <details className="ws-loyalty-wallet__panel">
        <summary>{t('loyaltyHub.rewardChoices')}</summary>
        <section aria-label={t('loyaltyHub.rewardChoices')}>
        <p className="ws-loyalty-wallet__note">{t('loyaltyHub.rewardHint')}</p>
        <ul>{data.rewardChoices.map(item=><li key={`${item.portion===null?'product':'portion'}:${item.id}`}>{item.name} <span>{item.portion===null?t('loyaltyHub.whole'):item.portion}</span></li>)}</ul>
        </section>
      </details>
    </>}
    <button type="button" className="ws-linkbtn" onClick={()=>window.dispatchEvent(new CustomEvent('ws:open-vouchers'))}>{t('vouchers.open')}</button>
    {card.stampsEnabled!==false&&<CardDetails card={card} shopId={shopId} revision={0} t={t} lang={lang} collapseHistory showRewards={false}/>}
  </div>;
}
