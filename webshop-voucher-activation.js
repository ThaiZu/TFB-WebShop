import {useCallback,useEffect,useRef,useState} from 'react';

export function validateActivation(value) {
  if(!value || !Number.isSafeInteger(value.revision) || value.revision<0
    || !(value.code===null || (typeof value.code==='string' && value.code.length>0 && value.code.length<=128))
    || typeof value.reserved!=='boolean') throw new Error('VOUCHER_INVALID_RESPONSE');
  return value;
}

export async function requestActivation(shopId,change,signal) {
  const write=change!==undefined;
  const {response,data}=await window.WSAuth.authenticatedJson(`${__WS_API_BASE_URL__}/webshop/vouchers/activation${write?'':`?shopId=${encodeURIComponent(shopId)}`}`,{
    cache:'no-store',method:write?'POST':'GET',signal,
    ...(write?{headers:{'Content-Type':'application/json'},body:JSON.stringify({shopId,code:change.code,revision:change.revision})}:{})
  });
  if(!response.ok){const error=new Error('VOUCHER_UNAVAILABLE');error.status=response.status;error.code=data?.code || data?.description;throw error;}
  return validateActivation(data);
}

// This is a server-state cache only. No activation is persisted in browser storage.
export function useVoucherActivation(clientId,shopId,onChange,onError) {
  const state=useRef(null),generation=useRef(0),writing=useRef(false);
  const handlers=useRef({onChange,onError});handlers.current={onChange,onError};
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const version=++generation.current;state.current=null;writing.current=false;setBusy(false);
    handlers.current.onChange(null);
    if(!clientId || !shopId)return;
    let reading=false,alive=true;
    const controller=new AbortController();
    const apply=value=>{
      if(!alive || version!==generation.current)return;
      if(value && state.current && value.revision<state.current.revision)return;
      if(state.current?.revision!==value?.revision || state.current?.code!==value?.code){state.current=value;handlers.current.onChange(value);}
      else state.current=value;
    };
    async function refresh(){
      if(reading || writing.current || document.hidden)return;
      reading=true;
      try {const value=await requestActivation(shopId,undefined,controller.signal);if(!writing.current)apply(value);}
      catch(error){if(error.name!=='AbortError' && error.status===401)apply(null);}
      finally{reading=false;}
    }
    const ended=()=>{alive=false;generation.current++;controller.abort();state.current=null;handlers.current.onChange(null);};
    const timer=setInterval(refresh,3000);refresh();
    window.addEventListener('focus',refresh);window.addEventListener('ws:session-ended',ended);
    return()=>{alive=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('ws:session-ended',ended);};
  },[clientId,shopId]);
  const select=useCallback(async code=>{
    if(!clientId || !shopId || writing.current)return false;
    writing.current=true;setBusy(true);const version=generation.current;
    try {
      const current=state.current || await requestActivation(shopId);
      if(version!==generation.current)return false;
      const value=await requestActivation(shopId,{code,revision:current.revision});
      if(version!==generation.current)return false;
      state.current=value;handlers.current.onChange(value);return true;
    }catch(error){
      if(version===generation.current){
        handlers.current.onError(error);
        try{const value=await requestActivation(shopId);if(version===generation.current){state.current=value;handlers.current.onChange(value);}}catch{}
      }
      return false;
    }finally{if(version===generation.current){writing.current=false;setBusy(false);}}
  },[clientId,shopId]);
  return {select,busy};
}
