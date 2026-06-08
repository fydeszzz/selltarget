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
- US pre-market / after-hours tag: shows the current extended-session price next to the company name (display only, does not affect the calculation)
- Search by code or company name (e.g. `2330` or `台積電`, `TSLA` or `Tesla`)
- Taiwan fee modeling: broker commission (0.1425%, NT$20 floor, optional 折數 multiplier) + securities transaction tax, ETF-aware
- Daily price-limit display (漲停 / 跌停, ±10%) for the TW market
- Live-vs-previous-close freshness tag with the trade timestamp in Taipei time
- Commission-discount reverse calculator: enter what you paid, see the 折數 you actually got
- Bilingual UI (English / 繁體中文) with auto-detection and persistence
- Mobile-first dark editorial layout with a persistent bottom nav

## Who It's For
- **Dollar-cost-averaging ETF savers** — set a "sell when profit hits the goal" target price and let discipline, not emotion, time your exit.
- **Day traders / short-term traders** — instantly compute the sell price, commission, and transaction tax to stay strict on daily entries and exits.
- **Any TW / US investor who wants to know the exit before the entry** — one tap to the price you should sell at and your real net profit.

## Quick Start Example
After running the app locally, the **賣點試算 (Sell-Target)** tab opens by default:

> Example: TSLA at `$415`, holding `10` shares, want `+10%` → sell at **`$456.50`**.

1. Pick a market (台股 / 美股), type a code or name, and press **取得 (Fetch)** to pull a live price.
2. Enter how many shares you hold and choose a goal mode (報酬率 % or 目標獲利 $).
3. The right panel shows the **target sell price**, total cost/revenue, profit, and for TW a full commission + tax breakdown with net profit.

Switch tabs from the bottom nav: **手續費試算 (Fee Calculator)** reverse-calculates your broker discount, and **設定 (Settings)** holds language, about, and bug-report info.

## Use Case

**Example 1: Timing the sell of a TW dividend-ETF holding**

<img src="public/example1.png" width="300" alt="Use Case example 1: timing a TW dividend-ETF sell">

1. On the **賣點試算 (Sell-Target)** tab at the bottom of the home page, enter a TW stock code or name. For example `00919` (Capital Taiwan Select High Dividend), then press **取得 (Fetch)**. The app pulls the current price automatically; if the market is closed or the price looks wrong, you can type the current price by hand. Share count is always entered manually.
2. **Commission multiplier**: TW trades carry a commission multiplier, which you can work out on the **手續費試算 (Fee Calculator)** tab. For a 40% deal enter `0.4`; leave it blank for the full rate. (Commission has a NT$20 per-trade minimum, so the multiplier has no effect on small amounts.)
3. **Target return / profit**: Type the return or profit you want. For example a `10` (%) return, or a `10000` (TWD) target profit.
4. **Target sell price**: The panel below instantly shows your optimal sell price, along with total cost, total revenue, profit, and return (%). It also itemizes the buy/sell commission and securities transaction tax, then gives your net profit and net return.

## Persona & Scenario

### 👤 Jerry: the salaried dollar-cost-averaging ETF saver

Jerry buys high-dividend ETFs on autopilot every payday and is a long-term saver with no time to watch the market. He has one clear goal: cash out entirely once his accumulated profit reaches NT$1,000,000 — but every time the numbers move, he has to grab a calculator and recompute "so how high does it need to go before I sell?"

★ How he uses Sell Signal: open the **Sell-Target** tab, switch to the TW market, enter the ETF code or name, press **Fetch** to auto-fill the price, fill in the shares held, then choose "target profit" and enter 1000000. The app instantly computes the optimal sell price, shows the buy/sell commission and securities transaction tax, and gives the net profit; he can also override the price and share count by hand to explore his ideal exit. Jerry no longer recomputes every month — he just executes the moment the price hits the target.

### 👤 Martin: the disciplined full-time day trader

Martin mainly does intraday day trades. For him, "speed" and "discipline" are everything: he needs to know the exit price and the cost of the trade before he enters, or even a small gain can be eaten up by commission and transaction tax.

★ How he uses Sell Signal: when an opportunity appears intraday, he opens the **Sell-Target** tab and uses % return mode to quickly nail the short-term target sell price; then he switches to **Fee Calculator** and uses his broker's 折數 to reverse out the real commission, adding the transaction tax to instantly judge whether the net gain is worth the trade. He prices every trade out before placing it — which keeps him disciplined.

## Tech Stack
- **React 18** + **Vite 6** (single-page web app, no backend)
- Live TW data via **TWSE MIS** (real-time quote + limits) and **TWSE OpenAPI** (name→code list)
- Live US data via **Yahoo Finance** v8 chart + v1 search

## Tabs
| Tab | Component | Description |
|---|---|---|
| <img src="public/stock.png" width="32" style="vertical-align:center">賣點試算 / Sell-Target | `App` (calc view) | Live price fetch, sell-target math, TW fee breakdown |
| <img src="public/calculator.png" width="32" style="vertical-align:center">手續費試算 / Fee Calculator | `FeeDiscountPage` | Reverse-calculate broker commission discount (折數) |
| <img src="public/settings.png" width="32" style="vertical-align:center">設定 / Settings | `SettingsPage` | Language toggle, About, Bug Report, App Version |

## Data Sources
| Source | Purpose |
|---|---|
| TWSE MIS | Real-time TW quote, 漲跌停, board (上市/上櫃), industry |
| TWSE OpenAPI | Full listed-stock catalog for name→code lookup |
| Yahoo Finance (v8 chart) | US real-time price + currency + exchange |
| Yahoo Finance (v1 search) | US symbol resolution from a company name |

## Disclaimer
- Yahoo prices can be 15-20 minutes delayed depending on the exchange.
- This is an educational calculator, **not** investment advice.

## Roadmap (Work in Progress)
- **Price-alert push (到價通知)** — push a notification when the price hits the user's target return/profit.
- **Exchange-accurate TW price limits** — replace the ±10% approximation with the TWSE tick-size table (`priceLimits.pickTick`) and the official `limits` already returned by `fetchPrice`.

## Changelog

### 2026-06-07
- Added "Who It's For" and "Persona & Scenario" sections that describe the target users and walk through their workflows from a user's point of view.
- Unified tab names: "計算機 / Calculator" → "賣點試算 / Sell-Target", "手續費 / Discount" → "手續費試算 / Fee Calculator" (UI and docs).
- Refocused the README for a portfolio audience: removed local-run commands, the desktop shortcut, the project structure tree, and CORS-proxy details.

### 2026-06-04
- Added a "Use Case" section walking through a TW dividend-ETF sell-timing example.
- Added a "NT$20 minimum per trade" note to the commission-multiplier field, explaining why the multiplier has no effect on small amounts.
- Code cleanup: onFetch now uses a stable useCallback, and dead code was removed.

### 2026-06-03
- Minor docs touch-up.
- Show TW or ET Date in the stock status section

### 2026-06-02
- Added a Light appearance theme: switch between light and dark backgrounds in Settings. Defaults to dark and remembers your preference.
- Fixed several issues and polished details: improved the freshness of TW intraday quotes, corrected the quote-source label, and made other small UX refinements.

### 2026-05-31
- Initial release: React + Vite scaffold, Yahoo price fetch, two goal modes, editorial dark UI.

---

## 👤 Author
Ricy Hsu

Contact: Email (mailto:fydeszzz@gmail.com)

---

## 📅 Last Updated
June 7, 2026
