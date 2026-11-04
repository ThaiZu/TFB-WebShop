import {useCallback,useEffect,useState} from 'react';

const pendingAwards=new Set();

export function voucherAwardCount(order) {
  return order?.payment?.status==='paid'&&Array.isArray(order.rewardVouchers)
    ?order.rewardVouchers.filter(voucher=>voucher&&!['DISABLED','REVOKED'].includes(voucher.status)).length:0;
}

export function announceVoucherAwards(order) {
  if(!voucherAwardCount(order)
    ||!/^WEB-\d+-\d{8}-[A-F0-9]{6}$/.test(order.orderRef||''))return;
  pendingAwards.add(order.orderRef);
  window.dispatchEvent(new CustomEvent('ws:vouchers-issued',{detail:{orderRef:order.orderRef}}));
}

export function useVoucherNotifications(clientId) {
  const [state,setState]=useState({clientId:null,seen:[],unread:[]});
  useEffect(()=>{
    const ended=()=>pendingAwards.clear();
    window.addEventListener('ws:session-ended',ended);
    return()=>window.removeEventListener('ws:session-ended',ended);
  },[]);
  useEffect(()=>{
    const empty={clientId,seen:[],unread:[]};
    if(!clientId){setState(empty);return;}
    const key=`ws.voucher-notices.${clientId}`;
    let saved;
    try{saved=JSON.parse(window.WSSessionStorage?.getItem(key)||'null');}catch{}
    const valid=list=>Array.isArray(list)&&list.every(ref=>typeof ref==='string'&&/^WEB-\d+-\d{8}-[A-F0-9]{6}$/.test(ref));
    const initial=saved&&valid(saved.seen)&&valid(saved.unread)?{clientId,seen:saved.seen.slice(-100),unread:saved.unread.slice(-100)}:empty;
    for(const ref of pendingAwards)if(!initial.seen.includes(ref)){initial.seen.push(ref);initial.unread.push(ref);}
    pendingAwards.clear();
    window.WSSessionStorage?.setItem(key,JSON.stringify(initial));
    setState(initial);
    const issued=event=>{
      const ref=event.detail?.orderRef;
      if(typeof ref!=='string'||!/^WEB-\d+-\d{8}-[A-F0-9]{6}$/.test(ref))return;
      pendingAwards.delete(ref);
      setState(current=>{
        if(current.clientId!==clientId||current.seen.includes(ref))return current;
        const next={clientId,seen:[...current.seen,ref].slice(-100),unread:[...current.unread,ref].slice(-100)};
        window.WSSessionStorage?.setItem(key,JSON.stringify(next));
        return next;
      });
    };
    const ended=()=>{window.WSSessionStorage?.removeItem(key);setState({clientId:null,seen:[],unread:[]});};
    window.addEventListener('ws:vouchers-issued',issued);
    window.addEventListener('ws:session-ended',ended);
    return()=>{window.removeEventListener('ws:vouchers-issued',issued);window.removeEventListener('ws:session-ended',ended);};
  },[clientId]);
  const markViewed=useCallback(()=>setState(current=>{
    if(!clientId||current.clientId!==clientId||!current.unread.length)return current;
    const next={...current,unread:[]};
    window.WSSessionStorage?.setItem(`ws.voucher-notices.${clientId}`,JSON.stringify(next));
    return next;
  }),[clientId]);
  return {hasUnread:!!clientId&&state.clientId===clientId&&state.unread.length>0,markViewed};
}
