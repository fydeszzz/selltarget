import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
      },
    },
  },
});
