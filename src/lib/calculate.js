// ─────────────────────────────────────────────────────────────────────────────
//  THE BRAIN OF THE CALCULATOR — YOU WRITE THIS.
//
//  Goal: given the current price, how many shares you hold, and a goal
//  (either a +% return, or a $ revenue target), return the price at which
//  selling will hit that goal.
//
//  Worked examples from the spec:
//    calculate({ currentPrice: 415, amount: 10, mode: 'percent', targetValue:  10 })
//      → targetPrice = 456.5     (10 % above 415)
//    calculate({ currentPrice: 415, amount: 10, mode: 'dollar',  targetValue: 100 })
//      → targetPrice = 425       (need $100 more total → +$10 per share)
//
//  Formulas (basis = costBasis when supplied, else currentPrice):
//    percent mode → targetPrice = basis * (1 + targetValue / 100)
//    dollar  mode → targetPrice = basis + (targetValue / amount)
//
//  Return shape (used by the UI in App.jsx):
//    {
//      targetPrice:  number,   // price per share to sell at
//      totalCost:    number,   // currentPrice * amount
//      totalRevenue: number,   // targetPrice  * amount
//      profit:       number,   // totalRevenue - totalCost
//      profitPct:    number,   // profit / totalCost * 100
//    }
//
//  Return `null` if inputs are invalid (negative / zero / non-finite).
// ─────────────────────────────────────────────────────────────────────────────

export function calculate({ currentPrice, amount, mode, targetValue, costBasis }) {
  // 1. Validate. Anything non-finite or non-positive in the core inputs
  //    short-circuits to `null`, which the UI renders as the placeholder
  //    "enter a price..." hint instead of crashing or showing NaNs.
  if (![currentPrice, amount, targetValue].every(Number.isFinite)) return null;
  if (currentPrice <= 0 || amount <= 0) return null;

  // Basis for the goal and the cost figures. When the holder supplies an
  // average cost, that is their real invested price — so return %, total
  // cost, and profit are all measured from it ("I bought at 100, want +20%,
  // sell at 120"). When left blank, fall back to the current price, i.e. the
  // original forward-planning behaviour ("buy now, sell at +X%").
  const basis =
    Number.isFinite(costBasis) && costBasis > 0 ? costBasis : currentPrice;

  // 2. Target price depends on which goal mode the user chose.
  //    `percent` — "I want a +X% return"  → multiply by (1 + X/100)
  //    `dollar`  — "I want $Y total profit" → add Y/shares to the basis
  let targetPrice;
  if (mode === 'percent') {
    targetPrice = basis * (1 + targetValue / 100);
  } else if (mode === 'dollar') {
    targetPrice = basis + targetValue / amount;
  } else {
    return null;
  }

  // 3. Everything else falls out of those two numbers.
  const totalCost    = basis * amount;
  const totalRevenue = targetPrice  * amount;
  const profit       = totalRevenue - totalCost;
  const profitPct    = (profit / totalCost) * 100;

  return { targetPrice, totalCost, totalRevenue, profit, profitPct };
}

// ─── tiny self-test you can run with `node src/lib/calculate.js` ───
// (Once you've implemented the function, this will print "OK" twice.)
// The `typeof` guard is REQUIRED: in the browser `process` is undeclared, and
// bare reads of an undeclared identifier throw ReferenceError even with `?.`.
// The IIFE (only invoked once `process` is known to exist) builds a file URL
// that matches import.meta.url on BOTH Windows (C:\… → file:///C:/…) and
// POSIX (/… → file:///…); the old `file://${argv}` form only matched POSIX.
if (typeof process !== 'undefined' && import.meta.url === (() => {
  const p = (process.argv?.[1] || '').replace(/\\/g, '/');
  return p.startsWith('/') ? `file://${p}` : `file:///${p}`;
})()) {
  const a = calculate({ currentPrice: 415, amount: 10, mode: 'percent', targetValue: 10 });
  const b = calculate({ currentPrice: 415, amount: 10, mode: 'dollar', targetValue: 100 });
  console.log(Math.abs(a.targetPrice - 456.5) < 1e-9 ? 'OK percent' : 'FAIL percent', a);
  console.log(Math.abs(b.targetPrice - 425) < 1e-9 ? 'OK dollar' : 'FAIL dollar', b);
}
