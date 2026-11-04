export function validateVoucherPage(data) {
  const date=value=>value===null||(typeof value==='string'&&Number.isFinite(Date.parse(value)));
  const seen=new Set();
  if(data?.status!=='available'||!date(data.asOf)||data.asOf===null||!Array.isArray(data.items)
    ||!(data.nextCursor===null||/^[1-9][0-9]*$/.test(data.nextCursor)))throw new Error('VOUCHER_INVALID_RESPONSE');
  for(const item of data.items){
    if(!item||!Number.isSafeInteger(item.id)||item.id<=0||seen.has(item.id)||typeof item.code!=='string'
      ||!item.code.length||item.code.length>64||/[\u0000-\u001f]/.test(item.code)||typeof item.name!=='string'||typeof item.canUse!=='boolean'
      ||!['READY','RESERVED','USED','EXPIRED','REVOKED','DISABLED','UPCOMING'].includes(item.status)
      ||!['LOYALTY','PROMOTION','VOUCHER'].includes(item.source)||!date(item.validFrom)||!date(item.validTo))throw new Error('VOUCHER_INVALID_RESPONSE');
    seen.add(item.id);
    if(item.targets!==undefined){
      const valid=target=>target&&Number.isSafeInteger(target.id)&&target.id>0&&typeof target.name==='string'
        &&['ANY','WHOLE','THREE_QUARTERS','TWO_THIRDS','ONE_HALF','ONE_THIRD','ONE_QUARTER','ONE_SIXTH','ONE_EIGHTH'].includes(target.portion);
      if(!item.targets||!Array.isArray(item.targets.products)||!Array.isArray(item.targets.categories)
        ||!item.targets.products.every(target=>valid(target)&&(target.portionId===null||(Number.isSafeInteger(target.portionId)&&target.portionId>0)))
        ||!item.targets.categories.every(valid))throw new Error('VOUCHER_INVALID_RESPONSE');
    }
  }
  return data;
}

async function request(path,options) {
  const {response,data}=await window.WSAuth.authenticatedJson(`${__WS_API_BASE_URL__}/webshop/vouchers${path}`,{cache:'no-store',...options});
  if(!response.ok){const error=new Error('VOUCHER_UNAVAILABLE');error.status=response.status;throw error;}
  return data;
}

export async function prepareVouchers(signal) {
  const data=await request('/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal});
  if(!Number.isSafeInteger(data?.prepared)||data.prepared<0||typeof data.hasMore!=='boolean')throw new Error('VOUCHER_INVALID_RESPONSE');
  return data;
}

export async function readVouchers(shopId,cursor,signal) {
  const query=new URLSearchParams({shopId:String(shopId)});
  if(cursor)query.set('cursor',cursor);
  return validateVoucherPage(await request(`?${query}`,{method:'GET',signal}));
}
