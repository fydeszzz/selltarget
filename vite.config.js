import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Multi-page build: the original phone-style app (index.html, also packaged by
// Electron) and the web build (web.html). Listing both as Rollup inputs makes
// `vite build` emit both pages; the Electron build still loads only index.html.
const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// Single source of truth for the app version: package.json "version".
// Injected into the renderer as __APP_VERSION__ (see SettingsPage.jsx) so the
// number shown in-app can never drift from the one electron-builder stamps on
// the installer. Bump the version in package.json ONLY.
const { version: APP_VERSION } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

// Dev-time API proxies. These route same-origin paths (/api/mis, /api/twse,
// /api/yahoo) to the actual upstream services with the right Referer/Host
// headers, which solves two problems at once:
//
//   1. CORS — proxy is server-side so no browser CORS preflight at all.
//   2. MIS's anti-leech check — without Referer: mis.twse.com.tw/..., MIS
//      returns stale data (z = "-") even during market hours, which is why
//      previous-day close kept showing up despite the live endpoint being
//      "real-time." Setting the Referer here makes MIS return the actual
//      intraday tick.
//
// Caveat: these only run under `npm run dev`. For a static production
// build, the app falls back to public CORS proxies (defined in
// src/lib/fetchPrice.js) — slower, less reliable, and may not give live
// MIS data due to the same Referer issue. A real production deploy
// should run a server-side proxy (Vercel function, Netlify function,
// Cloudflare Worker, etc.) that replicates these forwards.
export default defineConfig({
  // Relative asset paths so the built bundle loads under Electron's
  // file:// protocol (absolute "/assets/..." would 404 there). Harmless
  // for a normal web deploy served from the domain root.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    rollupOptions: {
      input: { main: r('./index.html'), web: r('./web.html') },
    },
  },
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/mis': {
        target: 'https://mis.twse.com.tw',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/mis/, ''),
        headers: {
          Referer: 'https://mis.twse.com.tw/stock/fibest.jsp?stock=2330',
        },
      },
      '/api/twse': {
        target: 'https://openapi.twse.com.tw',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/twse/, ''),
      },
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        // Yahoo Finance now returns HTTP 429 for requests without a
        // browser-like User-Agent. Forcing one here is what makes US
        // quotes work (TW/MIS don't check UA, which is why they still did).
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      },
    },
  },
});
