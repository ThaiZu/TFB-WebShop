import { useEffect, useState } from 'react';

export function PickupDates({ shopId, mode = 'collect', officeId, siteId, minLeadDays = 0, basket = [], date, onSelect }) {
  const t = window.WSI18n.t;
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setDays([]); setLoading(true); setError(false);
    (async () => {
      const api = window.WSAvailability;
      const earliest = new Date(); earliest.setHours(12,0,0,0);
      earliest.setDate(earliest.getDate() + Math.max(0, Number(minLeadDays) || 0));
      const selected = new Date(date); selected.setHours(12,0,0,0);
      const start = selected > earliest ? selected : earliest;
      const end = new Date(start); end.setDate(end.getDate()+30);
      const rows = await api.listAvailableDays({shopId,mode,basket,strict:true,from:api.isoOf(start),to:api.isoOf(end)});
      const candidates = [...new Set(rows.filter(row=>row.available === true && row.iso >= api.isoOf(start) && row.iso <= api.isoOf(end)).map(row=>row.iso))].sort();
      const found=[];
      for(const iso of candidates){
        if(!alive || found.length===3)break;
        const slots = mode === 'delivery'
          ? await window.WSOffices.deliverySlots({shop:shopId,officeId,siteId,date:iso})
          : await api.listSlots({shopId,mode,date:iso,basket});
        const available = slots.filter(slot=>slot.available!==false && slot.current_orders<slot.capacity);
        if(available.length)found.push(iso);
      }
      if(alive)setDays(found);
    })().catch(()=>{if(alive){setDays([]);setError(true);}}).finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[shopId,mode,officeId,siteId,minLeadDays,basket,date]);
  if(loading)return <p role="status">{t('common.loading2')}</p>;
  if(error)return <p role="alert">{t('co.slot.loadError')}</p>;
  if(!days.length)return <p role="status">{t('co.slot.noUpcoming')}</p>;
  return <section className="ws-pickup-dates"><h4>{t(mode==='delivery'?'co.slot.nearestDeliveryDates':'co.slot.nearestDates')}</h4><div>{days.map(iso=>{
    const value=new Date(iso+'T12:00:00');
    return <button type="button" key={iso} aria-pressed={window.WSAvailability.isoOf(date)===iso} onClick={()=>onSelect(value)}>{value.toLocaleDateString(window.WSI18n.getLang(),{weekday:'short',day:'numeric',month:'short'})}</button>;
  })}</div></section>;
}
