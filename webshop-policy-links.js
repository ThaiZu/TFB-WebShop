export function policyLinks(lang, configuration, base='/', preview=false, published=false) {
  if(!['pl','fr','nl'].includes(lang))lang='fr';
  const local=folder=>({privacyUrl:base+folder+'/'+lang+'/privacy.html',cookiesUrl:base+folder+'/'+lang+'/cookies.html'});
  if(preview)return local('privacy-preview');
  const fallback=published?local('privacy'):{};
  return {privacyUrl:configuration?.policies?.[lang]?.privacyUrl||fallback.privacyUrl,cookiesUrl:configuration?.policies?.[lang]?.cookiesUrl||fallback.cookiesUrl};
}
