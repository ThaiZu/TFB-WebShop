/* Vite entry : imports everything in the same order as the legacy HTML.
   The stubs attach window.WSXxx (side-effect imports); the last import
   (webshop-full-bundle) mounts the app via ReactDOM.createRoot. React and
   ReactDOM are injected into every file by vite.config esbuild.jsxInject. */

// Styles
import '../admin.css';
import '../webshop.css';
import '../webshop-detail.css';
import '../webshop-i18n.css';
import '../webshop-profile-extras.css';
import '../webshop-allergens.css';
import '../webshop-office.css';
import '../webshop-pwa-install.css';

// Bandeau d'erreur : EN PREMIER : il doit pouvoir signaler l'échec de
// n'importe quel import qui suit, y compris celui qui monte l'application.
import '../webshop-bug-banner.jsx';
import '../webshop-pwa-install.jsx';

// API stubs : must run before the components (they expose window.WSXxx).
import '../webshop-deep-link.js';
import '../webshop-i18n.jsx';
import '../webshop-vies.jsx';
import '../webshop-shops-api.jsx';
import '../webshop-shop-router.jsx';
import '../webshop-offices-api.jsx';
import '../webshop-calendar-api.jsx';
import '../webshop-availability-api.jsx';
import '../webshop-slots-api.jsx';
import '../webshop-delivery-fees-api.jsx';
import '../webshop-catalog-api.jsx';
import '../webshop-brand-api.jsx';
import '../webshop-auth-api.jsx';
import '../webshop-quote-api.jsx';
import '../webshop-tours-api.jsx';
import '../webshop-orders-api.jsx';
import '../webshop-companies-api.jsx';
import '../webshop-payments-api.jsx';
import '../qr.jsx';                    // encodeur QR (window.QR) : modale fidélité

// Central config (sets endpoints from BASE_URL).
import '../api-config.js';

// React components + the main app (mounts on import).
import '../webshop-i18n-react.jsx';
import '../webshop-allergens.jsx';
import '../webshop-full-bundle.jsx';

import { createGa4Adapter } from '../webshop-ga4.js';
window.WSConsent?.register('ga4', createGa4Adapter());

// Independent of catalogue/checkout boot; failures keep integrations disabled.
import { loadPrivacyConfiguration } from '../webshop-privacy-api.js';
void loadPrivacyConfiguration(__WS_API_BASE_URL__ + '/webshop/privacy-config');
