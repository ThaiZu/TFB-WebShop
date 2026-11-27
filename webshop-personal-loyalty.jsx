import {PointsIcon, BingoIcon, SourceIcon} from './webshop-loyalty-icons.jsx';
const base = () => __WS_API_BASE_URL__ + '/webshop/loyalty/personal';
const POINT_SOURCES = ['PURCHASE', 'BINGO', 'RETURN'];

function dateLabel(value, lang, withTime = false) {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat(lang, {dateStyle:'medium', ...(withTime ? {timeStyle:'short'} : {}), timeZone:'Europe/Brussels'}).format(date);
}

function Bingo({campaign, t, lang, busy, join}) {
  if (!campaign) return <p>{t('personal.noCampaign')}</p>;
  const money = new Intl.NumberFormat(lang, {style:'currency', currency:'EUR'});
  const done = campaign.tasks.filter(task => task.complete).length;
  return <section className="ws-bingo">
    <header className="ws-bingo__head">
      <span className="ws-loyalty-ico"><BingoIcon size={22}/></span>
      <div className="ws-bingo__title">
        <h3>{/bingo/i.test(campaign.name || '') ? campaign.name : `${t('personal.BINGO')} · ${campaign.name}`}</h3>
        <p>{dateLabel(campaign.starts_at, lang, true)} – {dateLabel(campaign.ends_at, lang, true)}</p>
      </div>
      {campaign.tasks.length > 0 && <span className="ws-bingo__count" aria-hidden="true">{done} / {campaign.tasks.length}</span>}
    </header>
    {campaign.tasks.length > 0 && <div className="ws-bingo__bar" aria-hidden="true"><span style={{ width: `${Math.round(done / campaign.tasks.length * 100)}%` }}/></div>}
    {!campaign.joined && <button className="ws-btn ws-cta" type="button" disabled={busy}
      onClick={() => join(campaign.id)}>{t('loyaltyBingo.join')}</button>}
    <ol>{campaign.tasks.map(task => {
      const quantity = number => task.type === 'SPEND' ? money.format(number / 100) : number.toLocaleString(lang);
      const ratio = task.target > 0 ? Math.min(1, task.progress / task.target) : 0;
      return <li key={task.id} className={task.complete ? 'is-complete' : ''}>
        <span className="ws-bingo__mark" aria-hidden="true">{task.complete
          ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
          : null}</span>
        <strong className="ws-bingo__name">{task.name}</strong>
        <span className="ws-bingo__progress">{t('personal.' + task.type)} · {quantity(task.progress)} / {quantity(task.target)}</span>
        <span className="ws-bingo__track" aria-hidden="true"><span style={{ width: `${Math.round(ratio * 100)}%` }}/></span>
        {task.min_cents > 0 && <small>{t('personal.minimum')} {money.format(task.min_cents / 100)}</small>}
        <span className="ws-bingo__reward">{t('personal.reward', { count: task.points })}</span>
        {task.complete && <strong className="ws-bingo__done">✓ {t('personal.complete')}</strong>}
      </li>;
    })}</ol>
  </section>;
}

export function PersonalLoyalty({view = 'all'}) {
  const {t, lang} = window.useT();
  const [wallet, setWallet] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const current = React.useRef(null);

  async function load(campaignId = null) {
    current.current?.abort();
    const request = new AbortController();
    current.current = request;
    const options = {cache:'no-store', signal:request.signal};
    setBusy(true);
    setFailed(false);
    try {
      if (campaignId !== null) {
        const joined = await window.WSAuth.authenticatedJson(base() + '/join', {
          ...options, method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({campaign_id:campaignId}),
        });
        if (!joined.response.ok) throw new Error('join');
      }
      const {response, data} = await window.WSAuth.authenticatedJson(base() + '/wallet', options);
      if (!response.ok || !Number.isInteger(data?.balance) || !Array.isArray(data.history)
        || (data.bingo !== null && !Array.isArray(data.bingo?.tasks))) throw new Error('wallet');
      if (!request.signal.aborted) setWallet(data);
    } catch {
      if (!request.signal.aborted) setFailed(true);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }

  React.useEffect(() => {
    load();
    return () => current.current?.abort();
  }, []);

  if (failed) return <div role="alert"><p>{t('personal.unavailable')}</p>
    <button type="button" className="ws-linkbtn" onClick={() => load()}>{t('loyalty.retry')}</button></div>;
  if (!wallet) return <p role="status">{t('loyalty.loading')}</p>;
  return <>
    {view !== 'bingo' && <section className="ws-acc__section ws-loyalty-points">
      <div className="ws-points-hero">
        <span className="ws-loyalty-ico"><PointsIcon size={22}/></span>
        <h3 className="ws-points-hero__balance">
          <span className="ws-points-hero__label">{t('personal.balance')}</span><span className="ws-vh">: </span>
          <strong>{wallet.balance.toLocaleString(lang)}</strong>
        </h3>
        {POINT_SOURCES.every(source => Number.isInteger(wallet.totals?.[source])) &&
          <dl className="ws-personal-totals">
            {POINT_SOURCES.map(source => <div key={source}>
              <dt>{t('personal.total.' + source)}</dt>
              <dd>{wallet.totals[source].toLocaleString(lang)}</dd>
            </div>)}
          </dl>}
      </div>

      <h4 className="ws-loyalty-subtitle">{t('personal.history')}</h4>
      {wallet.history.length === 0 ? <p className="ws-loyalty-empty">{t('personal.noEntries')}</p> :
        <ul className="ws-personal-history">{wallet.history.map((entry, index) => <li key={index}>
          <span className="ws-loyalty-ico" aria-hidden="true"><SourceIcon source={entry.source}/></span>
          <div className="ws-personal-history__main"><strong>{t('personal.' + entry.source)}</strong><small>{dateLabel(entry.occurred_at, lang)}</small></div>
          <strong className={`ws-personal-history__pts${entry.points < 0 ? ' is-neg' : ''}`}>{entry.points.toLocaleString(lang, {signDisplay:'exceptZero'})}</strong>
        </li>)}</ul>}
    </section>}
    {view !== 'programs' && <Bingo campaign={wallet.bingo} t={t} lang={lang} busy={busy} join={load}/>}
  </>;
}
