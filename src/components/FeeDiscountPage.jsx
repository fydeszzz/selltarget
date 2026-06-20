import { useMemo } from 'react';
import { feeDiscount } from '../lib/feeDiscount.js';
import { asset } from '../lib/asset.js';
import { fmt } from '../lib/format.js';

export default function FeeDiscountPage({ t, lang, amount, setAmount, feePaid, setFeePaid, onApply }) {
  const result = useMemo(
    () => feeDiscount({ amount: parseFloat(amount), feePaid: parseFloat(feePaid) }),
    [amount, feePaid],
  );
  // A valid reverse-calc vs. the explicit "overpaid" mistake vs. blank input.
  // Kept apart so the page can explain the mistake instead of silently blanking.
  const ok       = result && !result.error;
  const overpaid = result?.error === 'overpaid';

  return (
    <main className="grid fees-page">
      <section className="panel form">
        <div className="page-head">
          <div className="page-title-row">
            <img className="page-icon" src={asset('calculator.png')} alt="" aria-hidden />
            <h2 className="page-title">{t.feeDiscTitle}</h2>
          </div>
        </div>

        <label className="field">
          <span className="label">{t.tradeAmount}</span>
          <div className="input-affix">
            <span className="prefix">TWD</span>
            <input
              className="input mono"
              type="number"
              step="1"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100000"
            />
          </div>
        </label>

        <label className="field">
          <span className="label">{t.feePaid}</span>
          <div className="input-affix">
            <span className="prefix">TWD</span>
            <input
              className="input mono"
              type="number"
              step="1"
              min="0"
              value={feePaid}
              onChange={(e) => setFeePaid(e.target.value)}
              placeholder="85"
            />
          </div>
        </label>

        <span className="field-hint">{t.feeDiscHint}</span>
      </section>

      <section className="panel output">
        <div className="output-head">
          <span className="kicker">{t.yourDiscount}</span>
          {ok && (
            <span className="hero">
              <span className="hero-number">
                {lang === 'zh' ? `${fmt(result.zhe, 1)} 折` : `×${fmt(result.discount, 2)}`}
              </span>
            </span>
          )}
        </div>

        {ok ? (
          <>
            <dl className="stats">
              <div>
                <dt>{t.effectiveRate}</dt>
                <dd className="mono">{fmt(result.effectiveRate, 4)}%</dd>
              </div>
              <div>
                <dt>{t.baseCommission}</dt>
                <dd className="mono">TWD {fmt(result.baseFee)}</dd>
              </div>
            </dl>
            {result.minApplied && <p className="output-note">{t.feeDiscMinNote}</p>}
            {/* Carry the reverse-calculated 折數 over to the sell-target page's
                commission multiplier (2-dp, matching that field's step). */}
            <button
              className="btn apply-btn"
              onClick={() => onApply?.(Math.round(result.discount * 100) / 100)}
            >
              {t.feeDiscApply}
            </button>
          </>
        ) : overpaid ? (
          <p className="error">{t.feeDiscOverpaid}</p>
        ) : (
          <p className="muted">{t.feeDiscPlaceholder}</p>
        )}

        <footer className="output-foot">
          <span className="muted small">{t.feeDiscDisclaimer}</span>
        </footer>
      </section>
    </main>
  );
}
