const base = () => __WS_API_BASE_URL__ + '/webshop/loyalty/personal';
const POINT_SOURCES = ['PURCHASE', 'BINGO', 'RETURN'];

function dateLabel(value, lang, withTime = false) {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat(lang, {dateStyle:'medium', ...(withTime ? {timeStyle:'short'} : {}), timeZone:'Europe/Brussels'}).format(date);
}

function Bingo({campaign, t, lang, busy, join}) {
  if (!campaign) return <p>{t('personal.noCampaign')}</p>;
  const money = new Intl.NumberFormat(lang, {style:'currency', currency:'EUR'});
  return <section className="ws-bingo">
    <h3>{t('personal.BINGO')} · {campaign.name}</h3>
    <p>{dateLabel(campaign.starts_at, lang, true)} – {dateLabel(campaign.ends_at, lang, true)}</p>
    {!campaign.joined && <button className="ws-btn" type="button" disabled={busy}
      onClick={() => join(campaign.id)}>{t('loyaltyBingo.join')}</button>}
    <ol>{campaign.tasks.map(task => {
      const quantity = number => task.type === 'SPEND' ? money.format(number / 100) : number.toLocaleString(lang);
      return <li key={task.id} className={task.complete ? 'is-complete' : ''}>
        <strong>{task.name}</strong>
        <span>{t('personal.' + task.type)} · {quantity(task.progress)} / {quantity(task.target)}</span>
        {task.min_cents > 0 && <small>{t('personal.minimum')} {money.format(task.min_cents / 100)}</small>}
        <span>{t('personal.points')}: {task.points}</span>
        {task.complete && <strong>✓ {t('personal.complete')}</strong>}
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
    {view !== 'bingo' && <section className="ws-acc__section">
      <h3>{t('personal.balance')}: {wallet.balance.toLocaleString(lang)}</h3>
      {POINT_SOURCES.every(source => Number.isInteger(wallet.totals?.[source])) &&
        <dl className="ws-personal-totals">
          {POINT_SOURCES.map(source => <div key={source}>
            <dt>{t('personal.total.' + source)}</dt>
            <dd>{wallet.totals[source].toLocaleString(lang)}</dd>
          </div>)}
        </dl>}

      <h4>{t('personal.history')}</h4>
      {wallet.history.length === 0 ? <p>{t('personal.noEntries')}</p> :
        <ul className="ws-personal-history">{wallet.history.map((entry, index) => <li key={index}>
          <div><strong>{t('personal.' + entry.source)}</strong><br/><small>{dateLabel(entry.occurred_at, lang)}</small></div>
          <strong>{entry.points.toLocaleString(lang, {signDisplay:'exceptZero'})}</strong>
        </li>)}</ul>}
    </section>}
    {view !== 'programs' && <Bingo campaign={wallet.bingo} t={t} lang={lang} busy={busy} join={load}/>}
  </>;
}
