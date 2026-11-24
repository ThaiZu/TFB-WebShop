import './receipt.css';
import { normalizeReceiptToken } from '../webshop-receipt-token.js';

const { BASE_URL } = import.meta.env;
const { useEffect, useRef, useState } = React;
const token = normalizeReceiptToken(window.location.pathname.match(/\/t\/([^/]+)\/?$/)?.[1]);
const allergenLabels = {
  cereals_gluten: ['Gluten', 'Gluten'], crustaceans: ['Crustacés', 'Schaaldieren'],
  eggs: ['Œufs', 'Eieren'], fish: ['Poisson', 'Vis'], peanuts: ['Arachides', 'Pinda’s'],
  soybeans: ['Soja', 'Soja'], milk: ['Lait', 'Melk'], nuts: ['Fruits à coque', 'Noten'],
  celery: ['Céleri', 'Selderij'], mustard: ['Moutarde', 'Mosterd'], sesame_seeds: ['Sésame', 'Sesam'],
  sulphites: ['Sulfites', 'Sulfieten'], lupin: ['Lupin', 'Lupine'], molluscs: ['Mollusques', 'Weekdieren'],
};

const copies = {
  fr: {
    title: 'Votre ticket', choice: 'Comment souhaitez-vous consulter votre ticket ?',
    public: 'Afficher uniquement le ticket', account: 'Aller à la boutique en ligne et afficher le ticket dans l’application',
    accountHint: 'Retrouvez vos achats et commandes dans votre compte L’Atelier By.',
    back: 'Revenir au choix', load: 'Un instant…', retry: 'Réessayer', empty: 'Aucun produit',
    missing: 'Ticket introuvable', invalid: 'Scannez de nouveau le QR de votre ticket ou demandez en boutique.',
    pending: 'Ce ticket n’est pas encore disponible. Si vous venez de régler, réessayez dans un instant.',
    network: 'Impossible de joindre le service des tickets. Réessayez dans un instant.',
    service: 'Le ticket ne peut pas être affiché pour le moment. Réessayez dans un instant.',
    purchases: 'Vos achats,', detail: 'en détail.', discount: 'Réduction', total: 'Total payé, TVA comprise',
    count: (n, formatted) => `${formatted} article${n === 1 ? '' : 's'}`,
    rows: (n, count) => `${n} produit${n === 1 ? '' : 's'}, ${count}`,
    reference: n => `Votre ticket n° ${n}`, line: 'Produit',
    allergies: 'Allergènes', allergyTitle: 'Ce que contient votre ticket',
    traces: list => `Nos ateliers travaillent aussi ${list}. Des traces restent possibles. Une allergie sévère ? Parlez-en en boutique avant de déguster.`,
    freshness: 'Fraîcheur', freshnessTitle: 'Dans quel ordre les déguster',
    products: 'Fiche par fiche', productsTitle: 'Tout ce qu’il faut savoir.',
    slide: 'Glissez d’un produit à l’autre, ou touchez-en un dans la barre.',
    prev: 'Produit précédent', next: 'Produit suivant',
    ingredients: 'Composition', cooking: 'Cuisson', reheat: 'Réchauffer au four',
    preparation: 'Préparation et finition', storage: 'Conservation', vegetarian: 'Végétarien',
    consumeBefore: date => `À déguster avant le ${date}`,
    consumeWithin: period => `À déguster dans les ${period} après l’achat`,
    buyAgain: 'Le recommander', store: 'Votre boutique', order: 'Commander pour demain',
    review: 'Votre avis', reviewAction: 'Laisser un avis', app: 'Tous vos tickets, au même endroit',
    appAction: 'Télécharger l’application', footer: 'Une recette peut évoluer. En cas d’allergie ou d’intolérance, demandez conseil en boutique.',
  },
  nl: {
    title: 'Uw kasticket', choice: 'Hoe wilt u uw kasticket bekijken?',
    public: 'Alleen het kasticket bekijken', account: 'Ga naar de webshop en bekijk uw kasticket in de app',
    accountHint: 'Bekijk uw aankopen en bestellingen in uw L’Atelier By-account.',
    back: 'Terug naar de keuze', load: 'Even geduld…', retry: 'Opnieuw proberen', empty: 'Geen producten',
    missing: 'Kasticket niet gevonden', invalid: 'Scan de QR-code op uw kasticket opnieuw of vraag het in de winkel.',
    pending: 'Dit kasticket is nog niet beschikbaar. Hebt u net betaald? Probeer het dan zo meteen opnieuw.',
    network: 'De kasticketdienst is niet bereikbaar. Probeer het zo meteen opnieuw.',
    service: 'Dit kasticket kan momenteel niet worden getoond. Probeer het zo meteen opnieuw.',
    purchases: 'Uw aankopen,', detail: 'in detail.', discount: 'Korting', total: 'Totaal betaald, incl. btw',
    count: (n, formatted) => `${n} artikel${n === 1 ? '' : 'en'}`,
    rows: (n, count) => `${n} product${n === 1 ? '' : 'en'}, ${count}`,
    reference: n => `Uw kasticket nr. ${n}`, line: 'Product',
    allergies: 'Allergenen', allergyTitle: 'Wat uw kasticket bevat',
    traces: list => `In onze ateliers verwerken we ook ${list}. Sporen zijn mogelijk. Een ernstige allergie? Vraag raad in de winkel voor u proeft.`,
    freshness: 'Versheid', freshnessTitle: 'Wat eet u best eerst?',
    products: 'Product per product', productsTitle: 'Alles wat u moet weten.',
    slide: 'Veeg van het ene product naar het andere, of tik er een aan in de balk.',
    prev: 'Vorig product', next: 'Volgend product',
    ingredients: 'Samenstelling', cooking: 'Bakken en opwarmen', reheat: 'Opwarmen in de oven',
    preparation: 'Bereiding en afwerking', storage: 'Bewaren', vegetarian: 'Vegetarisch',
    consumeBefore: date => `Te eten vóór ${date}`,
    consumeWithin: period => `Te eten binnen ${period} na aankoop`,
    buyAgain: 'Opnieuw bestellen', store: 'Uw winkel', order: 'Bestel voor morgen',
    review: 'Uw mening', reviewAction: 'Laat een review achter', app: 'Al uw kastickets op één plek',
    appAction: 'Download de app', footer: 'Een recept kan wijzigen. Vraag bij een allergie of intolerantie raad in de winkel.',
  },
};

const array = value => Array.isArray(value) ? value : [];
const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const localeCode = lang => lang === 'nl' ? 'nl-BE' : 'fr-BE';
const localNumber = (value, lang) => new Intl.NumberFormat(localeCode(lang)).format(value);
const money = (value, lang) => {
  const amount = new Intl.NumberFormat(localeCode(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return lang === 'nl' ? `€ ${amount}` : `${amount} €`;
};
const localText = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.fr || '';
const lineName = (row, lang) => localText(row.nom, lang) || copies[lang].line;
const allergenName = (code, lang) => allergenLabels[code]?.[lang === 'nl' ? 1 : 0];
const knownAllergens = values => Object.keys(allergenLabels).filter(code => array(values).includes(code));
const stringList = values => array(values).filter(value => typeof value === 'string' && value.trim());

// Both same-origin product media and configured HTTP(S) links are supported.
function safeLink(value) {
  if (typeof value !== 'string' || !/^(?:https?:\/\/|\/(?!\/))/i.test(value)) return null;
  try {
    const url = new URL(value, window.location.origin);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function receiptDates(date, lang, timezone) {
  const wallTime = typeof date === 'string' ? date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?/)?.[0] : null;
  const dateFormat = timeZone => new Intl.DateTimeFormat(localeCode(lang), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone,
  });
  // Without a timezone, keep the shop-local wall clock conveyed by the API.
  let purchase = wallTime ? Date.parse(`${wallTime}Z`) : NaN;
  let format = dateFormat('UTC');
  if (wallTime && timezone && /(?:Z|[+-]\d{2}:\d{2})$/.test(date)) {
    try {
      format = dateFormat(timezone);
      purchase = Date.parse(date);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  return {
    purchase: Number.isFinite(purchase) ? format.format(purchase) : null,
    limit(minutes) {
      if (Number.isFinite(purchase)) return copies[lang].consumeBefore(format.format(purchase + 60000 * minutes));
      const unit = minutes % 1440 === 0 ? 'day' : minutes % 60 === 0 ? 'hour' : 'minute';
      const duration = new Intl.NumberFormat(localeCode(lang), { style: 'unit', unit, unitDisplay: 'long' });
      const divisor = { day: 1440, hour: 60, minute: 1 }[unit];
      return copies[lang].consumeWithin(duration.format(minutes / divisor));
    },
  };
}

function Thumbnail({ row, size }) {
  const src = safeLink(row.image);
  return <span className="receipt-thumb" style={{ '--thumb-size': `${size}px` }}>
    {src && <img src={src} alt="" width={size} height={size} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
  </span>;
}

function ProductCard({ row, index, lang, dates, webshop }) {
  const t = copies[lang];
  const name = lineName(row, lang);
  const composition = row.composition?.[lang] || row.composition?.fr;
  const ingredients = array(composition?.items).filter(item => Array.isArray(item) && typeof item[0] === 'string');
  const allergens = knownAllergens(row.allergenes);
  const instructions = stringList(localText(row.cuisson, lang) || row.cuisson);
  const preparation = stringList(localText(row.etapes, lang) || row.etapes);
  const limit = numeric(row.vieMinutes) && Number(row.vieMinutes) > 0 ? dates.limit(Number(row.vieMinutes)) : '';
  const storage = localText(row.stockage, lang);
  const hasWeight = numeric(row.poids) && Number(row.poids) > 0;
  const reheat = numeric(row.rechauffe?.minutes) && numeric(row.rechauffe?.degres);
  const buy = row.webshop === true ? webshop : safeLink(row.webshop);
  return <article className="receipt-card receipt-product" id={`product-${index}`}>
    <header>
      <Thumbnail row={row} size={76} />
      <div>
        {localText(row.famille, lang) && <p className="receipt-kicker">{localText(row.famille, lang)}</p>}
        <h3>{name}</h3>
        <p>{localNumber(row.qte, lang)}{row.portion ? ` (${row.portion})` : ''}{numeric(row.prix) ? ` × ${money(row.prix, lang)}` : ''}</p>
      </div>
    </header>
    {(row.vegetarien === true || hasWeight || limit) && <ul className="receipt-tags">
      {row.vegetarien === true && <li>{t.vegetarian}</li>}
      {hasWeight && <li>{localNumber(row.poids, lang)} g</li>}
      {limit && <li>{limit}</li>}
    </ul>}
    {ingredients.length > 0 && <section>
      <h4>{t.ingredients}</h4>
      <p lang={lang === 'nl' && (composition.traduit === false || !row.composition?.nl) ? 'fr' : lang}>
        {ingredients.map(([name, codes, details], i) => {
          const labels = knownAllergens(codes).map(code => allergenName(code, lang));
          return <React.Fragment key={i}>{i > 0 && ', '}{name}
            {labels.length > 0 && <> (<strong>{labels.join(', ')}</strong>)</>}
            {typeof details === 'string' && details && ` — ${details}`}
          </React.Fragment>;
        })}
      </p>
    </section>}
    {allergens.length > 0 && <section><h4>{t.allergies}</h4>
      <ul className="receipt-tags receipt-allergen-tags">{allergens.map(code => <li key={code}>{allergenName(code, lang)}</li>)}</ul>
    </section>}
    {(reheat || instructions.length > 0) && <section><h4>{t.cooking}</h4>
      {reheat && <p className="receipt-note">{t.reheat} <strong>{row.rechauffe.degres} °C · {row.rechauffe.minutes} min</strong></p>}
      {instructions.map((instruction, i) => <p key={i} lang={lang === 'nl' && Array.isArray(row.cuisson) ? 'fr' : lang}>{instruction}</p>)}
    </section>}
    {preparation.length > 0 && <section><h4>{t.preparation}</h4><ol lang={lang === 'nl' && Array.isArray(row.etapes) ? 'fr' : lang}>
      {preparation.map((step, i) => <li key={i}>{step}</li>)}
    </ol></section>}
    {(storage || limit) && <section><h4>{t.storage}</h4>
      {storage && <p>{storage}</p>}
      {limit && <p className="receipt-note">{limit}</p>}
    </section>}
    {buy && <a className="receipt-button receipt-dark" href={buy}>{t.buyAgain} <span aria-hidden="true">→</span></a>}
  </article>;
}

function Receipt({ data, lang }) {
  const t = copies[lang];
  const rows = array(data.lignes);
  const shop = data.boutique;
  const sale = data.transaction;
  const dates = receiptDates(sale.date, lang, shop.timezone);
  const webshop = safeLink(data.liens?.webshop);
  const review = safeLink(data.liens?.avis);
  const app = safeLink(data.liens?.application);
  const trace = knownAllergens(data.travailles).map(code => allergenName(code, lang));
  const allergens = Object.keys(allergenLabels).filter(code => rows.some(row => array(row.allergenes).includes(code)));
  const freshness = [...new Set(rows.map(row => Number(row.vieMinutes)).filter(n => n > 0 && Number.isFinite(n)))].sort((a, b) => a - b);
  const articleCount = rows.reduce((n, row) => n + (numeric(row.qte) ? Number(row.qte) : 0), 0);
  const count = t.count(articleCount, localNumber(articleCount, lang));
  const [active, setActive] = useState(0);
  const track = useRef(null);
  const references = useRef([]);
  const mobile = () => !window.matchMedia('(min-width: 860px)').matches;
  useEffect(() => {
    const card = references.current[active];
    const carousel = track.current;
    if (!card || !carousel || typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(() => {
      carousel.style.setProperty('--receipt-active-height', `${card.offsetHeight + 16}px`);
    });
    resize.observe(card);
    return () => resize.disconnect();
  }, [active]);
  function focusProduct(index) {
    const card = references.current[index];
    if (!card) return;
    setActive(index);
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (mobile()) {
      const left = card.offsetLeft - references.current[0].offsetLeft;
      track.current.scrollTo({ left, behavior });
      if (track.current.getBoundingClientRect().top < 0 || track.current.getBoundingClientRect().top > innerHeight) {
        track.current.scrollIntoView({ block: 'start', behavior });
      }
    } else {
      card.scrollIntoView({ block: 'start', behavior });
    }
  }
  function trackScroll() {
    if (!mobile() || !track.current) return;
    const first = references.current[0]?.offsetLeft ?? 0;
    const scroll = track.current.scrollLeft;
    let nearest = 0;
    for (let index = 1; index < rows.length; index += 1) {
      if (Math.abs(references.current[index].offsetLeft - first - scroll) <
          Math.abs(references.current[nearest].offsetLeft - first - scroll)) nearest = index;
    }
    setActive(nearest);
  }
  return <>
    <section className="receipt-wrap receipt-hero">
      <p className="receipt-kicker">{[t.title, shop.ville || shop.nom].filter(Boolean).join(' · ')}</p>
      <h1>{t.purchases} <em>{t.detail}</em></h1>
      <ul className="receipt-tags">
        {dates.purchase && <li>{dates.purchase}</li>}
        <li>{count}{numeric(sale.total) && ` · ${money(sale.total, lang)}`}</li>
      </ul>
    </section>
    <div className="receipt-sand">
      <div className="receipt-wrap receipt-summary">
        <section className="receipt-card">
          <p className="receipt-kicker">{sale.ticket ? t.reference(sale.ticket) : t.title}</p>
          <h2>{rows.length ? t.rows(rows.length, count) : t.empty}</h2>
          <ul className="receipt-lines">
            {rows.map((row, index) => {
              const total = numeric(row.total) ? Number(row.total) : numeric(row.prix) && numeric(row.qte) ? Number(row.prix) * Number(row.qte) : null;
              return <li key={index}><button type="button" onClick={() => focusProduct(index)}>
                <Thumbnail row={row} size={44} />
                <span><strong>{lineName(row, lang)}</strong><small>{localNumber(row.qte, lang)}{row.portion ? ` (${row.portion})` : ''}{numeric(row.prix) ? ` × ${money(row.prix, lang)}` : ''}</small></span>
                {total !== null && <strong>{money(total, lang)}</strong>}<span aria-hidden="true">→</span>
              </button></li>;
            })}
          </ul>
          {numeric(sale.discount) && Number(sale.discount) > 0 && <div className="receipt-discount">
            <span>{t.discount}</span><strong>{money(-Number(sale.discount), lang)}</strong>
          </div>}
          {numeric(sale.total) && <div className="receipt-total"><span>{t.total}</span><strong>{money(sale.total, lang)}</strong></div>}
        </section>
        {(allergens.length > 0 || trace.length > 0 || freshness.length > 0) && <div className="receipt-stack">
          {(allergens.length > 0 || trace.length > 0) && <section className="receipt-card">
            <p className="receipt-kicker">{t.allergies}</p><h2>{t.allergyTitle}</h2>
            <dl className="receipt-allergens">{allergens.map(code => <React.Fragment key={code}>
              <dt>{allergenName(code, lang)}</dt>
              <dd>{[...new Set(rows.filter(row => array(row.allergenes).includes(code)).map(row => lineName(row, lang)))].join(', ')}</dd>
            </React.Fragment>)}</dl>
            {trace.length > 0 && <p className="receipt-note">{t.traces(new Intl.ListFormat(localeCode(lang)).format(trace))}</p>}
          </section>}
          {freshness.length > 0 && <section className="receipt-card">
            <p className="receipt-kicker">{t.freshness}</p><h2>{t.freshnessTitle}</h2>
            <ol className="receipt-freshness">{freshness.map(minutes => <li key={minutes}>
              <strong>{dates.limit(minutes)}</strong>
              <span>{rows.filter(row => Number(row.vieMinutes) === minutes).map(row => `${lineName(row, lang)} × ${localNumber(row.qte, lang)}`).join(', ')}</span>
            </li>)}</ol>
          </section>}
        </div>}
      </div>
      {rows.length > 0 && <section className="receipt-products">
        <div className="receipt-wrap"><p className="receipt-kicker">{t.products}</p><h2>{t.productsTitle}</h2>
          <p className="receipt-mobile">{t.slide}</p></div>
        <nav className="receipt-product-nav" aria-label={t.products}>
          <div className="receipt-wrap" >{rows.map((row, index) =>
            <button type="button" key={index} aria-current={index === active ? 'true' : undefined} onClick={() => focusProduct(index)}>
              <Thumbnail row={row} size={30} />{lineName(row, lang)}
            </button>
          )}</div>
        </nav>
        {rows.length > 1 && <div className="receipt-wrap receipt-controls receipt-mobile">
          <span aria-live="polite">{active + 1} / {rows.length}</span>
          <button type="button" disabled={active === 0} aria-label={t.prev} onClick={() => focusProduct(active - 1)}>←</button>
          <button type="button" disabled={active + 1 === rows.length} aria-label={t.next} onClick={() => focusProduct(active + 1)}>→</button>
        </div>}
        <div className="receipt-wrap receipt-track" ref={track} onScroll={trackScroll} onKeyDown={event => {
          if (!mobile() || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          event.preventDefault();
          focusProduct(active + (event.key === 'ArrowLeft' ? -1 : 1));
        }}>
          {rows.map((row, index) => <div key={index} ref={element => { references.current[index] = element; }}>
            <ProductCard row={row} index={index} lang={lang} dates={dates} webshop={webshop} />
          </div>)}
        </div>
      </section>}
      <div className="receipt-wrap receipt-stack receipt-end">
        {review && <section className="receipt-card"><h2>{t.review}</h2><a className="receipt-button" href={review}>{t.reviewAction}</a></section>}
        {app && <section className="receipt-card"><h2>{t.app}</h2><a className="receipt-button" href={app}>{t.appAction}</a></section>}
        {(shop.nom || shop.rue || shop.ville || shop.tel || webshop) && <section className="receipt-card">
          <p className="receipt-kicker">{t.store}</p>{shop.nom && <h2>{shop.nom}</h2>}
          <address>{[shop.rue, [shop.cp, shop.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
            {shop.tel && <div>{shop.tel}</div>}
          </address>
          {webshop && <a className="receipt-button" href={webshop}>{t.order}</a>}
        </section>}
      </div>
    </div>
    <footer className="receipt-wrap receipt-footer">{t.footer}</footer>
  </>;
}

function ReceiptPage() {
  const [lang, setLanguage] = useState(navigator.language.startsWith('nl') ? 'nl' : 'fr');
  const chosenLanguage = useRef(false);
  const [view, setView] = useState(window.location.hash === '#ticket');
  const [request, requestAgain] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(token ? 'loading' : 'invalid');
  const t = copies[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t.title} · L’Atelier By`;
  }, [lang, t.title]);
  useEffect(() => {
    const onHash = () => setView(window.location.hash === '#ticket');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort('timeout'), 10000);
    setStatus('loading');
    fetch(`${__WS_API_BASE_URL__}/public/receipts/${token}`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    }).then(async response => {
      if (response.status === 404 || response.status === 202) {
        setStatus('pending');
        return;
      }
      if (!response.ok) {
        setStatus('service');
        return;
      }
      const receipt = await response.json().catch(error => {
        if (controller.signal.aborted) throw error;
        return null;
      });
      if (!receipt?.boutique || !receipt.transaction || !Array.isArray(receipt.lignes)) {
        if (!controller.signal.aborted) setStatus('service');
        return;
      }
      if (controller.signal.aborted) return;
      if (!chosenLanguage.current && ['fr', 'nl'].includes(receipt.langue)) setLanguage(receipt.langue);
      setData(receipt);
      setStatus('ready');
    }).catch(() => {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setStatus('error');
    }).finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [request]);
  const showChoice = status === 'ready' && data?.has_customer === true && !view;
  return <>
    <header className="receipt-nav"><div className="receipt-wrap">
      <img src={`${BASE_URL}logo.png`} width="116" height="28" alt="L’Atelier By" />
      <div className="receipt-languages">{['fr', 'nl'].map(value => <button key={value} type="button"
        aria-pressed={lang === value} lang={value} onClick={() => {
          chosenLanguage.current = true;
          setLanguage(value);
        }}>{value.toUpperCase()}</button>)}</div>
    </div></header>
    <main>
      {showChoice ? <section className="receipt-wrap receipt-choice">
        <p className="receipt-kicker">{[t.title, data?.boutique?.ville].filter(Boolean).join(' · ')}</p>
        <h1>{t.choice}</h1>
        <div className="receipt-choice-actions">
          <a className="receipt-button receipt-dark" href={`${BASE_URL}${token ? `#receipt=${token}` : ''}`}>
            {t.account}<span aria-hidden="true">→</span>
          </a>
          <p>{t.accountHint}</p>
          <a className="receipt-button" href="#ticket">{t.public}<span aria-hidden="true">→</span></a>
        </div>
      </section> : <>
        {data?.has_customer === true && view && <div className="receipt-wrap receipt-back"><a href="#">{'← ' + t.back}</a></div>}
        {status === 'ready' && data ? <Receipt data={data} lang={lang} /> :
          <section className="receipt-wrap receipt-state" aria-live="polite">
            {status === 'invalid' && <h1>{t.missing}</h1>}
            <p>{({ loading: t.load, pending: t.pending, error: t.network, service: t.service, invalid: t.invalid })[status]}</p>
            {['pending', 'error', 'service'].includes(status) && <button className="receipt-button" type="button"
              onClick={() => requestAgain(n => n + 1)}>{t.retry}</button>}
          </section>}
      </>}
    </main>
  </>;
}

ReactDOM.createRoot(document.getElementById('receipt-root')).render(<ReceiptPage />);
