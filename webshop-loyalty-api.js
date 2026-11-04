const kinds = new Set(['cards', 'rewards', 'history']);
const statuses = new Set(['READY', 'RESERVED', 'REDEEMED', 'EXPIRED', 'REVOKED']);
const integer = value => Number.isSafeInteger(value);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function validateLoyaltyPage(data, kind) {
  const invalid = () => { throw new Error('LOYALTY_INVALID_RESPONSE'); };
  if (!kinds.has(kind) || data?.status !== 'available' || !date(data.asOf) || !Array.isArray(data.items)
    || !(data.nextCursor === null || (typeof data.nextCursor === 'string' && data.nextCursor.length > 0))) invalid();
  const seen = new Set();
  for (const item of data.items) {
    if (!item || seen.has(String(item.id))) invalid();
    seen.add(String(item.id));
    if (kind === 'cards') {
      if (!integer(item.id) || item.id <= 0 || typeof item.name !== 'string' || !integer(item.required) || item.required <= 0
        || !integer(item.balance) || item.progress !== Math.max(0,item.balance) || item.debt !== Math.max(0,-item.balance)
        || !integer(item.pendingEvents) || item.pendingEvents < 0 || typeof item.accepting !== 'boolean'
        || (item.readyRewards!==undefined&&(!integer(item.readyRewards)||item.readyRewards<0))
        || !Array.isArray(item.shops) || !item.shops.every(shop => integer(shop.id) && typeof shop.name === 'string')) invalid();
    } else if (kind === 'rewards') {
      if (!integer(item.id) || item.id <= 0 || !statuses.has(item.status) || !date(item.earnedAt)
        || !(item.expiresAt === null || date(item.expiresAt))
        || (item.status === 'READY' ? !/^[A-F0-9]{32}$/.test(item.code) : item.code !== null)) invalid();
    } else if (!/^[1-9][0-9]*$/.test(item.id) || !integer(item.delta) || item.delta === 0 || !integer(item.balanceAfter)
      || !['EARN','CORRECTION','CORRECTION_CANCEL','ISSUE','REVOKE'].includes(item.kind) || !date(item.occurredAt)) invalid();
  }
  return data;
}

export async function readLoyaltyPage(kind, {shopId, cardId, cursor}, signal) {
  if (!kinds.has(kind)) throw new Error('LOYALTY_INVALID_QUERY');
  const query = new URLSearchParams({shopId: String(shopId)});
  if (cardId) query.set('cardId',String(cardId));
  if (cursor) query.set('cursor',cursor);
  const {response, data} = await window.WSAuth.authenticatedJson(`${__WS_API_BASE_URL__}/webshop/loyalty/${kind}?${query}`, {
    method:'GET', cache:'no-store', signal,
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'LOYALTY_SIGN_IN' : 'LOYALTY_UNAVAILABLE');
    error.status = response.status; throw error;
  }
  return validateLoyaltyPage(data,kind);
}

export function validateLoyaltyProgram(data,cardId) {
  const named=list=>Array.isArray(list)&&list.every(item=>integer(item.id)&&item.id>0&&typeof item.name==='string');
  if(data?.status!=='available'||data.id!==cardId||!date(data.asOf)||!date(data.startsAt)
    ||!(data.endsAt===null||date(data.endsAt))||!integer(data.rewardValidityDays)||data.rewardValidityDays<0
    ||!named(data.products)||!named(data.categories)||!named(data.excludedProducts)||!named(data.rewardChoices)
    ||!data.rewardChoices.every(item=>item.portion===null||typeof item.portion==='string')) throw new Error('LOYALTY_INVALID_RESPONSE');
  return data;
}

export async function readLoyaltyProgram({shopId,cardId},signal) {
  const query=new URLSearchParams({shopId:String(shopId),cardId:String(cardId)});
  const {response,data}=await window.WSAuth.authenticatedJson(`${__WS_API_BASE_URL__}/webshop/loyalty/program?${query}`,{method:'GET',cache:'no-store',signal});
  if(!response.ok){const error=new Error('LOYALTY_UNAVAILABLE');error.status=response.status;throw error;}
  return validateLoyaltyProgram(data,cardId);
}
