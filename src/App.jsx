import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchPrice, searchSymbols } from './lib/fetchPrice.js';
import { calculate } from './lib/calculate.js';
import { twFees, isTwEtf } from './lib/twFees.js';
import { translations, detectLang, detectMarket } from './lib/i18n.js';
import { fmt } from './lib/format.js';
import BottomNav from './components/BottomNav.jsx';
import FeeDiscountPage from './components/FeeDiscountPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';

const LS_LANG   = 'sellsignal:lang';
const LS_MARKET = 'sellsignal:market';
const LS_THEME  = 'sellsignal:theme';

// Flagship default symbol per market — auto-fetched on boot / market switch.
const DEFAULT_SYMBOL = { TW: '2330', US: 'TSLA' };

// Read the saved theme once on boot. Default is 'dark' — the app was
// designed dark-first, so an unset preference keeps the original look.
function detectTheme() {
  try {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

// Render a trade timestamp in Taiwan time. Live quote → "6/4 13:25". Stale
// previous-close → "5/20". TPE timezone is forced so the label is the
// same regardless of where the user happens to be.
const fmtTradedAt = (date, isLive) => {
  if (!date) return '';
  const opts = isLive
    ? { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' }
    : { month: 'numeric', day: 'numeric', timeZone: 'Asia/Taipei' };
  return date.toLocaleString('zh-TW', opts);
};

// US quotes are stamped in US Eastern time. Regular session shows the same
// "M/D HH:MM" shape as TW (e.g. "6/4 13:25"); pre/post-market shows the date
// only ("6/4"), paired with a US-Eastern-time marker in the UI. We build the string
// from parts so the timezone is pinned to America/New_York and we avoid the
// stray comma `toLocaleString('en-US', …)` would insert between date and time.
const fmtTradedAtUs = (date, session) => {
  if (!date) return '';
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce((acc, x) => ((acc[x.type] = x.value), acc), {});
  return session === 'regular'
    ? `${p.month}/${p.day} ${p.hour}:${p.minute}`
    : `${p.month}/${p.day}`;
};

export default function App() {
  // --- preferences (persisted) ----------------------------------------------
  const [lang, setLang] = useState(detectLang);
  const [market, setMarket] = useState(() => detectMarket(detectLang()));
  const [theme, setTheme] = useState(detectTheme);
  const [view, setView] = useState('calc');   // 'calc' | 'fees' | 'settings'
  const t = translations[lang];

  useEffect(() => { try { localStorage.setItem(LS_LANG,   lang);   } catch {} }, [lang]);
  useEffect(() => { try { localStorage.setItem(LS_MARKET, market); } catch {} }, [market]);
  // Persist the theme AND reflect it on <html> so the body background (which
  // lives outside .page) re-themes too. Tokens cascade from :root downward.
  useEffect(() => {
    try { localStorage.setItem(LS_THEME, theme); } catch {}
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // --- scroll-reveal scrollbar ---------------------------------------------
  // Show the custom scrollbar only while the user is actively scrolling,
  // then fade it away after ~900 ms of stillness (iOS-style behavior).
  const pageRef = useRef(null);
  useEffect(() => {
    let timer;
    const root = document.documentElement;
    const el   = pageRef.current;
    const reveal = (target) => {
      target.classList.add('is-scrolling');
      clearTimeout(timer);
      timer = setTimeout(() => target.classList.remove('is-scrolling'), 900);
    };
    const onElScroll  = () => el && reveal(el);
    const onWinScroll = () => reveal(root);
    el?.addEventListener('scroll', onElScroll, { passive: true });
    window.addEventListener('scroll', onWinScroll, { passive: true });
    return () => {
      el?.removeEventListener('scroll', onElScroll);
      window.removeEventListener('scroll', onWinScroll);
      clearTimeout(timer);
    };
  }, []);

  // --- form state -----------------------------------------------------------
  const [symbol, setSymbol] = useState(market === 'TW' ? '2330' : 'TSLA');
  const [meta, setMeta] = useState(null);
  const [currentPrice, setCurrentPrice] = useState('415');
  // Optional average cost. Blank → calculate() falls back to currentPrice as
  // the basis (original forward-planning behaviour). When filled it becomes
  // the true cost basis for return %, totals, and the unrealized strip.
  const [costBasis, setCostBasis] = useState('');
  const [amount, setAmount] = useState('1');
  // TW lot vs odd-lot unit for the shares field. 1 lot = 1000 shares. The input box
  // always holds the raw number typed; `shares` (derived below) is what the
  // math actually uses, so switching units never rewrites the user's input.
  const [sharesUnit, setSharesUnit] = useState('lot');
  const [mode, setMode] = useState('percent');
  // Per-mode targets, each starting blank so the field shows only its
  // placeholder hint until the user types — the result then animates in from
  // empty, making the entry feel more responsive. targetValue/setTargetValue
  // below are derived aliases, so all downstream usage stays unchanged.
  const [percentValue, setPercentValue] = useState('');
  const [dollarValue,  setDollarValue]  = useState('');
  const targetValue    = mode === 'percent' ? percentValue : dollarValue;
  const setTargetValue = mode === 'percent' ? setPercentValue : setDollarValue;
  const [feeDiscount, setFeeDiscount] = useState('');
  const [fetchState, setFetchState] = useState({ status: 'idle', msg: '' });

  // --- type-ahead autocomplete ---------------------------------------------
  // suggestions: ranked candidates; showSug: dropdown open; sugIdx: keyboard
  // highlight (-1 = none). typingRef tells the debounce effect apart from
  // PROGRAMMATIC symbol writes (onFetch / market switch), so the dropdown
  // only pops while the user is actually typing — never after a fetch lands.
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [sugIdx, setSugIdx] = useState(-1);
  const typingRef    = useRef(false);
  const blurTimerRef = useRef(null);
  // Last successfully fetched symbol — used to clear the per-position cost
  // basis when the user moves to a different stock.
  const lastSymRef   = useRef(null);
  const mountedRef   = useRef(true);
  const fetchIdRef   = useRef(0);

  // Fee-discount page inputs live in App so they persist across tab switches
  // (they reset only on reload / app close).
  const [feeAmount, setFeeAmount]   = useState('');
  const [feePaidAmt, setFeePaidAmt] = useState('');

  // Fetch a quote for an EXPLICIT symbol + market. Identity-stable (empty deps)
  // so it can sit in the market-switch effect's dependency array — the rigorous
  // alternative to an exhaustive-deps disable. All callers pass sym/mkt
  // explicitly (the market-switch auto-fetch can't wait for setSymbol to flush;
  // the fetch button / Enter key pass the current form state).
  const onFetch = useCallback(async (sym, mkt) => {
    // Every fetch ends the "user is typing" phase. Without this, clicking
    // the fetch button leaves typingRef true, and the setSymbol(r.symbol) writeback
    // below re-triggers the type-ahead effect — popping the dropdown open
    // again over the freshly fetched quote.
    typingRef.current = false;
    const fetchId = ++fetchIdRef.current;
    // True once a newer fetch has started or the component unmounted — used to
    // skip setState on a stale/late response (race guard + unmount leak guard).
    const stale = () => fetchIdRef.current !== fetchId || !mountedRef.current;
    setFetchState({ status: 'loading', msg: '' });
    try {
      const r = await fetchPrice(sym, mkt);
      if (stale()) return;
      // Cost basis belongs to ONE position. Fetching a different symbol
      // (incl. cross-market switches) silently comparing the old cost
      // against the new stock's price would show a nonsense unrealized
      // P&L — so clear it. Re-fetching the same symbol keeps it.
      if (lastSymRef.current && lastSymRef.current !== r.symbol) {
        setCostBasis('');
      }
      lastSymRef.current = r.symbol;
      setSymbol(r.symbol);
      setCurrentPrice(String(r.price));
      setMeta({
        name:     r.name,
        currency: r.currency,
        exchange: r.exchange,
        tradedAt: r.tradedAt || null,
        isLive:   !!r.isLive,
        session:      r.session || 'regular',   // US: 'pre' | 'regular' | 'post'
        sessionPrice: r.sessionPrice ?? null,   // US extended-hours price (display only)
      });
      // msg is only rendered for errors; success state needs no text.
      setFetchState({ status: 'success', msg: '' });
    } catch (e) {
      if (stale()) return;
      // isNetwork (set by fetchPrice for transport failures) lets the render
      // swap the raw technical text for a friendly localized message. We keep
      // the original msg as a fallback for genuine data errors (no-match etc.).
      setFetchState({ status: 'error', msg: e.message, isNetwork: !!(e && e.isNetwork) });
    }
  }, []);

  // Debounced type-ahead. Runs only on user keystrokes (typingRef), skips
  // the programmatic setSymbol from onFetch/market-switch. `alive` guards
  // against a slow request resolving after a newer keystroke (race).
  useEffect(() => {
    if (!typingRef.current) return;
    const q = symbol.trim();
    if (!q) { setSuggestions([]); setShowSug(false); return; }
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const res = await searchSymbols(q, market);
        if (!alive) return;
        setSuggestions(res);
        setShowSug(res.length > 0);
        setSugIdx(-1);
      } catch {
        if (alive) { setSuggestions([]); setShowSug(false); }
      }
    }, 220);
    return () => { alive = false; clearTimeout(id); };
  }, [symbol, market]);

  // Commit a suggestion: stop type-ahead, fill the code, fetch immediately.
  const onSelectSuggestion = useCallback((s) => {
    typingRef.current = false;
    setShowSug(false);
    setSuggestions([]);
    setSugIdx(-1);
    setSymbol(s.code);
    onFetch(s.code, market);
  }, [onFetch, market]);

  // Keyboard nav over the dropdown; falls through to a plain fetch on Enter
  // when nothing is highlighted.
  const onSymbolKeyDown = (e) => {
    if (showSug && suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSugIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSugIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Escape')    { setShowSug(false); return; }
      if (e.key === 'Enter' && sugIdx >= 0) { e.preventDefault(); onSelectSuggestion(suggestions[sugIdx]); return; }
    }
    if (e.key === 'Enter') { typingRef.current = false; setShowSug(false); onFetch(symbol, market); }
  };

  // Boot + every market switch: snap the symbol to that market's flagship
  // default and auto-fetch it once, so each tab lands on a live quote
  // (TW → 2330, US → TSLA) without the user pressing fetch. Switching to the
  // US tab is therefore what triggers the first US fetch. fetchPrice's
  // proxy/retry logic keeps the happy path to a single request. onFetch is
  // identity-stable, so this runs only when `market` actually changes.
  useEffect(() => {
    const def = DEFAULT_SYMBOL[market];
    setSymbol(def);
    setMeta(null);
    onFetch(def, market);
  }, [market, onFetch]);

  // Unmount teardown: cancel any pending blur timer (Leak 1) and mark the
  // component dead so in-flight onFetch calls skip setState (Leak 2).
  // The setup line re-arms mountedRef on every (re)mount: React 18 StrictMode
  // simulates mount→unmount→mount in dev, running the cleanup once — without
  // this reset, mountedRef would stay false and stale() would discard EVERY
  // fetch result, freezing the UI on "Loading…". (Also correct for any real remount.)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(blurTimerRef.current);
    };
  }, []);

  // --- derived --------------------------------------------------------------
  // Effective share count fed to the math. TW lot mode multiplies by 1000
  // (1 lot = 1000 shares); odd-lots and US are taken as the raw number.
  const sharesNum = parseFloat(amount);
  const shares =
    market === 'TW' && sharesUnit === 'lot' && Number.isFinite(sharesNum)
      ? sharesNum * 1000
      : sharesNum;

  // Current price must be a real above-1 quote. Blank (NaN) stays neutral and
  // shows the placeholder hint; an entered value of ≤1 (e.g. 0) is treated as
  // an input error so the output panel shows a price error instead of a bogus
  // result. Real fetched prices are always >1, so this only fires on manual
  // mis-entry.
  const cpParsed = parseFloat(currentPrice);
  const priceInvalid = Number.isFinite(cpParsed) && cpParsed <= 1;

  // calculate() returns null on invalid input (never throws), which the UI
  // renders as the placeholder hint. We also force null when priceInvalid so
  // the dedicated price-error message takes over.
  const result = useMemo(
    () => priceInvalid ? null : calculate({
      currentPrice: parseFloat(currentPrice),
      amount: shares,
      mode,
      targetValue: parseFloat(targetValue),
      costBasis: parseFloat(costBasis),
    }),
    [currentPrice, shares, mode, targetValue, costBasis, priceInvalid],
  );

  // Live unrealized P&L: where the position stands NOW vs the average cost.
  // Independent of the sell goal, so it shows the moment a cost is entered.
  // null (hidden) until cost + shares are valid.
  const unrealized = useMemo(() => {
    const cb = parseFloat(costBasis);
    const cp = parseFloat(currentPrice);
    const sh = shares;
    // Same above-1 price rule as the main result: a ≤1 current price is an
    // input error, so don't render a nonsense unrealized figure from it.
    if (priceInvalid) return null;
    if (![cb, cp, sh].every(Number.isFinite) || cb <= 0 || sh <= 0) return null;
    const profit = (cp - cb) * sh;
    const pct = ((cp - cb) / cb) * 100;
    return { profit, pct, positive: profit >= 0 };
  }, [costBasis, currentPrice, shares, priceInvalid]);

  const currency = meta?.currency || (market === 'TW' ? 'TWD' : 'USD');
  // Money decimals: TW figures are whole-NT$ in practice (and the broker bills
  // in whole NT$), so TW totals/fees show no decimals; US keeps cents. Percentages
  // are unaffected (always 2 dp).
  const md = market === 'TW' ? 0 : 2;
  const isPositive = result && result.profit >= 0;

  // P1 — make the target's reference frame explicit. When a cost basis is
  // supplied, the target return % is measured from COST (current price drops
  // out of the target math), so we label the basis AND show how far the target
  // sits from the live price — otherwise "sell at 1045 = +10%" silently means
  // +10% vs cost, not vs the current price the user also typed.
  const costBasisValid = Number.isFinite(parseFloat(costBasis)) && parseFloat(costBasis) > 0;
  const cpNum = parseFloat(currentPrice);
  const vsCurrentPct =
    result && costBasisValid && Number.isFinite(cpNum) && cpNum > 0
      ? ((result.targetPrice - cpNum) / cpNum) * 100
      : null;

  // TW broker commission + securities tax, layered on top of the raw result.
  // ETF status is read straight off the symbol code (00-prefix). Blank/invalid
  // multiplier means "no discount" (handled inside twFees).
  const isETF = market === 'TW' && isTwEtf(symbol);
  const fees = useMemo(() => {
    if (market !== 'TW' || !result) return null;
    return twFees({
      totalCost:    result.totalCost,
      totalRevenue: result.totalRevenue,
      discount:     parseFloat(feeDiscount),
      isETF,
    });
  }, [market, result, feeDiscount, isETF]);
  const isNetPositive = fees && fees.netProfit >= 0;

  // --- render ---------------------------------------------------------------
  return (
    <div className="page" data-lang={lang} ref={pageRef}>
      <div className="grain" aria-hidden />
      <div className="glow glow-a" aria-hidden />
      <div className="glow glow-b" aria-hidden />

      {view === 'calc' && (
      <main className="grid" data-market={market}>
        {/* LEFT: inputs */}
        <section className="panel form">
          <div className="market-toggle" role="tablist" aria-label={t.marketLabel}>
            <button
              role="tab"
              aria-selected={market === 'TW'}
              className={`market-tab ${market === 'TW' ? 'on' : ''}`}
              onClick={() => setMarket('TW')}
            >{t.market.TW}</button>
            <button
              role="tab"
              aria-selected={market === 'US'}
              className={`market-tab ${market === 'US' ? 'on' : ''}`}
              onClick={() => setMarket('US')}
            >{t.market.US}</button>
            <span className="market-thumb" data-market={market} aria-hidden />
          </div>

          <div className="row symbol-row">
            <label className="field grow sym-field">
              <span className="label">{t.symbolLabel[market]}</span>
              <input
                className="input"
                value={symbol}
                onChange={(e) => { typingRef.current = true; setSymbol(e.target.value); }}
                onKeyDown={onSymbolKeyDown}
                onFocus={() => { if (suggestions.length) setShowSug(true); }}
                onBlur={() => { clearTimeout(blurTimerRef.current); blurTimerRef.current = setTimeout(() => setShowSug(false), 120); }}
                placeholder={t.placeholder[market]}
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={showSug}
                aria-autocomplete="list"
              />
              {showSug && suggestions.length > 0 && (
                <ul className="suggest" role="listbox">
                  {suggestions.map((s, i) => (
                    <li
                      key={s.code}
                      role="option"
                      aria-selected={i === sugIdx}
                      className={`suggest-item${i === sugIdx ? ' on' : ''}${s.kind === 'secondary' ? ' secondary' : ''}`}
                      // onMouseDown (not onClick) so selection fires before the
                      // input's onBlur closes the dropdown.
                      onMouseDown={(e) => { e.preventDefault(); onSelectSuggestion(s); }}
                      onMouseEnter={() => setSugIdx(i)}
                    >
                      <span className="suggest-code">{s.code}</span>
                      <span className="suggest-name">{s.name}</span>
                      {s.kind === 'secondary' && <span className="suggest-tag">{t.warrantTag}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </label>
            <button
              className="btn"
              onClick={() => { setShowSug(false); onFetch(symbol, market); }}
              disabled={fetchState.status === 'loading'}
            >
              {fetchState.status === 'loading' ? t.fetching : t.fetch}
            </button>
          </div>

          {meta && (
            <p className="company">
              <span>{meta.name}</span>
              {meta.exchange && <span className="muted"> · {meta.exchange}</span>}
              {/* TW freshness: any intraday source (matched price OR live
                  best-5 bid/ask) is labelled "live"; only the previous-close
                  fallback is marked "prev close". */}
              {market === 'TW' && meta.tradedAt && (
                <span className={`freshness ${meta.isLive ? 'is-live' : 'is-stale'}`}>
                  {meta.isLive ? t.liveTag : t.prevCloseTag}
                  {' '}
                  {fmtTradedAt(meta.tradedAt, meta.isLive)}
                </span>
              )}
              {/* US regular session: "live" only while the market is actually
                  open; otherwise the regularMarketPrice is the close, so we
                  label it "Close" with the same date & time (US Eastern). */}
              {market === 'US' && meta.tradedAt && meta.session === 'regular' && (
                <span className={`freshness ${meta.isLive ? 'is-live' : 'is-stale'}`}>
                  {meta.isLive ? t.liveTag : t.closeTag} {fmtTradedAtUs(meta.tradedAt, 'regular')}
                </span>
              )}
              {/* US extended-hours chip: pre/post price + date only, and we
                  mark it US Eastern time since trading hours are US-local. */}
              {market === 'US' && meta.sessionPrice != null && (meta.session === 'pre' || meta.session === 'post') && (
                <span className="freshness is-ext">
                  {meta.session === 'pre' ? t.preMarketTag : t.postMarketTag}
                  {' '}
                  {currency} {fmt(meta.sessionPrice, 2)}
                  {meta.tradedAt && <>{' · '}{fmtTradedAtUs(meta.tradedAt, meta.session)} {t.usEasternNote}</>}
                </span>
              )}
            </p>
          )}
          {fetchState.status === 'error' && (
            <p className="error">{fetchState.isNetwork ? t.networkError : fetchState.msg}</p>
          )}

          {/* Price pair: live market price (auto-filled) and the holder's
              average cost, side by side so the strip below reads as a direct
              comparison of the two. */}
          <div className="row">
            <label className="field">
              <span className="label">{t.currentPrice}</span>
              <div className="input-affix">
                <span className="prefix">{currency}</span>
                <input
                  className="input mono"
                  type="number"
                  step="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                />
              </div>
            </label>
            <label className="field">
              <span className="label">
                {t.costBasis}
                <span className="label-note"> · {t.feeOptional}</span>
              </span>
              <div className="input-affix">
                <span className="prefix">{currency}</span>
                <input
                  className="input mono"
                  type="number"
                  step="0.01"
                  value={costBasis}
                  onChange={(e) => setCostBasis(e.target.value)}
                  placeholder="—"
                />
              </div>
            </label>
          </div>

          {/* Live unrealized P&L (now vs your cost). Appears the instant a
              cost is entered — the payoff of the cost-basis field. */}
          {unrealized && (
            <div className={`unrealized ${unrealized.positive ? 'pos' : 'neg'}`}>
              <span className="unrealized-label">{t.unrealizedLabel}</span>
              <span className="unrealized-val mono">
                {unrealized.positive ? '+' : ''}{fmt(unrealized.pct)}%
                <span className="unrealized-sep">·</span>
                {unrealized.positive ? '+' : ''}{currency} {fmt(unrealized.profit, md)}
              </span>
            </div>
          )}

          {/* Shares held + (TW) commission multiplier on one row. The fee
              hint lives BELOW the row (full width) so both fields stay the
              same height and the row's flex-end alignment holds — putting
              the hint inside the fee field made it taller and visibly
              knocked the shares field out of line. On US the fee field is omitted. */}
          <div className="row">
            <label className="field">
              <span className="label">{t.shares}</span>
              {market === 'TW' ? (
                <div className="shares-row">
                  <input
                    className="input mono"
                    type="number"
                    step="1"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1"
                  />
                  <div className="mode-toggle shares-unit" role="tablist" aria-label={t.shares}>
                    <button
                      role="tab"
                      aria-selected={sharesUnit === 'lot'}
                      className={`tab ${sharesUnit === 'lot' ? 'on' : ''}`}
                      onClick={() => setSharesUnit('lot')}
                    >{t.sharesLot}</button>
                    <button
                      role="tab"
                      aria-selected={sharesUnit === 'odd'}
                      className={`tab ${sharesUnit === 'odd' ? 'on' : ''}`}
                      onClick={() => setSharesUnit('odd')}
                    >{t.sharesOdd}</button>
                  </div>
                </div>
              ) : (
                <input
                  className="input mono"
                  type="number"
                  step="1"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1"
                />
              )}
            </label>
            {market === 'TW' && (
              <label className="field">
                <span className="label">
                  {t.feeMultiplier}
                  <span className="label-note"> · {t.feeOptional}</span>
                </span>
                <input
                  className="input mono fee-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={feeDiscount}
                  onChange={(e) => setFeeDiscount(e.target.value)}
                  placeholder={t.feeMultiplierHint}
                />
              </label>
            )}
          </div>
          {market === 'TW' && (
            <span className="field-hint row-hint">{t.feeMinNote}</span>
          )}

          {/* Goal: one unified target-return field; the % suffix / currency prefix
              tells the modes apart, and the percent|dollar switch sits inline
              on the same row instead of taking a whole row of its own. */}
          <div className="row">
            <label className="field grow">
              <span className="label">{t.targetLabel}</span>
              <div className="input-affix">
                {mode === 'dollar' && <span className="prefix">{currency}</span>}
                <input
                  className="input mono big"
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={mode === 'percent' ? '10' : '100'}
                />
                {mode === 'percent' && <span className="suffix">%</span>}
              </div>
            </label>
            <div className="mode-toggle goal-modes" role="tablist" aria-label={t.targetLabel}>
              <button
                role="tab"
                aria-selected={mode === 'percent'}
                className={`tab ${mode === 'percent' ? 'on' : ''}`}
                onClick={() => setMode('percent')}
              >{t.percentMode}</button>
              <button
                role="tab"
                aria-selected={mode === 'dollar'}
                className={`tab ${mode === 'dollar' ? 'on' : ''}`}
                onClick={() => setMode('dollar')}
              >{t.dollarMode}</button>
            </div>
          </div>
        </section>

        {/* RIGHT: result */}
        <section className="panel output">
          <div className="output-head sell-head">
            <span className="kicker">{t.sellWhen}</span>
          </div>

          {result && (
            <div className="input-affix sell-price">
              <span className="prefix">{currency}</span>
              <div className="input mono sell-price-value">{fmt(result.targetPrice, 2)}</div>
            </div>
          )}
          {/* P1 — how far the target sits from the live price. Shown only when a
              cost basis makes the target % measure from cost, not current. */}
          {vsCurrentPct != null && (
            <p className="sell-subnote">
              {t.vsCurrent} {vsCurrentPct >= 0 ? '+' : ''}{fmt(vsCurrentPct)}%
            </p>
          )}

          {result ? (
            <>
              <dl className="stats">
                <div>
                  <dt>{t.totalCost}</dt>
                  <dd className="mono">{currency} {fmt(result.totalCost, md)}</dd>
                </div>
                <div>
                  <dt>{t.totalRevenue}</dt>
                  <dd className="mono">{currency} {fmt(result.totalRevenue, md)}</dd>
                </div>
                <div>
                  <dt>{t.profit}</dt>
                  <dd className={`mono ${isPositive ? 'pos' : 'neg'}`}>
                    {isPositive ? '+' : ''}{currency} {fmt(result.profit, md)}
                  </dd>
                </div>
                <div>
                  <dt>{t.returnPct}</dt>
                  <dd className={`mono ${isPositive ? 'pos' : 'neg'}`}>
                    {isPositive ? '+' : ''}{fmt(result.profitPct)}%
                  </dd>
                </div>
              </dl>

              {/* TW fee breakdown — only when twFees() returns a result.
                  Commission + securities tax as deductions, then the net
                  figures in a tinted box that mirrors the unrealized strip. */}
              {fees && (
                <>
                  <dl className="fees">
                    <div className="fee-row">
                      <dt>{t.buyFee}</dt>
                      <dd className="mono neg">-{currency} {fmt(fees.buyFee, md)}</dd>
                    </div>
                    <div className="fee-row">
                      <dt>{t.sellFee}</dt>
                      <dd className="mono neg">-{currency} {fmt(fees.sellFee, md)}</dd>
                    </div>
                    <div className="fee-row">
                      <dt>
                        {t.secTax}
                        {isETF && <span className="etf-tag">{t.etfTag}</span>}
                      </dt>
                      <dd className="mono neg">-{currency} {fmt(fees.tax, md)}</dd>
                    </div>
                  </dl>
                  {/* Net profit/return on a green/red tint, like the unrealized
                      strip — the headline takeaway of the fee breakdown, with
                      the net profit enlarged so it reads first. */}
                  <div className={`net-summary ${isNetPositive ? 'pos' : 'neg'}`}>
                    <div className="net-row net-row-main">
                      <span className="net-label">{t.netProfit}</span>
                      <span className="net-val mono">
                        {isNetPositive ? '+' : ''}{currency} {fmt(fees.netProfit, md)}
                      </span>
                    </div>
                    <div className="net-row net-row-sub">
                      <span className="net-label">{t.netReturn}</span>
                      <span className="net-val mono">
                        {isNetPositive ? '+' : ''}{fmt(fees.netReturnPct)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : priceInvalid ? (
            <p className="error">{t.priceError}</p>
          ) : (
            <p className="muted">{t.placeholderHint}</p>
          )}

          <footer className="output-foot">
            {/* TW-only fee reminder, kept at the card bottom alongside the
                source/disclaimer so the result area above stays clean. */}
            {market === 'TW' && <span className="muted small">*{t.twFeeNote}</span>}
            {/* Source name is market-aware: TW prices come from TWSE MIS,
                US prices from Yahoo Finance. */}
            <span className="muted small">
              {t.quoteSourceLabel} {market === 'TW' ? t.sourceTW : t.sourceUS}
              {lang === 'zh' ? '，' : '. '}
              {t.disclaimer}
            </span>
          </footer>
        </section>
      </main>
      )}

      {view === 'fees' && (
        <FeeDiscountPage
          t={t}
          lang={lang}
          amount={feeAmount}
          setAmount={setFeeAmount}
          feePaid={feePaidAmt}
          setFeePaid={setFeePaidAmt}
          onApply={(mult) => {
            // Carry the reverse-calculated discount into the sell-target page's
            // commission multiplier. It only applies to TW, so land there.
            setFeeDiscount(String(mult));
            setMarket('TW');
            setView('calc');
          }}
        />
      )}
      {view === 'settings' && <SettingsPage lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t} />}

      <BottomNav view={view} setView={setView} t={t} />
    </div>
  );
}
