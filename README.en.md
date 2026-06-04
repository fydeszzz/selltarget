<div align="right">

**English** · [繁體中文](README.md)

</div>

# Sell Signal — Know your exit before you enter.
![logo](public/logo.png)
~ Pick a stock · Set a goal · See the price you should sell at ~

## Features
- Sell-target calculator: enter price, shares, and a goal to get the exact sell price
- Two goal modes: target **% return** or target **$ profit** (each remembers its own value)
- Live price fetch for **TW stocks** (TWSE MIS) and **US stocks** (Yahoo Finance)
- US pre-market / after-hours tag: shows the current extended-session price next to the company name (display only — does not affect the calculation)
- Search by code or company name (e.g. `2330` or `台積電`, `TSLA` or `Tesla`)
- Taiwan fee modeling: broker commission (0.1425%, NT$20 floor, optional 折數 multiplier) + securities transaction tax, ETF-aware
- Daily price-limit display (漲停 / 跌停, ±10%) for the TW market
- Live-vs-previous-close freshness tag with the trade timestamp in Taipei time
- Commission-discount reverse calculator: enter what you paid, see the 折數 you actually got
- Bilingual UI (English / 繁體中文) with auto-detection and persistence
- Mobile-first dark editorial layout with a persistent bottom nav

## Quick Start Example
After running the app locally, the **計算機 (Calculator)** tab opens by default:

> Example: TSLA at `$415`, holding `10` shares, want `+10%` → sell at **`$456.50`**.

1. Pick a market (台股 / 美股), type a code or name, and press **取得 (Fetch)** to pull a live price.
2. Enter how many shares you hold and choose a goal mode (報酬率 % or 目標獲利 $).
3. The right panel shows the **target sell price**, total cost/revenue, profit, and — for TW — a full commission + tax breakdown with net profit.

Switch tabs from the bottom nav: **手續費 (Discount)** reverse-calculates your broker discount, and **設定 (Settings)** holds language, about, and bug-report info.

## Tech Stack
- **React 18** + **Vite 6** (single-page web app, no backend)
- **Vanilla CSS** design system in one `styles.css` (CSS variables, no framework)
- Hand-rolled **i18n** (en / zh) — no library, ~30 keys
- Live TW data via **TWSE MIS** (real-time quote + limits) and **TWSE OpenAPI** (name→code list)
- Live US data via **Yahoo Finance** v8 chart + v1 search
- **Vite dev proxy** (correct Referer/CORS in dev) with a public **CORS-proxy fallback chain** for static builds

## Running Locally
```bash
npm install      # first time only
npm run dev      # starts dev server at localhost:5173 (auto-opens)
npm run build    # production build → dist/
npm run preview  # preview production build at localhost:5173
```

The pure-logic modules double as runnable self-tests:
```bash
node src/lib/calculate.js   # prints OK percent / OK dollar
node src/lib/twFees.js      # prints PASS commission / tax / etf-tax
```

## Desktop Shortcut (Windows)
If you would rather not `cd` into the project and run `npm run dev` every time, you can put a one-click launcher on your desktop.

**Option 1: Batch file (simplest)**

Create `SellSignal Dev.bat` on your desktop with the following content (swap the path for your own project location):
```bat
@echo off
title SellSignal Dev Server
cd /d "C:\path\to\SellSignal"

if not exist "node_modules" (
    echo node_modules not found. Running npm install ...
    call npm install
)

echo Starting dev server ^(npm run dev^) ...
call npm run dev

echo.
echo Dev server stopped. Press any key to close.
pause >nul
```
Double-clicking it changes into the project directory, installs dependencies if needed, and starts the Vite dev server. The `/d` flag on `cd /d` switches both drive and directory, so it works even if the project lives on another drive.

**Option 2: Shortcut with an icon (`.lnk`)**

A `.lnk` shortcut can carry a custom icon, but Windows icons only accept the `.ico` format (a `.png` will not work directly). This project ships `make-shortcut.ps1`, which converts `public/stock.png` into a multi-size `.ico` (16 / 32 / 48 / 256 px) and creates a desktop shortcut pointing at the `.bat` above:
```powershell
powershell -ExecutionPolicy Bypass -File make-shortcut.ps1
```
Adjust the `$projectDir` path at the top of the script for your environment before running. The generated `SellSignal.ico` is local-only and is listed in `.gitignore`, so it stays out of version control.

> If the icon does not update right away, that is the Windows icon cache. Refresh the desktop (F5) or restart File Explorer.

## Project Structure
```
stock-calculator/
├─ src/
│  ├─ main.jsx                 # React entry (createRoot) + styles.css import
│  ├─ App.jsx                  # Root: state, market/lang prefs, calc orchestration
│  ├─ styles.css               # Full design system (tokens, layout, components)
│  ├─ lib/
│  │  ├─ calculate.js          # Core sell-target math (% / $ modes)
│  │  ├─ twFees.js             # TW commission + securities tax, ETF detection
│  │  ├─ feeDiscount.js        # Reverse-calc the broker 折數 from a paid fee
│  │  ├─ priceLimits.js        # TWSE ±10% daily limit (漲停/跌停)
│  │  ├─ fetchPrice.js         # Market-aware price fetcher (TW + US) w/ proxy chain
│  │  ├─ i18n.js               # en/zh strings + language/market detection
│  │  └─ tw-stocks.json        # Bundled fallback list (~85 top TW listings)
│  └─ components/
│     ├─ BottomNav.jsx         # Persistent Calculator · Discount · Settings nav
│     ├─ FeeDiscountPage.jsx   # 手續費 discount reverse calculator
│     └─ SettingsPage.jsx      # Language, About, Bug Report, App Version
│
├─ public/
│  ├─ stock.png                # Calculator tab icon
│  ├─ calculator.png           # Discount tab icon
│  ├─ settings.png             # Settings tab icon
│  └─ logo.png                 # Brand logo (shown in Settings → About)
│
├─ index.html
├─ vite.config.js              # Dev proxies for MIS / TWSE / Yahoo
├─ package.json
└─ README.md
```

## Tabs
| Tab | Component | Description |
|---|---|---|
| <img src="public/stock.png" width="32" style="vertical-align:center">計算機 / Calculator | `App` (calc view) | Live price fetch, sell-target math, TW fee breakdown |
| <img src="public/calculator.png" width="32" style="vertical-align:center">手續費 / Discount | `FeeDiscountPage` | Reverse-calculate broker commission discount (折數) |
| <img src="public/settings.png" width="32" style="vertical-align:center">設定 / Settings | `SettingsPage` | Language toggle, About, Bug Report, App Version |

## Core Logic Modules
| Module | Responsibility |
|---|---|
| `calculate.js` | Target price from price/shares/goal; returns cost, revenue, profit, % |
| `twFees.js` | Buy + sell commission (NT$20 floor), 證交稅, net profit; ETF-aware |
| `feeDiscount.js` | 實付手續費 → 折數, effective rate, base fee |
| `priceLimits.js` | ±10% 漲停 / 跌停 (tick-size table stubbed for future accuracy) |
| `fetchPrice.js` | Routes to TW (MIS) or US (Yahoo); proxy fallback + name resolution |

The core sell-target math:

```text
percent mode → targetPrice = currentPrice * (1 + targetValue / 100)
dollar  mode → targetPrice = currentPrice + (targetValue / amount)
```

## TW Fee Constants
| Constant | Value | Meaning |
|---|---|---|
| `COMMISSION_RATE` | `0.001425` | 手續費 0.1425% per leg (buy + sell) |
| `COMMISSION_MIN` | `20` | NT$20 minimum commission per leg |
| `TAX_STOCK` | `0.003` | 證交稅 0.3% — general stocks, sell leg only |
| `TAX_ETF` | `0.001` | 證交稅 0.1% — ETFs (code starts with `00`) |

## Data Sources
| Source | Purpose |
|---|---|
| TWSE MIS | Real-time TW quote, 漲跌停, board (上市/上櫃), industry |
| TWSE OpenAPI | Full listed-stock catalog for name→code lookup |
| Yahoo Finance (v8 chart) | US real-time price + currency + exchange |
| Yahoo Finance (v1 search) | US symbol resolution from a company name |

## API & Proxy Notes
- **Dev** (`npm run dev`): calls go through Vite's same-origin proxy (`vite.config.js`), which adds the `Referer` header MIS requires for live ticks and bypasses CORS entirely.
- **Static build**: there is no server, so requests fall back to a chain of public CORS proxies (`corsproxy.io` → `allorigins` → `codetabs`). Slower, and may not return live MIS data.
- **Production recommendation**: deploy a real server-side proxy (Vercel / Netlify / Cloudflare Worker) replicating the dev forwards, then point the production URLs at it.
- Yahoo prices can be 15–20 minutes delayed depending on the exchange.
- This is an educational calculator, **not** investment advice.

## Known Issues / Optimization Notes
- **TW intraday quote**: TWSE MIS no longer returns the last-traded price (`z` / `pz`) on its public feed — both are `"-"` during trading, leaving only the live best-5 order book. To avoid showing yesterday's close intraday, `fetchTwPrice` now selects the price as `z → pz → best bid → best ask → prev close`; when a 五檔 value is used the freshness tag is honestly labeled **Bid / Ask** instead of **Live**. For a sell decision the best bid is the most relevant number anyway: it's roughly what you can sell into right now.
- Official TWSE `limits` are fetched in `fetchPrice.js` but the UI renders the local `priceLimits()` ±10% approximation instead; wiring `meta.limits` through would make TW limits exchange-accurate.
- `priceLimits.pickTick()` is a stub (`return null`); the tick-size table is documented inline for a future upgrade.
- `BottomNav` reuses `aria-label={t.marketLabel}`; it should have its own navigation label.

## Roadmap
- **到價通知 (price-alert push)** — push a notification when the price hits the user's target return/profit. Planned free to start, with advanced alerts as a paid tier.
- **Exchange-accurate TW price limits** — replace the ±10% approximation with the TWSE tick-size table (`priceLimits.pickTick`) and the official `limits` already returned by `fetchPrice`.

## Changelog

### 2026-06-03
- Minor docs touch-up.

### 2026-06-02
- Added a Light appearance theme: switch between light and dark backgrounds in Settings. Defaults to dark and remembers your preference.
- Fixed several issues and polished details: improved the freshness of TW intraday quotes, corrected the quote-source label, and made other small UX refinements.

### 2026-05-31
- Initial release: React + Vite scaffold, Yahoo price fetch, two goal modes, editorial dark UI.

---

## 👤 Author
Ricy Hsu
Contact: [Email] (fydeszzz@gmail.com)

---

## 📅 Last Updated
June 3, 2026
