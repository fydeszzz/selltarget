// ─────────────────────────────────────────────────────────────────────────────
//  台股漲跌停價計算 (TWSE daily price limits)
//
//  Rule: a listed stock's intraday price cannot deviate more than ±10 %
//  from the previous trading day's closing price.
//
//  Here we approximate "previous close" with whatever currentPrice the user
//  has typed or fetched — good enough for a planning calculator.
//
//  Return shape (consumed by App.jsx):
//    {
//      limitUp:   number,   // 漲停價
//      limitDown: number,   // 跌停價
//      ratio:     number,   // 0.10 — exposed so the UI can label it
//    }
//
//  Returns `null` when the input is not a positive finite number.
// ─────────────────────────────────────────────────────────────────────────────

const LIMIT_RATIO = 0.10;

export function priceLimits(currentPrice) {
  const base = Number(currentPrice);
  if (!Number.isFinite(base) || base <= 0) return null;

  // Basic ±10 % version. Works for every market — including TW — as a first
  // approximation. The TODO below upgrades it to exchange-accurate ticks.
  const rawUp   = base * (1 + LIMIT_RATIO);
  const rawDown = base * (1 - LIMIT_RATIO);

  const tick = pickTick(base);
  const limitUp   = tick ? floorToTick(rawUp,   tick) : round2(rawUp);
  const limitDown = tick ? ceilToTick (rawDown, tick) : round2(rawDown);

  return { limitUp, limitDown, ratio: LIMIT_RATIO };
}

// ─── helpers ────────────────────────────────────────────────────────────────
const round2     = (n)    => Math.round(n * 100) / 100;
const floorToTick = (n, t) => Math.floor(n / t + 1e-9) * t;
const ceilToTick  = (n, t) => Math.ceil (n / t - 1e-9) * t;

// ─── TWSE tick-size table ───────────────────────────────────────────────────
//
//  TODO (Ricy):
//    台灣證交所對不同價位有不同的最小跳動單位 (tick size)：
//
//        price band       tick
//        ───────────      ─────
//        <    10          0.01
//        <    50          0.05
//        <   100          0.10
//        <   500          0.50
//        <  1000          1.00
//        ≥  1000          5.00
//
//    漲停價 must NOT exceed +10 %  → floor to the nearest tick.
//    跌停價 must NOT fall below -10 % → ceil to the nearest tick.
//
//    Right now `pickTick` returns `null`, which makes priceLimits() fall back
//    to plain 2-decimal rounding (fine for USD stocks, slightly wrong for TW).
//    Replace the body to make the limits exchange-accurate.
//
//    Worked example you can verify yourself:
//      priceLimits(415).limitUp   →  456.50  (tick 0.50, floored from 456.5)
//      priceLimits(415).limitDown →  373.50  (tick 0.50, ceiled from 373.5)
//      priceLimits( 27).limitUp   →   29.70  (tick 0.05, floored from 29.7)
//
export function pickTick(price) {
  // Replace this with the table above when you're ready.
  return null;
}
