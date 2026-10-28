/* Local published documents; no remote request and no tracking. */
(function(){
  const base=new URL('.',document.currentScript.src);
  function render(){
    if(!window.WSPolicyNotice?.published||!window.WSI18n)return;
    const lang=window.WSI18n.getLang();
    const folder=window.WSPolicyNotice.directory==='privacy-preview'?'privacy-preview':'privacy';
    for(const node of document.querySelectorAll('[data-ws-policy-links]')){
      node.replaceChildren();
      for(const [kind,key]of [['privacy','privacyPolicy'],['cookies','cookiePolicy']]){
        const link=document.createElement('a');link.href=new URL(folder+'/'+lang+'/'+kind+'.html',base).href;
        link.textContent=window.WSI18n.t('cookies.'+key);link.target='_blank';link.rel='noopener noreferrer';
        link.setAttribute('aria-label',link.textContent+' — '+window.WSI18n.t('cookies.newTab'));
        node.append(link,document.createTextNode(' '));
      }
    }
  }
  window.WSPageReady?.then(()=>{render();window.WSI18n.onChange(render);});
})();
