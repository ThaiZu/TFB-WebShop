import { readFileSync } from 'node:fs';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Render only the small Markdown subset used by our notices. No raw HTML,
// executable Markdown or third-party runtime dependencies.
export function inline(text) {
  return text.split(/(`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g).map(part => {
    if (part.startsWith('`') && part.endsWith('`')) return '<code>'+escape(part.slice(1,-1))+'</code>';
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      try {
        const url=new URL(link[2]);
        if (url.protocol==='https:' && !url.username && !url.password) return `<a href="${escape(url.href)}" rel="noopener noreferrer">${escape(link[1])}</a>`;
      } catch (_) {}
    }
    return escape(part);
  }).join('');
}
export function markdown(source) {
  const lines=source.replace(/\r/g,'').trim().split('\n'), out=[];
  for(let i=0;i<lines.length;) {
    const line=lines[i];
    if (!line.trim()) {i++;continue;}
    if (/^\|/.test(line) && /^\|[\s:|\-]+$/.test(lines[i+1]||'')) {
      const cells=row=>row.trim().slice(1,-1).split('|').map(c=>c.trim());
      const head=cells(line);i+=2;const rows=[];
      while(i<lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push('<div class="table-scroll" tabindex="0"><table><thead><tr>'+head.map(c=>'<th scope="col">'+inline(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');continue;
    }
    const heading=line.match(/^(#{1,4}) (.+)$/);
    if(heading){const n=heading[1].length;out.push(`<h${n}>${inline(heading[2])}</h${n}>`);i++;continue;}
    const list=line.match(/^(?:- |\d+\. )(.+)$/);
    if(list){const ordered=/^\d/.test(line), tag=ordered?'ol':'ul',items=[];
      while(i<lines.length && (ordered?/^\d+\. /:/^- /).test(lines[i]))items.push('<li>'+inline(lines[i++].replace(ordered?/^\d+\. /:/^- /,''))+'</li>');
      out.push(`<${tag}>${items.join('')}</${tag}>`);continue;}
    const paragraph=[];
    while(i<lines.length && lines[i].trim() && !/^#{1,4} |^\|/.test(lines[i])) paragraph.push(lines[i++]);
    if(!paragraph.length)paragraph.push(lines[i++]);
    out.push('<p>'+inline(paragraph.join(' '))+'</p>');
  }
  return out.join('\n');
}
const labels={pl:{draft:'PROJEKT DO WERYFIKACJI — dokument niezatwierdzony',back:'Wróć do sklepu',privacy:'Polityka prywatności',cookies:'Polityka cookies'},fr:{draft:'PROJET À VÉRIFIER — document non approuvé',back:'Retour au webshop',privacy:'Confidentialité',cookies:'Cookies'},nl:{draft:'CONCEPT TER VERIFICATIE — niet goedgekeurd',back:'Terug naar de webshop',privacy:'Privacybeleid',cookies:'Cookiebeleid'}};
export function policyPages({manifest,sources,base='/',preview=false}) {
  if(!['draft','approved'].includes(manifest.status))throw Error('Unknown policy approval status');
  if(!preview && manifest.status!=='approved')return [];
  if(manifest.status==='approved' && (!manifest.approvedBy?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.approvedAt||'')))throw Error('Policy approval evidence is missing');
  const folder=preview?'privacy-preview':'privacy';
  const result=[];
  for(const lang of ['pl','fr','nl']) for(const kind of ['privacy','cookies']) {
    const filename=manifest.documents?.[lang]?.[kind],source=sources[filename];
    if(typeof source!=='string'||!source.trim())throw Error('Missing policy '+lang+'/'+kind);
    if(!preview && /DEC-\d|draft-\d|PROJEKT|PROJET|CONCEPT TER|\[URL|\[WŁAŚCIWY|\[RESPONSABLE|\[TOEPASSELIJKE/.test(source))throw Error('Unresolved policy content '+filename);
    const l=labels[lang];
    const nav=['pl','fr','nl'].map(code=>`<a lang="${code}" hreflang="${code}" href="../${code}/${kind}.html">${code.toUpperCase()}</a>`).join(' · ');
    const title=l[kind];
    const html=`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${preview?'<meta name="robots" content="noindex,nofollow">':''}<meta name="referrer" content="no-referrer"><title>${escape(title)} · Atelier By</title><style>body{margin:0;background:#faf8f5;color:#25221f;font:1rem/1.65 system-ui,sans-serif}main{max-width:70rem;margin:auto;padding:1.5rem}a{color:#78182a;text-underline-offset:.2em}a:focus-visible,[tabindex]:focus-visible{outline:3px solid #78182a;outline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:1rem}h1{line-height:1.2}h2{margin-top:2rem}.draft{padding:1rem;border:3px solid #78182a;font-weight:700}.table-scroll{overflow:auto}table{border-collapse:collapse;min-width:38rem;width:100%}td,th{border:1px solid #bbb;padding:.7rem;text-align:left;vertical-align:top}code{overflow-wrap:anywhere}p{overflow-wrap:anywhere}@media print{nav{display:none}.table-scroll{overflow:visible}table{min-width:0;font-size:9pt}}</style></head><body><main><nav aria-label="${escape(title)}"><a href="${escape(base)}">${l.back}</a><a href="${kind==='privacy'?'cookies':'privacy'}.html">${l[kind==='privacy'?'cookies':'privacy']}</a>${nav}</nav>${preview?`<p class="draft" role="note">${l.draft} · ${escape(manifest.version)}</p>`:''}${markdown(source)}</main></body></html>`;
    result.push({fileName:`${folder}/${lang}/${kind}.html`,source:html});
  }
  return result;
}
export function readPolicySources(root,manifest) {
  const directory=manifest.sourceDirectory || 'privacy-drafts';
  if(!['privacy-drafts','privacy-published'].includes(directory))throw Error('Invalid policy source directory');
  const sources={};
  for(const docs of Object.values(manifest.documents))for(const name of Object.values(docs)){
    if(!/^[A-Za-z0-9._-]+\.md$/.test(name))throw Error('Invalid policy source filename');
    sources[name]=readFileSync(new URL('docs/'+directory+'/'+name,root),'utf8');
  }
  return sources;
}
export function privacyPagesPlugin({root,base,preview=false}) {
  function pages(){
    const manifest=JSON.parse(readFileSync(new URL('privacy-policies.json',root),'utf8'));
    const sources=readPolicySources(root,manifest);
    return policyPages({manifest,sources,base,preview});
  }
  function runtime(){const m=JSON.parse(readFileSync(new URL('privacy-policies.json',root),'utf8'));return 'window.WSPolicyNotice = '+JSON.stringify({published:m.status==='approved',version:m.version})+';';}
  return {name:'webshop-privacy-pages',generateBundle(){for(const page of pages())this.emitFile({type:'asset',...page});this.emitFile({type:'asset',fileName:'privacy-runtime.js',source:runtime()});},configureServer(server){server.middlewares.use((req,res,next)=>{
    const file=(req.url||'').split('?')[0].slice(base.length);
    if(file==='privacy-runtime.js'){res.setHeader('Content-Type','application/javascript; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(runtime());return;}
    if(!file.startsWith('privacy-preview/')&&!file.startsWith('privacy/'))return next();
    const page=pages().find(p=>p.fileName===file);if(!page)return next();
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(page.source);
  });}};
}
