const portions={WHOLE:['entier','1/1'],THREE_QUARTERS:['troisquarts','3/4'],TWO_THIRDS:['deuxtiers','2/3'],ONE_HALF:['demi','1/2'],ONE_THIRD:['tiers','1/3'],ONE_QUARTER:['quart','1/4'],ONE_SIXTH:['sixieme','1/6'],ONE_EIGHTH:['huitieme','1/8']};

// Match the product independently of the currently selected portion.
export function voucherProductPortions(voucher,product) {
  if(!voucher?.targets||!product)return [];
  const targets=[...(voucher.targets.products||[]).filter(target=>Number(target.id)===Number(product.id)),
    ...(voucher.targets.categories||[]).filter(target=>Number(target.id)===Number(product.cat_id??product.cat))];
  const options=product.portionOptions?.length?product.portionOptions:[{v:'entier'}];
  const result=[];
  for(const target of targets){
    if(target.portion==='ANY'){result.push({value:null,label:null});continue;}
    const portion=portions[target.portion];
    if(!portion)continue;
    const option=options.find(option=>target.portionId!=null?Number(option.id_product_portion)===Number(target.portionId):option.v===portion[0]);
    if(option&&!result.some(item=>item.value===option.v))result.push({value:option.v,label:portion[1]});
  }
  return result;
}
