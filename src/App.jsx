import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPrice } from './lib/fetchPrice.js';
import { calculate } from './lib/calculate.js';
import { priceLimits } from './lib/priceLimits.js';
import { twFees, isTwEtf } from './lib/twFees.js';
import { translations, detectLang, detectMarket } from './lib/i18n.js';
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

const fmt = (n, digits = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';

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
// only ("6/4"), paired with a 美東時間 marker in the UI. We build the string
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
  const [amount, setAmount] = useState('10');
  const [mode, setMode] = useState('percent');
  // Per-mode targets so each keeps its own sensible default
  // (% return = 10, $ profit = 1000). targetValue/setTargetValue below are
  // derived aliases, so all downstream usage stays unchanged.
  const [percentValue, setPercentValue] = useState('10');
  const [dollarValue,  setDollarValue]  = useState('1000');
  const targetValue    = mode === 'percent' ? percentValue : dollarValue;
  const setTargetValue = mode === 'percent' ? setPercentValue : setDollarValue;
  const [feeDiscount, setFeeDiscount] = useState('');
  const [fetchState, setFetchState] = useState({ status: 'idle', msg: '' });

  // 手續費折數頁的輸入提升到 App，讓切換分頁時保留（重新整理/關閉 App 才重置）。
  const [feeAmount, setFeeAmount]   = useState('');
  const [feePaidAmt, setFeePaidAmt] = useState('');

  // Boot + every market switch: snap the symbol to that market's flagship
  // default and auto-fetch it once, so each tab lands on a live quote
  // (台股 → 2330 台積電, 美股 → TSLA) without the user pressing 取得. Switching
  // to 美股 is therefore what triggers the first US fetch. fetchPrice's
  // proxy/retry logic keeps the happy path to a single request.
  useEffect(() => {
    const def = DEFAULT_SYMBOL[market];
    setSymbol(def);
    setMeta(null);
    onFetch(def, market);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  // `symArg`/`mktArg` let callers fetch a specific symbol/market without
  // waiting for state to flush (used by the market-switch auto-fetch below,
  // where setSymbol hasn't applied yet). The 取得 button calls onFetch() with
  // no args and uses the current form state.
  async function onFetch(symArg, mktArg) {
    const sym = symArg ?? symbol;
    const mkt = mktArg ?? market;
    setFetchState({ status: 'loading', msg: '' });
    try {
      const r = await fetchPrice(sym, mkt);
      setSymbol(r.symbol);
      setCurrentPrice(String(r.price));
      setMeta({
        name:     r.name,
        currency: r.currency,
        exchange: r.exchange,
        limits:   r.limits || null,        // TWSE returns official 漲跌停
        tradedAt: r.tradedAt || null,
        isLive:   !!r.isLive,
        priceSource:  r.priceSource || null,     // TW: 'matched' | 'bid' | 'ask' | 'prevClose'
        session:      r.session || 'regular',   // US: 'pre' | 'regular' | 'post'
        sessionPrice: r.sessionPrice ?? null,   // US extended-hours price (display only)
      });
      setFetchState({ status: 'success', msg: `${t.liveTag} · ${r.exchange || 'Yahoo'}` });
    } catch (e) {
      setFetchState({ status: 'error', msg: e.message });
    }
  }

  // --- derived --------------------------------------------------------------
  const { result, error } = useMemo(() => {
    const input = {
      currentPrice: parseFloat(currentPrice),
      amount: parseFloat(amount),
      mode,
      targetValue: parseFloat(targetValue),
    };
    try {
      return { result: calculate(input), error: null };
    } catch (e) {
      return { result: null, error: e.message };
    }
  }, [currentPrice, amount, mode, targetValue]);

  const currency = meta?.currency || (market === 'TW' ? 'TWD' : 'USD');
  const isPositive = result && result.profit >= 0;

  // Always derive limits from the current input price (±10 %). Even after
  // fetching a TW stock, edits to the price field re-flow into the limits.
  const limits = useMemo(
    () => priceLimits(parseFloat(currentPrice)),
    [currentPrice],
  );

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
            <label className="field grow">
              <span className="label">{t.symbolLabel[market]}</span>
              <input
                className="input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onFetch()}
                placeholder={t.placeholder[market]}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              className="btn"
              onClick={() => onFetch()}
              disabled={fetchState.status === 'loading'}
            >
              {fetchState.status === 'loading' ? t.fetching : t.fetch}
            </button>
          </div>

          {meta && (
            <p className="company">
              <span>{meta.name}</span>
              {meta.exchange && <span className="muted"> · {meta.exchange}</span>}
              {/* TW freshness: TWSE now hides last-match price intraday; when
                  we fall back to the live 五檔, label it honestly as 買價/賣價
                  (bid/ask) rather than pretending it's a matched 即時 price. */}
              {market === 'TW' && meta.tradedAt && (
                <span className={`freshness ${meta.isLive ? 'is-live' : 'is-stale'}`}>
                  {meta.priceSource === 'bid'  ? t.bidTag
                    : meta.priceSource === 'ask' ? t.askTag
                    : meta.isLive               ? t.liveTag
                    :                             t.prevCloseTag}
                  {' '}
                  {fmtTradedAt(meta.tradedAt, meta.isLive)}
                </span>
              )}
              {/* US regular session: live tag + date & time (US Eastern). */}
              {market === 'US' && meta.tradedAt && meta.session === 'regular' && (
                <span className="freshness is-live">
                  {t.liveTag} {fmtTradedAtUs(meta.tradedAt, 'regular')}
                </span>
              )}
              {/* US extended-hours chip: pre/post price + date only, and we
                  mark it 美東時間 since trading hours are US-local. */}
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
          {fetchState.status === 'error' && <p className="error">{fetchState.msg}</p>}

          <div className="row">
            <label className="field grow">
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
              <span className="label">{t.shares}</span>
              <input
                className="input mono"
                type="number"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>

          {/* Daily price limits only make sense for TW (the +/-10% rule is
              TWSE-specific). For US we omit them entirely. */}
          {market === 'TW' && limits && (
            <div className="limits" role="group" aria-label="Daily price limits">
              <div className="limit limit-up">
                <span className="limit-label">{t.limitUp}</span>
                <span className="mono">{currency} {fmt(limits.limitUp)}</span>
              </div>
              <div className="limit limit-down">
                <span className="limit-label">{t.limitDown}</span>
                <span className="mono">{currency} {fmt(limits.limitDown)}</span>
              </div>
            </div>
          )}

          {/* Broker-commission discount (TW only). Tax is shown automatically
              in the output; this only controls the 手續費 multiplier. */}
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

          <div className="mode-toggle" role="tablist" aria-label={mode}>
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

          <label className="field">
            <span className="label">
              {mode === 'percent' ? t.targetReturn : t.targetProfit}
            </span>
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
        </section>

        {/* RIGHT: result */}
        <section className="panel output">
          <div className="output-head sell-head">
            <span className="kicker">{t.sellWhen}</span>
            {market === 'TW' && <span className="sell-note">*{t.twFeeNote}</span>}
          </div>

          {!error && result && (
            <div className="input-affix sell-price">
              <span className="prefix">{currency}</span>
              <div className="input mono sell-price-value">{fmt(result.targetPrice, 2)}</div>
            </div>
          )}

          {error ? (
            <div className="todo">
              <div className="todo-tag">{t.todoTag}</div>
              <p>{error}</p>
              <p className="muted small">
                {t.todoHint} <code>src/lib/calculate.js</code>.
              </p>
            </div>
          ) : result ? (
            <>
              <dl className="stats">
                <div>
                  <dt>{t.totalCost}</dt>
                  <dd className="mono">{currency} {fmt(result.totalCost)}</dd>
                </div>
                <div>
                  <dt>{t.totalRevenue}</dt>
                  <dd className="mono">{currency} {fmt(result.totalRevenue)}</dd>
                </div>
                <div>
                  <dt>{t.profit}</dt>
                  <dd className={`mono ${isPositive ? 'pos' : 'neg'}`}>
                    {isPositive ? '+' : ''}{currency} {fmt(result.profit)}
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
                  Commission + 證交稅 as deductions, then the net figures. */}
              {fees && (
                <dl className="fees">
                  <div className="fee-row">
                    <dt>{t.buyFee}</dt>
                    <dd className="mono neg">-{currency} {fmt(fees.buyFee)}</dd>
                  </div>
                  <div className="fee-row">
                    <dt>{t.sellFee}</dt>
                    <dd className="mono neg">-{currency} {fmt(fees.sellFee)}</dd>
                  </div>
                  <div className="fee-row">
                    <dt>
                      {t.secTax}
                      {isETF && <span className="etf-tag">{t.etfTag}</span>}
                    </dt>
                    <dd className="mono neg">-{currency} {fmt(fees.tax)}</dd>
                  </div>
                  <div className="fee-row net">
                    <dt>{t.netProfit}</dt>
                    <dd className={`mono ${isNetPositive ? 'pos' : 'neg'}`}>
                      {isNetPositive ? '+' : ''}{currency} {fmt(fees.netProfit)}
                    </dd>
                  </div>
                  <div className="fee-row net">
                    <dt>{t.netReturn}</dt>
                    <dd className={`mono ${isNetPositive ? 'pos' : 'neg'}`}>
                      {isNetPositive ? '+' : ''}{fmt(fees.netReturnPct)}%
                    </dd>
                  </div>
                </dl>
              )}
            </>
          ) : (
            <p className="muted">{t.placeholderHint}</p>
          )}

          <footer className="output-foot">
            {/* Source name is market-aware: TW prices come from 證交所 (TWSE MIS),
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
        />
      )}
      {view === 'settings' && <SettingsPage lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t} />}

      <BottomNav view={view} setView={setView} t={t} />
    </div>
  );
}
