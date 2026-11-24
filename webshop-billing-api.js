// Billing always uses the authenticated central API, never the legacy PHP adapter.
export async function billingRequest(path, {method = 'GET', body, pdf = false} = {}) {
  const auth = window.WSAuth;
  const endpoint = auth?.endpoint;
  if (!endpoint || !auth?.authenticatedFetch) throw new Error('BILLING_UNAVAILABLE');
  const {response, data} = await auth[pdf ? 'authenticatedBlob' : 'authenticatedJson'](endpoint.replace(/\/clients\/auth\/?$/, '/webshop/billing') + path, {
    method, credentials: 'include', headers: body ? {'Content-Type': 'application/json'} : {},
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
  if (pdf && response.ok) {
    if (!(response.headers.get('content-type') || '').includes('application/pdf')) throw new Error('BILLING_UNAVAILABLE');
    return data;
  }
  if (!response.ok) throw new Error(data.description || data.error || 'BILLING_UNAVAILABLE');
  return data;
}

export function billingError(error) {
  const t = window.WSI18n.t;
  const key = 'billing.error.' + error?.message;
  const translated = t(key);
  return translated === key ? t('billing.error.generic') : translated;
}

export function saveInvoicePdf(blob, number) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'invoice-' + String(number).replace(/[^a-z0-9-]/gi, '_') + '.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
