const integer = value => Number.isSafeInteger(value);
export function loyaltyPreview(value) {
  const unavailable = {status:'unavailable',cards:[],lines:[]};
  if (!value || !['available','signIn','excluded','unavailable'].includes(value.status)
      || !Array.isArray(value.cards) || !Array.isArray(value.lines)) return unavailable;
  if (['excluded','unavailable'].includes(value.status)) return {...unavailable,status:value.status};
  const guest = value.status === 'signIn';
  const ids = new Set();
  for (const card of value.cards) {
    if (!card || !integer(card.id) || card.id<=0 || ids.has(card.id) || typeof card.name!=='string'
        || !integer(card.required) || card.required<=0 || !integer(card.increment) || card.increment<0) return unavailable;
    ids.add(card.id);
    if (guest) {
      if (['before','after','newRewards','remaining','pendingEvents'].some(key=>card[key]!==null)) return unavailable;
    } else if (!['before','after','newRewards','remaining','pendingEvents'].every(key=>integer(card[key]))
        || card.newRewards<0 || card.pendingEvents<0 || card.remaining!==card.required-card.after
        || card.after!==card.before+card.increment-card.newRewards*card.required
        || card.after>=card.required) return unavailable;
  }
  const keys=new Set();
  for (const line of value.lines) {
    if (!line || typeof line.lineKey!=='string' || keys.has(line.lineKey) || !ids.has(line.cardId)
        || !integer(line.increment) || line.increment<0) return unavailable;
    keys.add(line.lineKey);
  }
  if (value.cards.some(card=>value.lines.filter(line=>line.cardId===card.id).reduce((sum,line)=>sum+line.increment,0)!==card.increment)) return unavailable;
  return value;
}
export function loyaltyLineKey(line, index=0) {
  return 'web-'+String(line.line ?? index).replace(/[^A-Za-z0-9-]/g,'-').slice(0,60);
}
