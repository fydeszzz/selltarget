// Netlify Function proxy for TWSE MIS real-time quotes — the rescue path
// when the netlify.toml edge redirect (/api/mis/*) is blocked.
//
// Why this exists: TWSE's WAF intermittently blocks Netlify's edge-proxy
// egress IPs (the request bounces as a 502 whose body is the Chinese
// "FOR SECURITY REASONS" page). The block is sticky per edge node, so a
// browser pinned to a blocked node fails EVERY retry through the redirect.
// Functions run on AWS Lambda with a different egress IP pool, so this
// path usually survives when the edge path is blocked — and vice versa.
//
// Deliberately narrow: only getStockInfo.jsp, query string passed through
// verbatim. Not a general-purpose proxy.

const MIS_URL = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
// Same Referer the edge redirect sends — without it MIS withholds
// intraday data (returns z = "-" previous-day values only).
const REFERER = 'https://mis.twse.com.tw/stock/fibest.jsp?stock=2330';

export default async function handler(req) {
  const search = new URL(req.url).search;
  let lastStatus = 502;
  let lastDetail = '';

  // A few tries with short backoff: TWSE load-balances across nodes and
  // only some of them reject a given source IP, so an immediate retry
  // often lands on a node that answers.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 200 * attempt));
    try {
      const res = await fetch(MIS_URL + search, {
        headers: { Referer: REFERER, Accept: 'application/json' },
        // Short per-try timeout: the client aborts its whole attempt after
        // 5 s, so the retries here must fit inside that budget. WAF blocks
        // come back near-instantly; only a genuine hang eats the 2.5 s.
        signal: AbortSignal.timeout(2500),
      });
      // MIS pads responses with leading blank lines and mislabels the
      // content type, so validate the payload shape, not just res.ok.
      const text = (await res.text()).trim();
      if (res.ok && text.startsWith('{')) {
        return new Response(text, {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      }
      lastStatus = res.status;
      lastDetail = text.slice(0, 120);
    } catch (e) {
      lastDetail = String(e && e.message) || 'fetch failed';
    }
  }

  return new Response(
    JSON.stringify({ error: 'MIS upstream failed', upstreamStatus: lastStatus, detail: lastDetail }),
    { status: 502, headers: { 'content-type': 'application/json' } },
  );
}

export const config = { path: '/api/misfn' };
