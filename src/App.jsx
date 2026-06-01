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

const fmt = (n, digits = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';

// Render a trade timestamp in Taiwan time. Live quote → "13:25". Stale
// previous-close → "5/20". TPE timezone is forced so the label is the
// same regardless of where the user happens to be.
const fmtTradedAt = (date, isLive) => {
  if (!date) return '';
  const opts = isLive
    ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' }
    : { month: 'numeric', day: 'numeric', timeZone: 'Asia/Taipei' };
  return date.toLocaleString('zh-TW', opts);
};

export default function App() {
  // --- preferences (persisted) ----------------------------------------------
  const [lang, setLang] = useState(detectLang);
  const [market, setMarket] = useState(() => detectMarket(detectLang()));
  const [view, setView] = useState('calc');   // 'calc' | 'fees' | 'settings'
  const t = translations[lang];

  useEffect(() => { try { localStorage.setItem(LS_LANG,   lang);   } catch {} }, [lang]);
  useEffect(() => { try { localStorage.setItem(LS_MARKET, market); } catch {} }, [market]);

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

  // Swap the symbol field's default when switching market, but only if it
  // still holds the other market's default. Don't trample user input.
  useEffect(() => {
    if (market === 'TW' && symbol === 'TSLA') setSymbol('2330');
    if (market === 'US' && symbol === '2330') setSymbol('TSLA');
    setMeta(null);
    setFetchState({ status: 'idle', msg: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  async function onFetch() {
    setFetchState({ status: 'loading', msg: '' });
    try {
      const r = await fetchPrice(symbol, market);
      setSymbol(r.symbol);
      setCurrentPrice(String(r.price));
      setMeta({
        name:     r.name,
        currency: r.currency,
        exchange: r.exchange,
        limits:   r.limits || null,        // TWSE returns official 漲跌停
        tradedAt: r.tradedAt || null,
        isLive:   !!r.isLive,
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
              onClick={onFetch}
              disabled={fetchState.status === 'loading'}
            >
              {fetchState.status === 'loading' ? t.fetching : t.fetch}
            </button>
          </div>

          {meta && (
            <p className="company">
              <span>{meta.name}</span>
              {meta.exchange && <span className="muted"> · {meta.exchange}</span>}
              {meta.tradedAt && (
                <span className={`freshness ${meta.isLive ? 'is-live' : 'is-stale'}`}>
                  {meta.isLive ? t.liveTag : t.prevCloseTag}
                  {' '}
                  {fmtTradedAt(meta.tradedAt, meta.isLive)}
                </span>
              )}
              {/* US extended-hours chip: only when a pre/post price exists. */}
              {meta.sessionPrice != null && (meta.session === 'pre' || meta.session === 'post') && (
                <span className="freshness is-ext">
                  {meta.session === 'pre' ? t.preMarketTag : t.postMarketTag}
                  {' '}
                  {currency} {fmt(meta.sessionPrice, 2)}
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
            <span className="muted small">{t.disclaimer}</span>
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
      {view === 'settings' && <SettingsPage lang={lang} setLang={setLang} t={t} />}

      <BottomNav view={view} setView={setView} t={t} />
    </div>
  );
}
