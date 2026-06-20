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

// Electron desktop bridge (set by electron/preload.cjs). Present only in the
// packaged app; undefined in the browser/dev builds.
const electronFetch = () =>
  (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.fetchJson) || null;

// Per-request timeout. A hung connection (a proxy stalls, the network drops)
// would otherwise leave fetch() pending forever and the UI stuck on 查詢中….
// We abort after this many ms so the next proxy — and ultimately withRetry()'s
// auto re-query — can take over, then surface a real error instead of an
// indefinite spinner.
const REQUEST_TIMEOUT_MS = 5000;

// fetch() with an AbortController timeout. Aborting actually cancels the
// underlying request (frees the socket / proxy slot), unlike a bare Promise
// race that leaves the connection dangling.
async function fetchWithTimeout(target, opts = {}, ms = REQUEST_TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(target, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Race a non-abortable promise (the Electron native fetch) against a timeout so
// it can't hang the attempt chain either.
function withTimeoutRace(promise, ms = REQUEST_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Fetch JSON with proxy fallback.
 *
 * - In the Electron desktop app, every absolute URL goes through the main
 *   process (native network stack: no CORS, MIS Referer injected). This is
 *   the most reliable path and skips the public proxy chain entirely.
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
    const res = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Cross-origin. Build an ordered attempt chain and take the first success.
  //
  //   1. Electron native fetch (no CORS, MIS Referer injected) — the reliable
  //      path for the desktop app.
  //   2. A SECOND native try after a short pause. TWSE MIS occasionally resets
  //      the connection mid-flight (net::ERR_CONNECTION_RESET); the native
  //      stack recovers on a quick retry far more reliably than the public
  //      proxies do. This matters most in the packaged app, which loads over
  //      file:// — its fetch Origin is `null`, and most public CORS proxies
  //      reject that (corsproxy 403, allorigins needs a real Origin). So the
  //      native retry, not the proxy chain, is what actually heals a transient
  //      reset here; doing it first also avoids stalling on a dead proxy.
  //   3. The public CORS-proxy chain as a last resort — and the ONLY path in
  //      the browser/dev build, where `ef` is null and the chain below is
  //      identical to the original browser-only behaviour.
  const ef = electronFetch();
  const attempts = [];
  if (ef && /^https?:/i.test(url)) {
    attempts.push({ via: 'electron', target: url });
    attempts.push({ via: 'electron', target: url, pauseBefore: 400 });
  }
  if (tryDirect)               attempts.push({ via: 'fetch', target: url });
  for (const proxy of PROXIES) attempts.push({ via: 'fetch', target: proxy + encodeURIComponent(url) });

  let lastErr;
  for (const { via, target, pauseBefore } of attempts) {
    if (pauseBefore) await new Promise((r) => setTimeout(r, pauseBefore));
    try {
      if (via === 'electron') return await withTimeoutRace(ef(target));
      const res = await fetchWithTimeout(target, { headers: { accept: 'application/json' } });
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
  const positive = (v) => {
    const n = parseFloat(v);
    return v != null && v !== '-' && Number.isFinite(n) && n > 0;
  };
  // MIS 五檔 (best-5 order book) come as underscore-joined strings, best
  // first: `b` = bids high→low, `a` = asks low→high. The first segment is
  // the best bid / best ask.
  const firstQuote = (s) => {
    const first = String(s ?? '').split('_')[0];
    const n = parseFloat(first);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };
  // Pick the most-populated row. MIS often returns two rows (one tse, one
  // otc) and only one has data. Since TWSE now withholds z/pz on the
  // public feed during trading, we also accept a row that only has a live
  // best-bid (五檔) so a trading stock isn't mistaken for "no quote".
  const row =
    rows.find((r) => positive(r.z))  ??
    rows.find((r) => positive(r.pz)) ??
    rows.find((r) => Number.isFinite(firstQuote(r.b))) ??
    rows.find((r) => positive(r.y))  ??
    rows[0];
  if (!row) throw new Error(`${code} 查無報價 (代號是否正確？)`);

  // Diagnostic: in dev, log the raw price fields so we can see whether
  // MIS is actually serving live data. Open DevTools → Console.
  if (import.meta.env.DEV) {
    console.log('[MIS]', code, {
      z: row.z, pz: row.pz, y: row.y,
      b: row.b, a: row.a,
      d: row.d, t: row.t, tlong: row.tlong,
      ex: row.ex,
    });
  }

  // Price priority: z (current match) → pz (last match) → best bid → best
  // ask → y (yesterday).
  //
  // TWSE MIS stopped returning z/pz (last-traded price) on the free public
  // feed during continuous trading — only the 五檔 order book stays live.
  // So when z/pz are blank we use the BEST BID: the price you can sell into
  // right now, which is exactly what a sell-decision calculator wants.
  // Best ask is a secondary fallback (e.g. limit-up with no bids); only
  // when the whole book is empty do we fall back to yesterday's close.
  const z   = positive(row.z)  ? parseFloat(row.z)  : NaN;
  const pz  = positive(row.pz) ? parseFloat(row.pz) : NaN;
  const y   = positive(row.y)  ? parseFloat(row.y)  : NaN;
  const bid = firstQuote(row.b);
  const ask = firstQuote(row.a);

  let price, priceSource;
  if      (Number.isFinite(z))   { price = z;   priceSource = 'matched'; }
  else if (Number.isFinite(pz))  { price = pz;  priceSource = 'matched'; }
  else if (Number.isFinite(bid)) { price = bid; priceSource = 'bid'; }
  else if (Number.isFinite(ask)) { price = ask; priceSource = 'ask'; }
  else                           { price = y;   priceSource = 'prevClose'; }
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
  // "Live" means the price reflects today's market, not yesterday's close.
  // A matched price OR a live best-bid/ask from the 五檔 all count as live;
  // only the prevClose fallback is stale.
  const isLive   = priceSource !== 'prevClose';

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
    isLive,                           // true for any intraday source
    priceSource,                      // 'matched' | 'bid' | 'ask' | 'prevClose'
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

  // Reuse the ranked search so an exact "取得" by name lands on the real
  // stock (e.g. 國巨 → 2327), never a warrant that merely shares the prefix.
  const ranked = await searchTwSymbols(q, 1);
  return ranked.length ? ranked[0].code : null;
}

// ─────────── Autocomplete: ranked symbol search ──────────────────────────
//
// Powers the type-ahead dropdown. Unlike resolveTwName (which returns one
// code for the 取得 button), this returns MANY candidates so the user can
// pick. Ranking has two independent axes:
//
//   1. KIND  — a real 股票/ETF outranks a 權證/槓桿/債券/other. This is the
//              "優先度以股票本身為主，權證、槓桿其次" the user asked for.
//   2. MATCH — within the same kind, an exact name beats a name-prefix,
//              which beats a code-prefix, which beats a mere substring.
//
// classifyTwSymbol holds the domain rule for axis 1 — the one place to tune
// when you find a listing miscategorised (e.g. a new warrant code range).

/**
 * Decide whether a TW listing is a primary 股票/ETF or a secondary
 * 權證/槓桿/債券/其他. Returns 'stock' | 'secondary'.
 *
 * Heuristics (a reasonable default — tune freely):
 *   • Warrant 權證 — 6-digit code NOT starting with "00" (ETFs are 00xxxx),
 *     or a name carrying a warrant marker (購/售 call/put, 牛/熊 bull/bear).
 *   • Leverage 槓桿/反向 — name contains 正2 / 反1 / 槓桿 / 反向.
 *   • Bond 債券 — name contains 債.
 */
function classifyTwSymbol(code, name) {
  const c = String(code);
  const n = String(name);
  const warrant  = /[購售]|牛\d|熊\d/.test(n) || (c.length === 6 && !c.startsWith('00'));
  const leverage = /正\s?2|反\s?1|槓桿|反向/.test(n);
  const bond     = /債/.test(n);
  return (warrant || leverage || bond) ? 'secondary' : 'stock';
}

export async function searchTwSymbols(query, limit = 20) {
  const q = String(query || '').trim();
  if (!q) return [];

  const list = await loadTwStockList();
  const numeric = /^\d+$/.test(q);

  const scored = [];
  for (const s of list) {
    const name = String(s.name);
    const code = String(s.code);

    // MATCH rank: lower is better. Numeric queries only match codes.
    let matchRank;
    if (name === q)                       matchRank = 0;   // exact name
    else if (name.startsWith(q))          matchRank = 1;   // name prefix
    else if (numeric && code.startsWith(q)) matchRank = 2; // code prefix
    else if (name.includes(q))            matchRank = 3;   // substring
    else continue;                                         // no match

    const kind = classifyTwSymbol(code, name);
    scored.push({ code, name, kind, kindRank: kind === 'stock' ? 0 : 1, matchRank });
  }

  scored.sort((a, b) =>
    a.kindRank  - b.kindRank  ||        // 股票/ETF before 權證/槓桿
    a.matchRank - b.matchRank ||        // exact → prefix → substring
    a.code.length - b.code.length ||    // shorter (4-digit) codes first
    a.code.localeCompare(b.code));

  return scored.slice(0, limit);
}

export async function searchUsSymbols(query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) return [];

  const params = new URLSearchParams({
    q, quotesCount: '10', newsCount: '0', lang: 'en-US', region: 'US',
  });
  const json = await proxiedJson(`${YF_SEARCH}?${params}`);

  // Drop TW listings (handled by the TW tab) and rank EQUITY/ETF above the
  // rest. Yahoo already orders by relevance, so a stable sort within each
  // kind preserves that secondary ordering.
  const kindRank = (qt) => (qt === 'EQUITY' || qt === 'ETF' ? 0 : 1);
  return (json?.quotes ?? [])
    .filter((x) => x.symbol && !/\.TW[O]?$/i.test(x.symbol))
    .map((x) => {
      const rank = kindRank(x.quoteType);
      return {
        code: x.symbol,
        name: x.shortname || x.longname || x.symbol,
        kind: rank === 0 ? 'stock' : 'secondary',
        kindRank: rank,
      };
    })
    .sort((a, b) => a.kindRank - b.kindRank)
    .slice(0, limit);
}

/** Market-aware type-ahead search. Returns [{ code, name, kind }]. */
export function searchSymbols(query, market = 'US') {
  return market === 'TW' ? searchTwSymbols(query) : searchUsSymbols(query);
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
  if (i < 0) return { session: 'regular', sessionPrice: null, tradedAt: null };

  const t   = ts[i];
  const px  = closes[i];
  const inWindow = (w) => w && typeof w.start === 'number' && t >= w.start && t < w.end;

  let session = 'regular';
  if      (inWindow(tp.post)) session = 'post';
  else if (inWindow(tp.pre))  session = 'pre';

  return {
    session,
    sessionPrice: session !== 'regular' && Number.isFinite(px) ? px : null,
    tradedAt: Number.isFinite(t) ? new Date(t * 1000) : null,   // last bar time
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
  const { session, sessionPrice, tradedAt: barTime } = classifyUsSession(result);

  // Timestamp shown in the status. For the regular session prefer Yahoo's
  // `regularMarketTime` (the official last-trade time); for pre/post fall
  // back to the last extended-hours bar. Rendered in US Eastern by the UI.
  const tradedAt =
    session === 'regular' && typeof meta.regularMarketTime === 'number'
      ? new Date(meta.regularMarketTime * 1000)
      : barTime;

  return {
    symbol:   meta.symbol || symbol,
    name:     meta.longName || meta.shortName || meta.symbol || symbol,
    price,
    currency: meta.currency || 'USD',
    exchange: meta.exchangeName || meta.fullExchangeName || '',
    tradedAt,                                           // Date | null (US Eastern)
    session,                                            // 'pre' | 'regular' | 'post'
    sessionPrice,                                       // number | null (pre/post only)
  };
}

// ─────────── public entry point ──────────────────────────────────────────

// Bounded vertical retry. `proxiedJson` already gives HORIZONTAL fallback
// (direct + each CORS proxy, stopping on the first success — so a healthy
// fetch costs just one request). This wrapper adds a single retry of the
// WHOLE operation for transient failures (a brief network blip, or every
// proxy momentarily rate-limited). Capped at one retry on purpose: a
// failing fetch makes at most two full passes, never an endless loop that
// would hammer the free APIs/proxies.
async function withRetry(fn, { retries = 1, delay = 600 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function fetchPrice(rawInput, market = 'US') {
  return withRetry(() =>
    market === 'TW' ? fetchTwPrice(rawInput) : fetchUsPrice(rawInput),
  );
}
