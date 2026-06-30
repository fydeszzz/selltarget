import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchPrice, searchSymbols } from '../lib/fetchPrice.js';
import { calculate } from '../lib/calculate.js';
import { twFees, isTwEtf } from '../lib/twFees.js';
import { translations, detectLang, detectMarket } from '../lib/i18n.js';
import { fmt } from '../lib/format.js';
import InfoTip from '../components/InfoTip.jsx';
import TopNav from './components/TopNav.jsx';
import FeeDiscount from './components/FeeDiscount.jsx';
import About from './components/About.jsx';
import Footer from './components/Footer.jsx';

// Web build of Sell Signal. The calculator's behaviour is identical to the
// mobile/Electron app — it reuses the same logic modules (calculate, twFees,
// feeDiscount, fetchPrice, i18n). Only the shell is web-native: a top nav and
// a two-column workspace instead of a phone frame + bottom nav.

const LS_LANG   = 'sellsignal:lang';
const LS_MARKET = 'sellsignal:market';
const LS_THEME  = 'sellsignal:theme';

const DEFAULT_SYMBOL = { TW: '2330', US: 'TSLA' };

function detectTheme() {
  try {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

const fmtTradedAt = (date, isLive) => {
  if (!date) return '';
  const opts = isLive
    ? { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' }
    : { month: 'numeric', day: 'numeric', timeZone: 'Asia/Taipei' };
  return date.toLocaleString('zh-TW', opts);
};

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

export default function WebApp() {
  // --- preferences (persisted) ---
  const [lang, setLang] = useState(detectLang);
  const [market, setMarket] = useState(() => detectMarket(detectLang()));
  const [theme, setTheme] = useState(detectTheme);
  const [view, setView] = useState('calc');   // 'calc' | 'fees' | 'settings'
  const t = translations[lang];

  useEffect(() => { try { localStorage.setItem(LS_LANG,   lang);   } catch {} }, [lang]);
  useEffect(() => { try { localStorage.setItem(LS_MARKET, market); } catch {} }, [market]);
  useEffect(() => {
    try { localStorage.setItem(LS_THEME, theme); } catch {}
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'; }, [lang]);

  // --- form state ---
  const [symbol, setSymbol] = useState(market === 'TW' ? '2330' : 'TSLA');
  const [meta, setMeta] = useState(null);
  const [currentPrice, setCurrentPrice] = useState('415');
  const [costBasis, setCostBasis] = useState('');
  const [amount, setAmount] = useState('1');
  const [sharesUnit, setSharesUnit] = useState('lot');
  const [mode, setMode] = useState('percent');
  const [percentValue, setPercentValue] = useState('');
  const [dollarValue,  setDollarValue]  = useState('');
  const targetValue    = mode === 'percent' ? percentValue : dollarValue;
  const setTargetValue = mode === 'percent' ? setPercentValue : setDollarValue;
  const [feeDiscountMult, setFeeDiscountMult] = useState('');
  const [fetchState, setFetchState] = useState({ status: 'idle', msg: '' });

  // --- type-ahead autocomplete ---
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [sugIdx, setSugIdx] = useState(-1);
  const typingRef    = useRef(false);
  const blurTimerRef = useRef(null);
  const lastSymRef   = useRef(null);
  const mountedRef   = useRef(true);
  const fetchIdRef   = useRef(0);

  // Fee-discount page inputs persist across tab switches.
  const [feeAmount, setFeeAmount]   = useState('');
  const [feePaidAmt, setFeePaidAmt] = useState('');

  const onFetch = useCallback(async (sym, mkt) => {
    typingRef.current = false;
    const fetchId = ++fetchIdRef.current;
    const stale = () => fetchIdRef.current !== fetchId || !mountedRef.current;
    setFetchState({ status: 'loading', msg: '' });
    try {
      const r = await fetchPrice(sym, mkt);
      if (stale()) return;
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
        session:      r.session || 'regular',
        sessionPrice: r.sessionPrice ?? null,
      });
      setFetchState({ status: 'success', msg: '' });
    } catch (e) {
      if (stale()) return;
      setFetchState({ status: 'error', msg: e.message, isNetwork: !!(e && e.isNetwork) });
    }
  }, []);

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

  const onSelectSuggestion = useCallback((s) => {
    typingRef.current = false;
    setShowSug(false);
    setSuggestions([]);
    setSugIdx(-1);
    setSymbol(s.code);
    onFetch(s.code, market);
  }, [onFetch, market]);

  const onSymbolKeyDown = (e) => {
    if (showSug && suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSugIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSugIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Escape')    { setShowSug(false); return; }
      if (e.key === 'Enter' && sugIdx >= 0) { e.preventDefault(); onSelectSuggestion(suggestions[sugIdx]); return; }
    }
    if (e.key === 'Enter') { typingRef.current = false; setShowSug(false); onFetch(symbol, market); }
  };

  useEffect(() => {
    const def = DEFAULT_SYMBOL[market];
    setSymbol(def);
    setMeta(null);
    onFetch(def, market);
  }, [market, onFetch]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(blurTimerRef.current);
    };
  }, []);

  // --- derived ---
  const sharesNum = parseFloat(amount);
  const shares =
    market === 'TW' && sharesUnit === 'lot' && Number.isFinite(sharesNum)
      ? sharesNum * 1000
      : sharesNum;

  const cpParsed = parseFloat(currentPrice);
  const priceInvalid = Number.isFinite(cpParsed) && cpParsed <= 1;

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

  const unrealized = useMemo(() => {
    const cb = parseFloat(costBasis);
    const cp = parseFloat(currentPrice);
    const sh = shares;
    if (priceInvalid) return null;
    if (![cb, cp, sh].every(Number.isFinite) || cb <= 0 || sh <= 0) return null;
    const profit = (cp - cb) * sh;
    const pct = ((cp - cb) / cb) * 100;
    return { profit, pct, positive: profit >= 0 };
  }, [costBasis, currentPrice, shares, priceInvalid]);

  const currency = meta?.currency || (market === 'TW' ? 'TWD' : 'USD');
  const md = market === 'TW' ? 0 : 2;
  const isPositive = result && result.profit >= 0;

  const costBasisValid = Number.isFinite(parseFloat(costBasis)) && parseFloat(costBasis) > 0;
  const showProfitStats = market !== 'US' || costBasisValid;

  const isETF = market === 'TW' && isTwEtf(symbol);
  const fees = useMemo(() => {
    if (market !== 'TW' || !result) return null;
    return twFees({
      totalCost:    result.totalCost,
      totalRevenue: result.totalRevenue,
      discount:     parseFloat(feeDiscountMult),
      isETF,
    });
  }, [market, result, feeDiscountMult, isETF]);
  const isNetPositive = fees && fees.netProfit >= 0;

  // --- render ---
  return (
    <div className="web-shell">
      <TopNav
        view={view} setView={setView}
        lang={lang} setLang={setLang}
        theme={theme} setTheme={setTheme}
        t={t}
      />

      {view === 'calc' && (
        <>
          <div className="page-head-web">
            <span className="page-eyebrow">{t.nav.calc}</span>
            <h1 className="page-h1">{t.sellWhen}</h1>
            <p className="page-sub">{t.placeholderHint}</p>
          </div>

          <div className="workspace" data-market={market}>
            {/* LEFT: inputs */}
            <section className="card">
              <div className="market-toggle" role="tablist" aria-label={t.marketLabel}>
                <button role="tab" aria-selected={market === 'TW'} className={`market-tab ${market === 'TW' ? 'on' : ''}`} onClick={() => setMarket('TW')}>{t.market.TW}</button>
                <button role="tab" aria-selected={market === 'US'} className={`market-tab ${market === 'US' ? 'on' : ''}`} onClick={() => setMarket('US')}>{t.market.US}</button>
                <span className="market-thumb" data-market={market} aria-hidden />
              </div>

              <div className="row">
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
                    autoComplete="off" spellCheck={false}
                    role="combobox" aria-expanded={showSug} aria-autocomplete="list"
                  />
                  {showSug && suggestions.length > 0 && (
                    <ul className="suggest" role="listbox">
                      {suggestions.map((s, i) => (
                        <li
                          key={s.code}
                          role="option"
                          aria-selected={i === sugIdx}
                          className={`suggest-item${i === sugIdx ? ' on' : ''}${s.kind === 'secondary' ? ' secondary' : ''}`}
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
                <button className="btn" onClick={() => { setShowSug(false); onFetch(symbol, market); }} disabled={fetchState.status === 'loading'}>
                  {fetchState.status === 'loading' ? t.fetching : t.fetch}
                </button>
              </div>

              {meta && (
                <p className="company">
                  <span>{meta.name}</span>
                  {meta.exchange && <span className="muted"> · {meta.exchange}</span>}
                  {market === 'TW' && meta.tradedAt && (
                    <span className={`freshness ${meta.isLive ? 'is-live' : 'is-stale'}`}>
                      {meta.isLive ? t.liveTag : t.prevCloseTag} {fmtTradedAt(meta.tradedAt, meta.isLive)}
                    </span>
                  )}
                  {market === 'US' && meta.tradedAt && meta.session === 'regular' && (
                    <span className={`freshness ${meta.isLive ? 'is-live' : 'is-stale'}`}>
                      {meta.isLive ? t.liveTag : t.closeTag} {fmtTradedAtUs(meta.tradedAt, 'regular')}
                    </span>
                  )}
                  {market === 'US' && meta.sessionPrice != null && (meta.session === 'pre' || meta.session === 'post') && (
                    <span className="freshness is-ext">
                      {meta.session === 'pre' ? t.preMarketTag : t.postMarketTag}{' '}
                      {currency} {fmt(meta.sessionPrice, 2)}
                      {meta.tradedAt && <>{' · '}{fmtTradedAtUs(meta.tradedAt, meta.session)} {t.usEasternNote}</>}
                    </span>
                  )}
                </p>
              )}
              {fetchState.status === 'error' && (
                <p className="error">{fetchState.isNetwork ? t.networkError : fetchState.msg}</p>
              )}

              <div className="row">
                <label className="field">
                  <span className="label">{t.currentPrice}</span>
                  <div className="input-affix">
                    <span className="prefix">{currency}</span>
                    <input className="input mono" type="number" step="0.01" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} />
                  </div>
                </label>
                <label className="field">
                  <span className="label">{t.costBasis}<span className="label-note"> · {t.feeOptional}</span></span>
                  <div className="input-affix">
                    <span className="prefix">{currency}</span>
                    <input className="input mono" type="number" step="0.01" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} placeholder="—" />
                  </div>
                </label>
              </div>

              {unrealized && (
                <div className={`unrealized ${unrealized.positive ? 'pos' : 'neg'}`}>
                  <span className="unrealized-label">{t.unrealizedLabel}</span>
                  <span className="unrealized-val">
                    {unrealized.positive ? '+' : ''}{fmt(unrealized.pct)}%
                    <span className="unrealized-sep">·</span>
                    {unrealized.positive ? '+' : ''}{currency} {fmt(unrealized.profit, md)}
                  </span>
                </div>
              )}

              <div className="row">
                <label className="field">
                  <span className="label">{t.shares}</span>
                  {market === 'TW' ? (
                    <div className="shares-row">
                      <input className="input mono" type="number" step="1" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1" />
                      <div className="mode-toggle" role="tablist" aria-label={t.shares}>
                        <button role="tab" aria-selected={sharesUnit === 'lot'} className={`tab ${sharesUnit === 'lot' ? 'on' : ''}`} onClick={() => setSharesUnit('lot')}>{t.sharesLot}</button>
                        <button role="tab" aria-selected={sharesUnit === 'odd'} className={`tab ${sharesUnit === 'odd' ? 'on' : ''}`} onClick={() => setSharesUnit('odd')}>{t.sharesOdd}</button>
                      </div>
                    </div>
                  ) : (
                    <input className="input mono" type="number" step="1" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1" />
                  )}
                </label>
                {market === 'TW' && (
                  <label className="field">
                    <span className="label">
                      {t.feeMultiplier}<span className="label-note"> · {t.feeOptional}</span>
                      <InfoTip lines={[t.feeMinNote, t.twFeeNote]} label={t.infoTipLabel} />
                    </span>
                    <input className="input mono" type="number" step="0.01" min="0" max="1" value={feeDiscountMult} onChange={(e) => setFeeDiscountMult(e.target.value)} placeholder={t.feeMultiplierHint} />
                  </label>
                )}
              </div>

              <div className="row">
                <label className="field grow">
                  <span className="label">{t.targetLabel}</span>
                  <div className="input-affix">
                    {mode === 'dollar' && <span className="prefix">{currency}</span>}
                    <input className="input mono" type="number" step="any" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder={mode === 'percent' ? '10' : '100'} />
                    {mode === 'percent' && <span className="suffix">%</span>}
                  </div>
                </label>
                <div className="mode-toggle goal-modes" role="tablist" aria-label={t.targetLabel}>
                  <button role="tab" aria-selected={mode === 'percent'} className={`tab ${mode === 'percent' ? 'on' : ''}`} onClick={() => setMode('percent')}>{t.percentMode}</button>
                  <button role="tab" aria-selected={mode === 'dollar'} className={`tab ${mode === 'dollar' ? 'on' : ''}`} onClick={() => setMode('dollar')}>{t.dollarMode}</button>
                </div>
              </div>
            </section>

            {/* RIGHT: result */}
            <section className="card result">
              <div className="result-head">
                <span className="card-kicker">{t.sellWhen}</span>
                {result ? (
                  <div className="hero-price">
                    <span className="hero-cur">{currency}</span>
                    <span className="hero-num">{fmt(result.targetPrice, 2)}</span>
                  </div>
                ) : priceInvalid ? (
                  <div className="hero-price"><span className="hero-empty">{t.priceError}</span></div>
                ) : (
                  <div className="hero-price"><span className="hero-empty">{t.placeholderHint}</span></div>
                )}
              </div>

              {result && showProfitStats && (
                <>
                  <dl className="stats">
                    <div className={market === 'US' && isPositive ? 'tint-pos' : market === 'US' ? 'tint-neg' : ''}>
                      <dt>{t.totalCost}</dt>
                      <dd>{currency} {fmt(result.totalCost, md)}</dd>
                    </div>
                    <div className={market === 'US' && isPositive ? 'tint-pos' : market === 'US' ? 'tint-neg' : ''}>
                      <dt>{t.totalRevenue}</dt>
                      <dd>{currency} {fmt(result.totalRevenue, md)}</dd>
                    </div>
                    <div className={market === 'US' ? (isPositive ? 'tint-pos' : 'tint-neg') : ''}>
                      <dt>{t.profit}</dt>
                      <dd className={isPositive ? 'pos' : 'neg'}>{isPositive ? '+' : ''}{currency} {fmt(result.profit, md)}</dd>
                    </div>
                    <div className={market === 'US' ? (isPositive ? 'tint-pos' : 'tint-neg') : ''}>
                      <dt>{t.returnPct}</dt>
                      <dd className={isPositive ? 'pos' : 'neg'}>{isPositive ? '+' : ''}{fmt(result.profitPct)}%</dd>
                    </div>
                  </dl>

                  {fees && (
                    <>
                      <dl className="fees">
                        <div className="fee-row"><dt>{t.buyFee}</dt><dd className="neg">-{currency} {fmt(fees.buyFee, md)}</dd></div>
                        <div className="fee-row"><dt>{t.sellFee}</dt><dd className="neg">-{currency} {fmt(fees.sellFee, md)}</dd></div>
                        <div className="fee-row"><dt>{t.secTax}{isETF && <span className="etf-tag">{t.etfTag}</span>}</dt><dd className="neg">-{currency} {fmt(fees.tax, md)}</dd></div>
                      </dl>
                      <div className={`net-summary ${isNetPositive ? 'pos' : 'neg'}`}>
                        <div className="net-row net-row-main">
                          <span className="net-label">{t.netProfit}</span>
                          <span className="net-val">{isNetPositive ? '+' : ''}{currency} {fmt(fees.netProfit, md)}</span>
                        </div>
                        <div className="net-row net-row-sub">
                          <span className="net-label">{t.netReturn}</span>
                          <span className="net-val">{isNetPositive ? '+' : ''}{fmt(fees.netReturnPct)}%</span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {result && !showProfitStats && (
                <p className="output-note">{t.costPrompt}</p>
              )}

              <footer className="result-foot">
                <span className="muted small">
                  {t.quoteSourceLabel} {market === 'TW' ? t.sourceTW : t.sourceUS}
                  {lang === 'zh' ? '，' : '. '}
                  {t.disclaimer}
                </span>
              </footer>
            </section>
          </div>
        </>
      )}

      {view === 'fees' && (
        <FeeDiscount
          t={t} lang={lang}
          amount={feeAmount} setAmount={setFeeAmount}
          feePaid={feePaidAmt} setFeePaid={setFeePaidAmt}
          onApply={(mult) => { setFeeDiscountMult(String(mult)); setMarket('TW'); setView('calc'); }}
        />
      )}

      {view === 'settings' && (
        <About lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t} />
      )}

      <Footer lang={lang} />
    </div>
  );
}
