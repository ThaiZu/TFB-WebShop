import { useState } from 'react';

export function OfficeIdentity({ office, compact = false }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const showLogo = office.logo_url && office.logo_url !== failedUrl;
  return <span className="ws-office-identity">
    {showLogo && <img className="ws-office-catalog-logo" src={office.logo_url} alt="" aria-hidden="true" onError={() => setFailedUrl(office.logo_url)}/>}
    {(!compact || !showLogo) && <span>{office.name}</span>}
  </span>;
}
