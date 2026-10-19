import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA + build de production. Le JSX est pré-compilé (plus de Babel navigateur),
// React/ReactDOM sont empaquetés (plus de CDN).
//   base par défaut '/WebShop/' (GitHub Pages) ; le déploiement FTP le passe à '/'
//   (racine du domaine du client) via SITE_BASE — voir .github/workflows/deploy-ftp.yml.
const base = process.env.SITE_BASE || '/WebShop/';
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBase = (env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  let apiUrl;
  try { apiUrl = new URL(apiBase); } catch (_) {
    throw new Error('Set VITE_API_BASE_URL to the absolute API URL, including /api/v1.');
  }
  if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash || apiUrl.pathname !== '/api/v1') {
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) URL ending in /api/v1, without credentials, query or fragment.');
  }
  const isDevelopment = command === 'serve';
  // Chromium treats a request from webshop.tfbuddy.local to a second local
  // hostname as access to another application/device. The browser must only
  // talk to the current webshop origin; Vite forwards /api/v1 server-side.
  // Production may opt in only after its reverse proxy exposes /api/v1 on the
  // webshop hostname. Leaving this off keeps legacy production deployments
  // working instead of silently sending their API calls to a static webserver.
  const useSameOriginApi = isDevelopment || env.VITE_SAME_ORIGIN_API === '1';
  const browserApiBase = useSameOriginApi ? '/api/v1' : apiBase;
  const runtimeConfig = 'window.WS_API_BASE_URL = ' + JSON.stringify(browserApiBase) + ';';
  const standaloneI18n = () => readFileSync(new URL('./webshop-i18n.jsx', import.meta.url), 'utf8').replace("import.meta.env.BASE_URL + 'locales/'", "new URL('locales/', document.currentScript.src).href");
  // Temporary local catalogue images. Preserve paths for the same deployment layout.
  const catalogueImages = {};
  for (const directory of ['product_pictures', 'category_icons', 'season_icons']) {
    const folder = new URL('./assets/' + directory + '/', import.meta.url);
    if (!existsSync(folder)) continue;
    catalogueImages[directory] = readdirSync(folder).filter(name => /\.(png|jpe?g|webp|svg)$/i.test(name)).sort();
  }


  return {
  base,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Vite 5 blocks unknown Host headers. Keep that protection and allow only
    // the HTTPS development domain served by Traefik.
    allowedHosts: ['webshop.tfbuddy.local'],
    // The browser reaches Vite through Traefik over HTTPS, so its HMR socket
    // must use the public secure endpoint rather than the container port.
    hmr: {
      protocol: 'wss',
      host: 'webshop.tfbuddy.local',
      clientPort: 443,
    },
    proxy: {
      '/api/v1': {
        target: apiUrl.origin,
        changeOrigin: true,
        // The local CA is trusted by the browser, but not necessarily by the
        // Node process inside the Vite container.
        secure: false,
      },
    },
    // PHP writes caches, uploads and refreshed product photos inside this bind
    // mount. Those are backend data, not frontend source changes, so watching
    // them can otherwise trigger an unnecessary full-page reload.
    watch: {
      ignored: [
        '**/php-api/**',
        '**/storage/**',
        '**/uploads/**',
        '**/assets/product_pictures/**',
      ],
    },
  },
  // Tampon de build : affiché par ?tapdebug=1 et window.__WS_BUILD pour
  // savoir QUELLE version un téléphone sert réellement (cache SW vs code).
  define: { __WS_LOCAL_IMAGES__: JSON.stringify(catalogueImages), __WS_IMAGE_BASE__: JSON.stringify(base), __WS_API_BASE_URL__: JSON.stringify(browserApiBase), __WS_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC') },
  esbuild: {
    jsx: 'transform', // classic runtime → React.createElement (React injecté ci-dessous)
    jsxInject: "import React from 'react';import * as ReactDOM from 'react-dom/client';",
  },
  plugins: [
    {
      name: 'webshop-local-catalogue-images',
      generateBundle() {
        for (const [directory, names] of Object.entries(catalogueImages)) {
          for (const name of names) this.emitFile({ type: 'asset', fileName: 'assets/' + directory + '/' + name,
            source: readFileSync(new URL('./assets/' + directory + '/' + name, import.meta.url)) });
        }
      },
    },
    {
      // Public standalone HTML pages are copied unchanged by Vite. Give them
      // the same deployment setting as the compiled React application.
      name: 'webshop-api-runtime-config',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = (request.url || '').split('?')[0];
          if ([base + 'i18n-runtime.js', '/i18n-runtime.js'].includes(pathname)) {
            response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            response.setHeader('Cache-Control', 'no-store');
            response.end(standaloneI18n());
            return;
          }
          if (![base + 'api-runtime-config.js', '/api-runtime-config.js'].includes(pathname)) return next();
          response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(runtimeConfig);
        });
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'api-runtime-config.js', source: runtimeConfig });
        this.emitFile({ type: 'asset', fileName: 'i18n-runtime.js', source: standaloneI18n() });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      // A service worker is a production cache. Do not register one while
      // developing, otherwise it can hide source changes from HMR.
      devOptions: { enabled: false },
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: "L'Atelier By — Webshop",
        short_name: "L'Atelier By",
        description: "Commandez en ligne dans votre boutique L'Atelier By.",
        lang: 'fr',
        theme_color: '#8D1D2C',
        background_color: '#EAE4DC',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // FRAÎCHEUR GARANTIE. Un service worker qui précache la coquille HTML a
      // re-servi en production une version PÉRIMÉE du webshop (l'ancien bundle
      // portait encore les boutiques de démo purgées depuis) : le client voyait
      // des données qui n'existent plus nulle part dans le code ni en base.
      //   • cleanupOutdatedCaches : purge les caches des versions précédentes ;
      //   • skipWaiting + clientsClaim : la nouvelle version prend la main tout
      //     de suite, sans attendre la fermeture de tous les onglets ;
      //   • navigateFallbackDenylist /api/ : une navigation vers l'API ne doit
      //     JAMAIS être servie par la coquille en cache ;
      //   • runtimeCaching NetworkFirst sur les navigations : la coquille est
      //     toujours redemandée au serveur (repli cache seulement hors-ligne),
      //     donc un déploiement est visible au rechargement suivant.
      // L'API (/api/…) n'est jamais mise en cache : les données restent vraies.
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['assets/product_pictures/**', 'assets/category_icons/**', 'assets/season_icons/**'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // PAS de fallback de navigation : le scope du SW couvre /webshop/* et
        // le fallback par défaut servait la coquille du WEBSHOP à la place des
        // apps sœurs (/webshop/backoffice_franchisee/…) — le BO s'affichait
        // remplacé par le webshop avec une API introuvable. Chaque navigation
        // part TOUJOURS au serveur (NetworkFirst ci-dessous).
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api\//, /\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'ws-html', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
    {
      name: 'webshop-disable-gtm-in-development',
      transformIndexHtml(html) {
        if (!isDevelopment) return html;
        const developmentHtml = html.replace(
          /<!-- Google Tag Manager[^>]*-->[\s\S]*?<!-- End Google Tag Manager[^>]*-->\s*/g,
          '',
        );
        return developmentHtml;
      },
    },
  ],
  build: { outDir: 'dist', chunkSizeWarningLimit: 2500 },
  };
});
