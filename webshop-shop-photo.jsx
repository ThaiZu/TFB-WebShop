export function ShopPhoto({shop}) {
  const candidate=shop.webshop_image?.url;
  const url=typeof candidate==='string'&&/^https?:\/\//i.test(candidate)?candidate:null;
  const [failed,setFailed]=React.useState(false);
  React.useEffect(()=>setFailed(false),[url]);
  return <span className="ws-shop-photo" aria-hidden="true">
    {url&&!failed?<img src={url} alt="" width="1600" height="1000" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>
      :<svg className="ws-shop-photo__placeholder" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 27h44v28H10zM8 27l7-15h34l7 15M24 55V37h16v18M17 12l-3 15M28 12l-1 15M36 12l1 15M47 12l3 15"/><path d="M8 27c0 8 10 8 10 0 0 8 10 8 10 0 0 8 10 8 10 0 0 8 10 8 10 0 0 8 8 8 8 0"/></svg>}
  </span>;
}
