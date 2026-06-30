import { useMemo } from 'react';
import { feeDiscount } from '../../lib/feeDiscount.js';
import { fmt } from '../../lib/format.js';
import InfoTip from '../../components/InfoTip.jsx';

// Reverse-derive a TW broker commission discount from the trade amount and the
// fee actually paid. Same logic module as the mobile app; only the layout is
// web-native (two-column workspace).
export default function FeeDiscount({ t, lang, amount, setAmount, feePaid, setFeePaid, onApply }) {
  const result = useMemo(
    () => feeDiscount({ amount: parseFloat(amount), feePaid: parseFloat(feePaid) }),
    [amount, feePaid],
  );
  const ok       = result && !result.error && !result.tooSmall;
  const overpaid = result?.error === 'overpaid';
  const tooSmall = !!result?.tooSmall;

  return (
    <>
      <div className="page-head-web">
        <span className="page-eyebrow">{t.nav.fees}</span>
        <h1 className="page-h1">{t.feeDiscTitle}</h1>
        <p className="page-sub">{t.feeDiscPlaceholder}</p>
      </div>

      <div className="workspace">
        <section className="card">
          <span className="card-kicker">{t.tradeAmount}</span>

          <label className="field">
            <span className="label">{t.tradeAmount}</span>
            <div className="input-affix">
              <span className="prefix">TWD</span>
              <input
                className="input mono" type="number" step="1" min="0"
                value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000"
              />
            </div>
          </label>

          <label className="field">
            <span className="label">
              {t.feePaid}
              <InfoTip lines={[t.feeDiscHint, t.feeDiscDisclaimer]} label={t.infoTipLabel} />
            </span>
            <div className="input-affix">
              <span className="prefix">TWD</span>
              <input
                className="input mono" type="number" step="1" min="0"
                value={feePaid} onChange={(e) => setFeePaid(e.target.value)} placeholder="85"
              />
            </div>
          </label>
        </section>

        <section className="card result">
          <span className="card-kicker">{t.yourDiscount}</span>

          {ok && (
            <div className="hero-price">
              <span className="hero-num">
                {lang === 'zh' ? `${fmt(result.zhe, 1)} 折` : `×${fmt(result.discount, 2)}`}
              </span>
            </div>
          )}

          {ok ? (
            <>
              <dl className="stats">
                <div>
                  <dt>{t.effectiveRate}</dt>
                  <dd>{fmt(result.effectiveRate, 4)}%</dd>
                </div>
                <div>
                  <dt>{t.baseCommission}</dt>
                  <dd>TWD {fmt(result.baseFee)}</dd>
                </div>
              </dl>
              <button className="btn apply-btn" onClick={() => onApply?.(Math.round(result.discount * 100) / 100)}>
                {t.feeDiscApply}
              </button>
            </>
          ) : tooSmall ? (
            <p className="output-note">{t.feeDiscMinNote}</p>
          ) : overpaid ? (
            <p className="error">{t.feeDiscOverpaid}</p>
          ) : (
            <div className="hero-price"><span className="hero-empty">{t.feeDiscPlaceholder}</span></div>
          )}

          <footer className="result-foot">
            <span className="muted small">{t.feeDiscDisclaimer}</span>
          </footer>
        </section>
      </div>
    </>
  );
}
