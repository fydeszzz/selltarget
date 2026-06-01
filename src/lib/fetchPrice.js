// Market-aware price fetcher.
//
// US:
//   • Yahoo Finance v8 chart + v1 search via corsproxy.io
//   • Works because US tickers don't trip Yahoo's 2023 crumb-auth gate.
//
// TW:
//   • TWSE MIS  (https://mis.twse.com.tw/...)  → real-time price + 漲跌停
//                via corsproxy.io (MIS has no CORS of its own)
//   • TWSE OpenAPI (https://openapi.twse.com.tw/...)  → daily stock list
//                fetched DIRECTLY (native CORS), used only for name→code
//                lookup. Replaced Yahoo's search endpoint, which started
//                returning corsproxy-error 4xxx codes for TW queries.
//
// Other free TW data sources worth knowing (not currently used):
//   • TPEX OpenAPI       https://www.tpex.org.tw/openapi/   上櫃, native CORS
//   • FinMind            https://finmindtrade.com/          daily, free tier
//   • Sinopac Shioaji    real-time tick, requires broker account
//   • Polygon / Alpha Vantage — paid, weak TW coverage

import twStaticList from './tw-stocks.json';

// CORS proxies, tried in order. Free CORS proxies are brittle — any one
// of them can rate-limit or return custom 4xxx errors at any time. A
// fallback chain lets the next one rescue the request transparently.
const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];

// Bundled fallback: ~85 most-traded TW listings. Used when EVERY live
// fetch path fails (all proxies blocked, network offline, etc.). Covers
// the common case at the cost of missing obscure or newly-listed stocks
// — those still work fine via direct numeric code input.
const TW_STATIC = (Array.isArray(twStaticList) ? twStaticList : [])
  .map((s) => ({ code: String(s.code), name: String(s.name) }));

// In Vite dev (`npm run dev`), API calls go through the same-origin
// proxy defined in vite.config.js — that proxy adds the Referer header
// MIS requires for real-time data, and bypasses CORS entirely.
// In production (built/preview), the URLs fall back to the public origin
// and the CORS proxy chain in `proxiedJson()` handles cross-origin.
const DEV         = import.meta.env.DEV;
const YF_CHART    = DEV ? '/api/yahoo/v8/finance/chart/' : 'https://query1.finance.yahoo.com/v8/finance/chart/';
const YF_SEARCH   = DEV ? '/api/yahoo/v1/finance/search' : 'https://query1.finance.yahoo.com/v1/finance/search';
const TWSE_MIS    = DEV ? '/api/mis/stock/api/getStockInfo.jsp' : 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
const TWSE_LIST   = DEV ? '/api/twse/v1/exchangeReport/STOCK_DAY_AVG_ALL' : 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL';

// TWSE 產業類別 codes returned in the MIS `i` field. Same numeric mapping
// works for most TPEx (上櫃) listings since the regulator unified the
// classification a few years back. Codes are 2-digit numeric strings;
// some come back without a leading zero so we pad before lookup.
const TWSE_INDUSTRY = {
  '01': '水泥工業',          '02': '食品工業',
  '03': '塑膠工業',          '04': '紡織纖維',
  '05': '電機機械',          '06': '電器電纜',
  '08': '玻璃陶瓷',          '09': '造紙工業',
  '10': '鋼鐵工業',          '11': '橡膠工業',
  '12': '汽車工業',          '14': '建材營造',
  '15': '航運業',            '16': '觀光餐旅',
  '17': '金融保險業',        '18': '貿易百貨',
  '20': '其他',              '22': '化學工業',
  '23': '生技醫療業',        '24': '半導體業',
  '25': '電腦及週邊設備業',  '26': '光電業',
  '27': '通信網路業',        '28': '電子零組件業',
  '29': '電子通路業',        '30': '資訊服務業',
  '31': '其他電子業',        '32': '文化創意業',
  '33': '農業科技業',        '34': '電子商務',
  '35': '綠能環保',          '36': '數位雲端',
  '37': '運動休閒',          '38': '居家生活',
  '80': '管理股票',
};

function twIndustryName(code) {
  if (!code && code !== 0) return null;
  const key = String(code).padStart(2, '0');
  return TWSE_INDUSTRY[key] || null;
}

/**
 * Fetch JSON with proxy fallback.
 *
 * - Same-origin URLs (starting with `/`) are fetched directly. In dev,
 *   these hit Vite's proxy and get server-side forwarding with the right
 *   headers. In a production same-origin deploy, they'd hit a backend.
 * - External URLs walk the PROXIES chain.
 * - `tryDirect` allows an initial un-proxied attempt for origins that
 *   sometimes serve CORS headers (e.g., TWSE OpenAPI).
 */
async function proxiedJson(url, { tryDirect = false } = {}) {
  // Same-origin (Vite dev proxy or production backend) — single direct fetch.
  if (url.startsWith('/')) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Cross-origin — try direct (optional) then the CORS proxy fallback chain.
  const attempts = [];
  if (tryDirect) attempts.push(url);
  for (const proxy of PROXIES) attempts.push(proxy + encodeURIComponent(url));

  let lastErr;
  for (const target of attempts) {
    try {
      const res = await fetch(target, { headers: { accept: 'application/json' } });
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All endpoints failed');
}

// ─────────── TW path: TWSE MIS ───────────────────────────────────────────

// Query both 上市 (tse_) and 上櫃 (otc_) in one shot; keep whichever has data.
async function fetchTwPrice(rawInput) {
  // Strip any exchange suffix the user may have typed/pasted, or that an
  // earlier fetch wrote back (e.g. "2330.TW", "6488.TWO"). TW stocks are
  // addressed by their bare numeric code everywhere in this app.
  const input = String(rawInput || '').trim().replace(/\.two?$/i, '');
  if (!input) throw new Error('輸入股票代號或名稱。');

  const code = /^\d{4,6}$/.test(input) ? input : await resolveTwName(input);
  if (!code) throw new Error(`找不到 "${input}"。`);

  // Cache-buster suffix because some proxies cache aggressively.
  const url  = `${TWSE_MIS}?ex_ch=tse_${code}.tw|otc_${code}.tw&json=1&delay=0&_=${Date.now()}`;
  const json = await proxiedJson(url);

  if (json?.rtcode && json.rtcode !== '0000') {
    throw new Error(`TWSE 回應 ${json.rtcode}: ${json.rtmessage || 'unknown'}`);
  }
  const rows = json?.msgArray ?? [];
  // Prefer a row with z, then pz, then y. (MIS sometimes returns
  // multiple rows — one tse, one otc — and we pick the most-populated.)
  const positive = (v) => {
    const n = parseFloat(v);
    return v != null && v !== '-' && Number.isFinite(n) && n > 0;
  };
  const row =
    rows.find((r) => positive(r.z))  ??
    rows.find((r) => positive(r.pz)) ??
    rows.find((r) => positive(r.y))  ??
    rows[0];
  if (!row) throw new Error(`${code} 查無報價 (代號是否正確？)`);

  // Diagnostic: in dev, log the raw price fields so we can see whether
  // MIS is actually serving live data. Open DevTools → Console.
  if (import.meta.env.DEV) {
    console.log('[MIS]', code, {
      z: row.z, pz: row.pz, y: row.y,
      d: row.d, t: row.t, tlong: row.tlong,
      ex: row.ex,
    });
  }

  // Price priority: z (current matched) → pz (last matched) → y (yesterday).
  // In active trading z is set; during the gap between matches z is "-"
  // but pz still holds the last actual trade — which is the "real" price.
  // Only when both z and pz are missing do we fall to y.
  const z  = positive(row.z)  ? parseFloat(row.z)  : NaN;
  const pz = positive(row.pz) ? parseFloat(row.pz) : NaN;
  const y  = positive(row.y)  ? parseFloat(row.y)  : NaN;
  const price = Number.isFinite(z) ? z : Number.isFinite(pz) ? pz : y;
  if (!Number.isFinite(price)) {
    throw new Error(`${code} 暫無價格資料。`);
  }

  const boardLabel = row.ex === 'otc' ? '上櫃' : '上市';
  const industry   = twIndustryName(row.i);
  const exchange   = industry ? `${boardLabel} - ${industry}` : boardLabel;

  // Trade timestamp. MIS provides `tlong` (Unix ms) when a trade exists.
  // `isLive` distinguishes a real-time intraday quote from a previous-day
  // close fallback — used by the UI to label the freshness.
  const tlong    = row.tlong ? parseInt(row.tlong, 10) : null;
  const tradedAt = Number.isFinite(tlong) ? new Date(tlong) : null;
  const isLive   = !!(row.z && row.z !== '-');

  return {
    // Plain numeric code, no exchange suffix. The 上市/上櫃 board is conveyed
    // via `exchange` below; the suffix would otherwise be written back into
    // the symbol field and break the next fetch / ETF detection.
    symbol:   code,
    name:     row.n || row.nf || code,
    price,
    currency: 'TWD',
    exchange,
    industry,
    tradedAt,                         // Date | null
    isLive,                           // true when z is a fresh intraday tick
    limits:   {
      limitUp:   parseFloat(row.u),
      limitDown: parseFloat(row.w),
      prevClose: y,
      source:    'TWSE',
    },
  };
}

// ─────────── TW name → code resolution via TWSE OpenAPI ──────────────────
//
// Yahoo's search endpoint started returning proxy-blocked errors (HTTP
// 4xxx from corsproxy) in 2024 for TW queries, so we switched to TWSE's
// own OpenAPI. It returns the full listed-stock catalog as plain JSON
// with native CORS — no proxy needed. ~1500 entries, ~120 KB. We fetch
// it once per session and cache the promise.
let twListPromise = null;

async function loadTwStockList() {
  if (twListPromise) return twListPromise;
  twListPromise = (async () => {
    try {
      // Try direct first (TWSE OpenAPI sometimes serves CORS), then walk
      // the proxy fallback chain.
      const data = await proxiedJson(TWSE_LIST, { tryDirect: true });
      const live = (Array.isArray(data) ? data : [])
        .filter((s) => s?.Code && s?.Name)
        .map((s) => ({ code: s.Code, name: s.Name }));
      if (live.length > 0) return live;
      // Live returned empty — fall through to static.
      return TW_STATIC;
    } catch (e) {
      // Every live attempt failed. Don't crash — use the bundled list.
      // We do *not* null `twListPromise` here, so subsequent calls in
      // this session skip the (slow, failing) network attempts and use
      // the static list immediately.
      console.warn(`TWSE list fetch failed (${e.message}); using bundled fallback.`);
      return TW_STATIC;
    }
  })();
  return twListPromise;
}

async function resolveTwName(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  if (/^\d{4,6}$/.test(q)) return q;           // already a numeric code

  const list = await loadTwStockList();
  // Lookup priority: exact name > name contains > code starts with.
  // (Exact wins so "台積電" returns 2330, not a fund whose name CONTAINS 台積電.)
  const hit =
    list.find((s) => s.name === q) ||
    list.find((s) => s.name.includes(q)) ||
    list.find((s) => s.code.startsWith(q));
  return hit ? hit.code : null;
}

// ─────────── US path: Yahoo ──────────────────────────────────────────────

function looksLikeUsTicker(s) {
  return /^[A-Z][A-Z0-9.\-]{0,6}$/i.test(s);
}

async function searchUsSymbol(query) {
  const params = new URLSearchParams({
    q: query,
    quotesCount: '5',
    newsCount: '0',
    lang: 'en-US',
    region: 'US',
  });
  const json = await proxiedJson(`${YF_SEARCH}?${params}`);
  return (json?.quotes ?? []).find((q) => !/\.TW[O]?$/i.test(q.symbol)) ?? null;
}

// Classify the most-recent K-bar as pre / regular / post by testing its
// timestamp against the trading-period windows Yahoo returns. The v8 chart
// endpoint has NO `marketState` field, so this time-window comparison is the
// only way to know which session the latest tick belongs to.
//
// Returns { session, sessionPrice }:
//   • session = 'pre' | 'post' | 'regular'
//   • sessionPrice = the extended-hours price (only for pre/post; null otherwise)
// When markets are fully closed the last bar falls outside today's pre/post
// windows → session 'regular', no label. That's the correct, safe fallback.
function classifyUsSession(result) {
  const ts     = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const tp     = result?.meta?.currentTradingPeriod ?? {};

  // Last bar with a real (non-null) close.
  let i = ts.length - 1;
  while (i >= 0 && typeof closes[i] !== 'number') i--;
  if (i < 0) return { session: 'regular', sessionPrice: null };

  const t   = ts[i];
  const px  = closes[i];
  const inWindow = (w) => w && typeof w.start === 'number' && t >= w.start && t < w.end;

  let session = 'regular';
  if      (inWindow(tp.post)) session = 'post';
  else if (inWindow(tp.pre))  session = 'pre';

  return {
    session,
    sessionPrice: session !== 'regular' && Number.isFinite(px) ? px : null,
  };
}

async function fetchUsPrice(rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) throw new Error('Enter a symbol or name.');

  let symbol;
  if (looksLikeUsTicker(input)) {
    symbol = input.toUpperCase();
  } else {
    const match = await searchUsSymbol(input);
    if (!match?.symbol) throw new Error(`No match for "${input}".`);
    symbol = match.symbol;
  }

  // includePrePost=true + 1-minute bars over the day so the chart carries the
  // pre/post-market ticks (and the pre/regular/post window boundaries).
  const json   = await proxiedJson(
    `${YF_CHART}${encodeURIComponent(symbol)}?includePrePost=true&interval=1m&range=1d`,
  );
  const result = json?.chart?.result?.[0];
  const err    = json?.chart?.error;
  if (err)     throw new Error(err.description || err.code || 'Yahoo error');
  if (!result) throw new Error(`Symbol "${symbol}" not found.`);

  const meta  = result.meta || {};
  const price = meta.regularMarketPrice;
  if (typeof price !== 'number') throw new Error('Price unavailable.');

  // Display-only extended-hours price. The calculator keeps using `price`
  // (the regular session price) so the math is unchanged.
  const { session, sessionPrice } = classifyUsSession(result);

  return {
    symbol:   meta.symbol || symbol,
    name:     meta.longName || meta.shortName || meta.symbol || symbol,
    price,
    currency: meta.currency || 'USD',
    exchange: meta.exchangeName || meta.fullExchangeName || '',
    session,                                            // 'pre' | 'regular' | 'post'
    sessionPrice,                                       // number | null (pre/post only)
  };
}

// ─────────── public entry point ──────────────────────────────────────────

export async function fetchPrice(rawInput, market = 'US') {
  return market === 'TW' ? fetchTwPrice(rawInput) : fetchUsPrice(rawInput);
}
