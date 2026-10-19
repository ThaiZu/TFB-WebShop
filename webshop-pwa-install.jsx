/* PWA installation prompt.
 *
 * The browser owns the actual installation. This component only saves the
 * Chromium event until a person asks for it and explains the manual iOS flow.
 * Keeping the event broker outside React prevents a fast browser event from
 * being lost while the shop is still mounting.
 */
const WS_PWA_LATER_KEY = 'ws.pwa.install.laterAt';
const WS_PWA_INSTALLED_KEY = 'ws.pwa.install.installed';
const WS_PWA_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

const pwaInstallListeners = new Set();
let pwaDeferredPrompt = null;

function pwaNotify() {
  pwaInstallListeners.forEach((listener) => {
    try { listener(pwaDeferredPrompt); } catch (_) {}
  });
}

function pwaIsStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  } catch (_) {
    return false;
  }
}

function pwaIsMobile() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function pwaIsIos() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function pwaIsIosSafari() {
  if (!pwaIsIos()) return false;
  const ua = navigator.userAgent || '';
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger/i.test(ua);
}

function pwaRead(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function pwaWrite(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

function pwaDeferredRecently() {
  const timestamp = Number(pwaRead(WS_PWA_LATER_KEY) || 0);
  return timestamp > 0 && Date.now() - timestamp < WS_PWA_DELAY_MS;
}

function pwaMarkLater() {
  pwaWrite(WS_PWA_LATER_KEY, String(Date.now()));
}

function pwaMarkInstalled() {
  pwaWrite(WS_PWA_INSTALLED_KEY, '1');
  try { localStorage.removeItem(WS_PWA_LATER_KEY); } catch (_) {}
}

function pwaKnownInstalled() {
  return pwaRead(WS_PWA_INSTALLED_KEY) === '1';
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    pwaDeferredPrompt = event;
    pwaNotify();
  });
  window.addEventListener('appinstalled', () => {
    pwaDeferredPrompt = null;
    pwaMarkInstalled();
    pwaNotify();
  });
}

function PwaInstallPrompt() {
  const { t } = window.useT();
  const panelRef = React.useRef(null);
  const lastFocusRef = React.useRef(null);
  const [deferredPrompt, setDeferredPrompt] = React.useState(() => pwaDeferredPrompt);
  const [visible, setVisible] = React.useState(false);
  const [showIosSteps, setShowIosSteps] = React.useState(false);
  const installed = pwaIsStandalone() || pwaKnownInstalled();
  const iosSafari = pwaIsIosSafari();
  const canOfferInstall = pwaIsMobile() && !installed && (iosSafari || !!deferredPrompt);

  React.useEffect(() => {
    const onPromptChange = (prompt) => setDeferredPrompt(prompt);
    pwaInstallListeners.add(onPromptChange);
    return () => pwaInstallListeners.delete(onPromptChange);
  }, []);

  React.useEffect(() => {
    if (!canOfferInstall || pwaDeferredRecently()) {
      setVisible(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      lastFocusRef.current = document.activeElement;
      setVisible(true);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [canOfferInstall]);

  React.useEffect(() => {
    if (!visible) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => panelRef.current?.querySelector('[data-pwa-primary]')?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled])')]
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [visible]);

  function dismiss() {
    pwaMarkLater();
    setVisible(false);
    setShowIosSteps(false);
    window.setTimeout(() => lastFocusRef.current?.focus?.(), 0);
  }

  async function install() {
    if (iosSafari) {
      setShowIosSteps(true);
      return;
    }
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    setDeferredPrompt(null);
    pwaDeferredPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') pwaMarkInstalled();
      else pwaMarkLater();
    } catch (_) {
      pwaMarkLater();
    }
    setVisible(false);
  }

  if (!visible || !canOfferInstall) return null;
  const iconUrl = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'pwa-192.png';

  return (
    <div className="ws-pwa-install" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) dismiss();
    }}>
      <section ref={panelRef} className="ws-pwa-install__sheet" role="dialog" aria-modal="true" aria-labelledby="ws-pwa-install-title" aria-describedby="ws-pwa-install-description">
        <span className="ws-pwa-install__handle" aria-hidden="true" />
        <div className="ws-pwa-install__heading">
          <img className="ws-pwa-install__icon" src={iconUrl} alt="" width="56" height="56" />
          <div>
            <h2 id="ws-pwa-install-title">{t('pwa.install.title')}</h2>
            <p id="ws-pwa-install-description">{t('pwa.install.description')}</p>
          </div>
        </div>
        {showIosSteps ? (
          <ol className="ws-pwa-install__steps">
            <li><span aria-hidden="true">⇧</span>{t('pwa.install.iosShare')}</li>
            <li><span aria-hidden="true">＋</span>{t('pwa.install.iosAdd')}</li>
            <li><span aria-hidden="true">✓</span>{t('pwa.install.iosConfirm')}</li>
          </ol>
        ) : (
          <ul className="ws-pwa-install__benefits" aria-label={t('pwa.install.benefits')}>
            <li><span aria-hidden="true">↗</span>{t('pwa.install.fast')}</li>
            <li><span aria-hidden="true">□</span>{t('pwa.install.fullscreen')}</li>
            <li><span aria-hidden="true">✓</span>{t('pwa.install.noStore')}</li>
          </ul>
        )}
        <div className="ws-pwa-install__actions">
          <button type="button" className="ws-pwa-install__primary" data-pwa-primary onClick={showIosSteps ? dismiss : install}>
            {showIosSteps ? t('pwa.install.done') : t('pwa.install.action')}
          </button>
          <button type="button" className="ws-pwa-install__later" onClick={dismiss}>{t('pwa.install.later')}</button>
        </div>
      </section>
    </div>
  );
}

export { PwaInstallPrompt };
