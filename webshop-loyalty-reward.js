// Keep the selected product bound to its stable basket identity, never its old position.
export function rewardSelection(choice, basket, client, shop, enabled, mode, context) {
  if (!choice || !enabled || mode !== 'collect' || context !== 'standard'
    || Number(choice.client) !== Number(client) || Number(choice.shop) !== Number(shop)) return null;
  const index = basket.findIndex(line => String(line.line) === choice.line);
  return index < 0 ? null : {id:choice.id,line_index:index};
}
export function rewardLines(reward, basket, now) {
  if (reward.status !== 'READY' || (reward.expiresAt && Date.parse(reward.expiresAt) <= now)
    || !Array.isArray(reward.productIds)) return [];
  return basket.flatMap((line,index) => (line.id_product_portion ? (reward.portionIds || []).includes(Number(line.id_product_portion)) : reward.productIds.includes(Number(line.productId)))
    && Number.isInteger(Number(line.qty)) && Number(line.qty) >= 1 && !line.menu_selection
    && !line.weight_grams ? [{line,index}] : []);
}
