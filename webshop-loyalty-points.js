export function pointsBoard(tiers,balance,length=30){
 if(!Number.isInteger(length)||length<2||!Array.isArray(tiers)||!tiers.length||tiers.length>=length)throw Error('POINTS_BOARD_INVALID');
 const sorted=[...tiers].sort((a,b)=>a.points-b.points);if(sorted.some((t,i)=>!Number.isSafeInteger(t.points)||t.points<=0||(i&&t.points===sorted[i-1].points)))throw Error('POINTS_BOARD_INVALID');
 const anchors=[{index:0,points:0}],maximum=sorted.at(-1).points;
 sorted.forEach((tier,k)=>{const index=Math.max(anchors.at(-1).index+1,Math.min(k===sorted.length-1?length-1:Math.round(tier.points/maximum*(length-1)),length-1-(sorted.length-1-k)));anchors.push({index,points:tier.points,tier});});
 const cells=Array.from({length},(_,index)=>({index,points:0,tier:null}));
 for(let k=1;k<anchors.length;k++){const a=anchors[k-1],b=anchors[k];for(let i=a.index;i<=b.index;i++)cells[i].points=Math.round(a.points+(b.points-a.points)*(i-a.index)/(b.index-a.index));cells[b.index].tier=b.tier;}
 let current=0;cells.forEach((cell,i)=>{if(cell.points<=balance)current=i;});return cells.map(cell=>({...cell,earned:cell.points<=balance,current:cell.index===current}));
}
export function validatePointsPage(data,cardId){if(data?.status!=='available'||data.card_id!==cardId||!Number.isSafeInteger(data.balance)||data.balance<0||!Array.isArray(data.config?.tiers)||!Array.isArray(data.lots)||!Array.isArray(data.vouchers))throw Error('LOYALTY_INVALID_RESPONSE');pointsBoard(data.config.tiers,data.balance);return data;}
