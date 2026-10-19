window.WSPageReady.then(async function () {
  const I = window.WSI18n;
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  history.replaceState(null, '', location.pathname);
  // Opening another activation link in this tab may be a hash-only navigation.
  window.addEventListener('hashchange', function () {
    if (location.hash.startsWith('#token=')) location.reload();
  });
  const button = document.getElementById('confirmActivation');
  const status = document.getElementById('activationMessage');
  const resend = document.getElementById('resendActivation');
  const sendButton = document.getElementById('resendButton');
  let statusKey = token ? '' : 'activation.invalid';
  let pending = false, activated = false;
  function render() {
    status.textContent = statusKey ? I.t(statusKey) : '';
    button.textContent = I.t(pending ? 'ui.saving' : 'activation.confirm');
    button.disabled = !token || pending || activated;
  }
  I.onChange(render); render();
  async function post(path, body) {
    const base = window.WS_API_BASE_URL;
    if (!base) throw new Error('CLIENT_ACTIVATION_UNAVAILABLE');
    const response = await fetch(base + '/clients/auth/activation/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.description || data.message || 'CLIENT_ACTIVATION_UNAVAILABLE');
    return data;
  }
  button.addEventListener('click', async function () {
    if (pending || activated || !token) return;
    pending = true; render();
    try {
      await post('confirm', { token });
      activated = true; statusKey = 'activation.success'; resend.hidden = true;
    } catch (error) {
      statusKey = error.message === 'CLIENT_ACTIVATION_INVALID' ? 'activation.invalid' : 'activation.unavailable';
    } finally { pending = false; render(); }
  });
  resend.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sendButton.disabled) return;
    const email = document.getElementById('activationEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { statusKey = 'error.email'; render(); return; }
    sendButton.disabled = true;
    try { await post('resend', { email }); statusKey = 'activation.resent'; }
    catch (_) { statusKey = 'activation.sendError'; }
    finally { sendButton.disabled = false; render(); }
  });
});
