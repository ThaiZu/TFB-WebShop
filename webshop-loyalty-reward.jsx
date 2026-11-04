import {readLoyaltyPage} from './webshop-loyalty-api.js';
import {rewardLines} from './webshop-loyalty-reward.js';

// Fetch every page: a usable reward may follow old, expired or reserved rewards.
async function pages(kind,query,signal) {
  const items=[];let cursor=null,asOf;
  do {
    const page=await readLoyaltyPage(kind,{...query,cursor},signal);
    items.push(...page.items);cursor=page.nextCursor;asOf=page.asOf;
  } while(cursor);
  return {items,asOf};
}

export function LoyaltyRewardPicker({shopId,basket,selected,onSelect,quoteState,t}) {
  const [available,setAvailable]=React.useState([]);
  const [now,setNow]=React.useState(Date.now());
  React.useEffect(()=>{
    let alive=true;const controller=new AbortController();
    setAvailable([]);
    const ended=()=>{alive=false;controller.abort();setAvailable([]);};
    window.addEventListener('ws:session-ended',ended);
    (async()=>{
      const cards=await pages('cards',{shopId},controller.signal);
      const choices=[];
      for(const card of cards.items) {
        if(card.readyRewards===0)continue;
        const rewards=await pages('rewards',{shopId,cardId:card.id},controller.signal);
        choices.push({card,rewards:rewards.items,clockOffset:Date.parse(rewards.asOf)-Date.now()});
      }
      if(alive)setAvailable(choices);
    })().catch(()=>{if(alive)setAvailable([]);});
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return()=>{alive=false;controller.abort();clearInterval(timer);window.removeEventListener('ws:session-ended',ended);};
  },[shopId]);
  const groups=available.map(({card,rewards,clockOffset})=>({card,choices:rewards.flatMap(reward=>
    rewardLines(reward,basket,now+clockOffset).map(({line,index})=>({reward,line,index}))) })).filter(group=>group.choices.length);
  // No reward selector, loading message or obligation when nothing can be redeemed.
  // Keep removal available if a previously selected reward expires or becomes unavailable.
  if(!selected&&!groups.length)return null;
  const choices=groups.flatMap(group=>group.choices);
  return <section className="ws-co-voucher" aria-label={t('loyaltyUse.collectTitle')}>
    <h4>{t('loyaltyUse.collectTitle')}</h4>
    {selected&&!choices.some(item=>item.reward.id===selected.id&&item.index===selected.line_index)&&<div>
      <button type="button" className="ws-linkbtn" onClick={()=>onSelect(null)}>{t('loyaltyUse.remove')}</button>
    </div>}
    {choices.length>0&&<label className="ws-field"><span>{t('loyaltyUse.product')}</span>
      <select disabled={quoteState.status==='loading'} value={selected?`${selected.id}:${selected.line_index}`:''}
        onChange={event=>{const choice=choices.find(item=>`${item.reward.id}:${item.index}`===event.target.value);onSelect(choice?{id:choice.reward.id,line_index:choice.index}:null);}}>
        <option value="">{t('loyaltyUse.skip')}</option>
        {groups.map(({card,choices})=><optgroup key={card.id} label={card.name}>
          {choices.map(({reward,line,index})=><option key={`${reward.id}:${index}`} value={`${reward.id}:${index}`}>
            {line.name||line.productName||line.product_name||card.rewardLabel}{line.id_product_portion?` (${line.product_portion_label||line.portion_label||line.product_portion_type||'#'+line.id_product_portion})`:''}
          </option>)}
        </optgroup>)}
      </select>
    </label>}
  </section>;
}
