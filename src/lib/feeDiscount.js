// ─────────────────────────────────────────────────────────────────────────────
//  Reverse-calc the broker commission discount you actually got.
//
//  Brokers advertise commission as a discount off the standard 0.1425% rate,
//  and every broker / sales rep offers a different deal. Given a trade amount
//  and the commission you were actually charged, this works out the discount.
//
//      commission = amount × 0.1425% × discount      (forward, see twFees.js)
//   →  discount   = fee paid / (amount × 0.1425%)     (reverse, here)
//
//  Reuses COMMISSION_RATE / COMMISSION_MIN from twFees.js so the two pages
//  never drift apart.
//
//  Return shape (consumed by FeeDiscountPage):
//    {
//      discount:      number,   // multiplier, e.g. 0.60
//      zhe:           number,   // discount expressed ×10, e.g. 6.0 (TW convention)
//      effectiveRate: number,   // effective rate %, e.g. 0.0855
//      baseFee:       number,   // full-rate commission (no discount) = amount × 0.1425%
//    }
//  Returns `null` for blank / not-yet-fillable input (the UI shows its neutral
//  placeholder); `{ tooSmall: true, baseFee }` when the trade is so small the
//  NT$20 floor dominates (no discount is derivable — the page explains the
//  floor instead of inventing a discount); or `{ error: 'overpaid' }` when the
//  commission entered is higher than the full standard rate — a real mistake
//  the UI must explain rather than silently blanking the result.
// ─────────────────────────────────────────────────────────────────────────────

import { COMMISSION_RATE, COMMISSION_MIN } from './twFees.js';

export function feeDiscount({ amount, feePaid }) {
  const a = Number(amount);
  const f = Number(feePaid);
  if (![a, f].every(Number.isFinite)) return null;
  if (a <= 0 || f < 0) return null;

  const baseFee = a * COMMISSION_RATE;        // full-rate commission
  if (baseFee <= 0) return null;

  // Trade so small the NT$20 floor dominates: even at full rate you'd pay the
  // NT$20 minimum, so a discount can't be reverse-derived. Must be checked
  // BEFORE the overpaid guard — otherwise a legitimate NT$20 payment (f > the
  // tiny baseFee) is mislabeled "overpaid". The page shows the min-fee note.
  if (baseFee < COMMISSION_MIN) return { tooSmall: true, baseFee };

  // Fee paid exceeds the full standard rate — not a valid discount. Signal it
  // explicitly so the page can prompt a re-entry instead of going blank.
  if (f > baseFee) return { error: 'overpaid' };

  const discount      = f / baseFee;           // e.g. 0.60
  const zhe           = discount * 10;          // e.g. 6.0 (discount expressed ×10)
  const effectiveRate = (f / a) * 100;          // e.g. 0.0855 %

  return { discount, zhe, effectiveRate, baseFee };
}
