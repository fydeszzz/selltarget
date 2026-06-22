// ─────────────────────────────────────────────────────────────────────────────
//  TW trading cost: broker commission + securities-transaction-tax.
//
//  Models one round-trip: BUY at currentPrice, SELL at targetPrice.
//  Returns the fees, the tax, and the profit AFTER all of them are paid.
//
//  Taiwan rules:
//    • Broker commission
//        - trade amount × 0.1425%   (COMMISSION_RATE)
//        - charged on BOTH the buy leg and the sell leg
//        - discount is a multiplier 0–1; e.g. 0.6 = 60% of standard. Blank → 1.
//        - NT$20 minimum: if the (discounted) fee is under 20, it's still 20.
//    • Securities transaction tax — SELL leg only
//        - common stock: sell amount × 0.3%   (TAX_STOCK)
//        - ETF:          sell amount × 0.1%   (TAX_ETF)
//
//  Return shape (consumed by App.jsx):
//    {
//      buyFee:       number,   // commission on the buy leg  (>= 20)
//      sellFee:      number,   // commission on the sell leg (>= 20)
//      tax:          number,   // securities transaction tax (sell only)
//      netProfit:    number,   // totalRevenue - totalCost - buyFee - sellFee - tax
//      netReturnPct: number,   // netProfit / (totalCost + buyFee) * 100
//    }
//
//  Return `null` for invalid input (non-finite / non-positive cost or revenue),
//  exactly like calculate.js — the UI then just hides the fee block.
// ─────────────────────────────────────────────────────────────────────────────

export const COMMISSION_RATE = 0.001425; // 0.1425%
export const COMMISSION_MIN  = 20;        // NT$20 floor, per leg
export const TAX_STOCK       = 0.003;     // 0.3%  common stock
export const TAX_ETF         = 0.001;     // 0.1%  ETF

// Taiwan ETFs are the only listings whose code starts with "00" (0050, 0056,
// 006208, 00878, …). Accepts a bare code or a Yahoo-style "0050.TW" symbol.
export function isTwEtf(symbolOrCode) {
  const code = String(symbolOrCode || '').replace(/\..*$/, '').trim();
  return /^00\d/.test(code);
}

export function twFees({ totalCost, totalRevenue, discount = 1, isETF = false }) {
  // 1. Validate. Same posture as calculate.js: bail to null on bad input so
  //    the UI shows nothing rather than NaNs.
  if (![totalCost, totalRevenue].every(Number.isFinite)) return null;
  if (totalCost <= 0 || totalRevenue <= 0) return null;

  // Normalize the discount multiplier: blank/invalid/≤0 means "no discount".
  const d = Number.isFinite(discount) && discount > 0 ? discount : 1;

  // 2. Commission on each leg. The NT$20 minimum applies AFTER the discount
  //    (it floors what's actually charged). Fees/tax are floored to whole NT$,
  //    matching how most TW brokers bill.
  const commission = (amount) =>
    Math.max(COMMISSION_MIN, Math.floor(amount * COMMISSION_RATE * d));
  const buyFee  = commission(totalCost);
  const sellFee = commission(totalRevenue);

  // 3. Securities transaction tax — sell leg only, lower for ETFs.
  const tax = Math.floor(totalRevenue * (isETF ? TAX_ETF : TAX_STOCK));

  // 4. Net of all costs. Return % is measured against the actual cash outlay
  //    (cost + the commission paid to buy in).
  const netProfit    = totalRevenue - totalCost - buyFee - sellFee - tax;
  const netReturnPct = (netProfit / (totalCost + buyFee)) * 100;

  return { buyFee, sellFee, tax, netProfit, netReturnPct };
}

// ─── tiny self-test you can run with `node src/lib/twFees.js` ───
// Prints PASS/FAIL once the function above is implemented (assumes Math.floor
// rounding — adjust the expected numbers if you choose a different rule).
// IIFE builds a file URL that matches import.meta.url on Windows and POSIX
// alike (the old `file://${argv}` form only matched POSIX paths).
if (typeof process !== 'undefined' && import.meta.url === (() => {
  const p = (process.argv?.[1] || '').replace(/\\/g, '/');
  return p.startsWith('/') ? `file://${p}` : `file:///${p}`;
})()) {
  const approx = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= 1;
  const r = twFees({ totalCost: 1_000_000, totalRevenue: 1_100_000 });
  if (!r) {
    console.log('twFees() not implemented yet — fill in the TODO.');
  } else {
    console.log(approx(r.buyFee, 1425) && approx(r.sellFee, 1567) ? 'PASS commission' : 'FAIL commission', r);
    console.log(approx(r.tax, 3300) ? 'PASS tax' : 'FAIL tax', r.tax);
    const etf = twFees({ totalCost: 1_000_000, totalRevenue: 1_100_000, isETF: true });
    console.log(approx(etf.tax, 1100) ? 'PASS etf-tax' : 'FAIL etf-tax', etf.tax);
  }
}
