// ─────────────────────────────────────────────────────────────────────────────
//  手續費折數反推 (reverse-calc the broker discount you actually got)
//
//  Brokers advertise commission as "X 折" off the standard 0.1425% rate, and
//  every broker / 營業員 offers a different deal. Given a trade amount and the
//  commission you were actually charged, this works out the discount.
//
//      手續費 = 成交金額 × 0.1425% × 折數      (forward, see twFees.js)
//   →  折數   = 實付手續費 / (成交金額 × 0.1425%)   (reverse, here)
//
//  Reuses COMMISSION_RATE / COMMISSION_MIN from twFees.js so the two pages
//  never drift apart.
//
//  Return shape (consumed by FeeDiscountPage):
//    {
//      discount:      number,   // multiplier, e.g. 0.60
//      zhe:           number,   // 折, e.g. 6.0  (discount × 10)
//      effectiveRate: number,   // 實際費率 %, e.g. 0.0855
//      baseFee:       number,   // 原始手續費 (no discount) = amount × 0.1425%
//      minApplied:    boolean,  // true when amount is so small the NT$20 floor
//                               // dominates → 折數 is not meaningful
//    }
//  Returns `null` for invalid input.
// ─────────────────────────────────────────────────────────────────────────────

import { COMMISSION_RATE, COMMISSION_MIN } from './twFees.js';

export function feeDiscount({ amount, feePaid }) {
  const a = Number(amount);
  const f = Number(feePaid);
  if (![a, f].every(Number.isFinite)) return null;
  if (a <= 0 || f < 0) return null;

  const baseFee = a * COMMISSION_RATE;        // full-rate commission
  if (baseFee <= 0) return null;

  const discount      = f / baseFee;           // e.g. 0.60
  const zhe           = discount * 10;          // e.g. 6.0 折
  const effectiveRate = (f / a) * 100;          // e.g. 0.0855 %
  const minApplied    = baseFee < COMMISSION_MIN;

  return { discount, zhe, effectiveRate, baseFee, minApplied };
}
