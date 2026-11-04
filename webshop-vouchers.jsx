import {prepareVouchers,readVouchers} from './webshop-vouchers-api.js';
import './webshop-vouchers.css';

export function AccountVouchers({shopId,onUse,activeCode,onClear,onViewed,onBrowse}) {
  const {t,lang}=window.useT();
  const [revision,setRevision]=React.useState(0);
  const [state,setState]=React.useState({status:'loading',items:[],nextCursor:null,busy:false});
  const loadRef=React.useRef(null);
  const viewedRef=React.useRef(onViewed);
  viewedRef.current=onViewed;
  const [showAll,setShowAll]=React.useState(false);
  const [now,setNow]=React.useState(Date.now());
  React.useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  React.useEffect(()=>{
    if(!shopId)return;
    let alive=true,busy=false;
    const controller=new AbortController();
    setState({status:'loading',items:[],nextCursor:null,busy:false});
    async function load(cursor=null) {
      if(!alive||busy)return;
      busy=true;setState(previous=>({...previous,busy:true,error:false}));
      try {
        if(!cursor){let result;do{result=await prepareVouchers(controller.signal);}while(alive&&result.hasMore);}
        if(!alive)return;
        const data=await readVouchers(shopId,cursor,controller.signal);
        if(!alive)return;
        setState(previous=>({status:'ready',items:cursor?[...previous.items,...data.items]:data.items,nextCursor:data.nextCursor,
          busy:false,error:false,clockOffset:Date.parse(data.asOf)-Date.now()}));
        viewedRef.current?.();
      } catch(error) {
        if(!alive||error.name==='AbortError')return;
        if(error.status===401||error.code==='SESSION_CHANGED')setState({status:'signedOut',items:[],nextCursor:null,busy:false});
        else setState(previous=>({...previous,status:cursor?'ready':'error',busy:false,error:true}));
      } finally {busy=false;}
    }
    const ended=()=>{alive=false;controller.abort();setState({status:'signedOut',items:[],nextCursor:null,busy:false});};
    window.addEventListener('ws:session-ended',ended);
    loadRef.current=load;load();
    return()=>{alive=false;controller.abort();window.removeEventListener('ws:session-ended',ended);};
  },[shopId,revision]);
  React.useEffect(()=>{
    const starts=state.items.filter(voucher=>voucher.status==='UPCOMING'&&voucher.validFrom).map(voucher=>Date.parse(voucher.validFrom));
    if(!starts.length)return;
    const delay=Math.min(...starts)-Date.now()-(state.clockOffset||0);
    const timer=setTimeout(()=>setRevision(value=>value+1),Math.max(1000,Math.min(delay,2147483647)));
    return()=>clearTimeout(timer);
  },[state.items,state.clockOffset]);
  const currentTime=now+(state.clockOffset||0);
  const availableVouchers=state.items.filter(voucher=>voucher.status==='READY'&&voucher.canUse
    &&(!voucher.validFrom||Date.parse(voucher.validFrom)<=currentTime)
    &&(!voucher.validTo||Date.parse(voucher.validTo)>currentTime));
  const visibleVouchers=showAll?state.items:availableVouchers;
  const hiddenCount=state.items.length-availableVouchers.length;
  const formatDate=value=>new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  if(!shopId)return <p>{t('loyalty.chooseShop')}</p>;
  return <section className="ws-vouchers" aria-label={t('vouchers.title')}>
    <div className="ws-vouchers__heading"><h3>{t('vouchers.title')}</h3><button type="button" className="ws-linkbtn" disabled={state.busy} onClick={()=>setRevision(value=>value+1)}>{t('loyalty.refresh')}</button></div>
    {state.status==='ready'&&(hiddenCount>0||showAll)&&<div className="ws-vouchers__filter"><span>{!showAll&&t('vouchers.hidden',{count:hiddenCount})}</span><button type="button" className="ws-linkbtn" aria-pressed={showAll} onClick={()=>setShowAll(value=>!value)}>{t(showAll?'vouchers.onlyAvailable':'vouchers.showAll')}</button></div>}
    {activeCode&&<div className="ws-vouchers__selection" role="status"><span>{t('vouchers.selectedInfo')}</span><button type="button" className="ws-linkbtn" onClick={onClear}>{t('vouchers.clear')}</button></div>}
    {state.status==='loading'&&<p role="status">{t('loyalty.loading')}</p>}
    {state.status==='signedOut'&&<p role="status">{t('loyalty.signIn')}</p>}
    {state.error&&<div role="alert"><p>{t('vouchers.error')}</p><button type="button" className="ws-linkbtn" disabled={state.busy} onClick={()=>loadRef.current?.(state.items.length?state.nextCursor:null)}>{t('loyalty.retry')}</button></div>}
    {state.status==='ready'&&!visibleVouchers.length&&!state.nextCursor&&<p>{t(hiddenCount?'vouchers.noAvailable':'vouchers.empty')}</p>}
    <div className="ws-vouchers__list">{visibleVouchers.map(voucher=>{
      const selected=activeCode===voucher.code;
      const usable=availableVouchers.includes(voucher);
      const status=voucher.validTo&&Date.parse(voucher.validTo)<=currentTime?'EXPIRED':voucher.status;
      const browseTargets=[...(voucher.targets?.products||[]).map(target=>({...target,kind:'product'})),
        ...(voucher.targets?.categories||[]).map(target=>({...target,kind:'category'}))]
        .filter((target,index,items)=>items.findIndex(item=>item.kind===target.kind&&item.id===target.id)===index);
      return <article className={`ws-vouchers__item${selected?' is-selected':''}${activeCode&&!selected?' is-locked':''}`} key={voucher.id}>
        <div className="ws-vouchers__main"><h4>{voucher.name}</h4>{usable?<button type="button" className="ws-cta" disabled={!!activeCode} onClick={()=>onUse(voucher.code,voucher.name,voucher.targets)}>{t(selected?'vouchers.selected':'vouchers.use')}</button>:<small className="ws-vouchers__status">{t(status==='READY'?'vouchers.otherShop':`vouchers.status.${status}`)}</small>}</div>
        <div className="ws-vouchers__meta"><small>{status==='UPCOMING'&&voucher.validFrom&&<>{t('vouchers.starts',{date:formatDate(voucher.validFrom)})}<br/></>}{voucher.validTo?t('vouchers.expires',{date:formatDate(voucher.validTo)}):t('loyalty.noExpiry')}</small><code>{voucher.code}</code></div>
        {onBrowse&&browseTargets.length>0&&<div className="ws-vouchers__browse">{browseTargets.map(target=><button type="button" className="ws-linkbtn" key={`${target.kind}:${target.id}`} onClick={()=>onBrowse(target)}>{browseTargets.length===1?t(target.kind==='product'?'vouchers.seeProduct':'vouchers.seeProducts'):target.name}</button>)}</div>}
      </article>;
    })}</div>
    {state.nextCursor&&!state.error&&<button type="button" className="ws-linkbtn" disabled={state.busy} onClick={()=>loadRef.current?.(state.nextCursor)}>{t('loyalty.more')}</button>}
  </section>;
}
