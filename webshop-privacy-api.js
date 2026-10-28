/* Configuration failure never blocks shopping and disables every adapter. */
export async function loadPrivacyConfiguration(endpoint, { fetcher = fetch, consent = window.WSConsent } = {}) {
  if (!consent) return false;
  consent.configure(null);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetcher(endpoint, {
      headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) return false;
    return consent.configure(await response.json());
  } catch (_) {
    consent.configure(null);
    return false;
  } finally { clearTimeout(timeout); }
}
