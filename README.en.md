<div align="right">

**English** · [繁體中文](README.md)

</div>

# Sell Target — Know your exit before you enter.
![logo](public/logo.png)
~ Pick a stock · Set a goal · See the price you should sell at ~

## Features
- Sell-target calculation: enter price, shares, and a goal to get the exact sell price
- Two goal modes: target **% return** or target **$ profit**
- Live price fetch for **TW stocks** (TWSE MIS) and **US stocks** (Yahoo Finance)
- TW net-profit calculation: total cost - broker commission (optional 折數 multiplier) - securities transaction tax, with automatic ETF detection
- Commission-discount reverse calculator: enter what you paid, see the 折數 you actually got
- Bilingual UI (English / 繁體中文) with auto-detection and persistence

## Who It's For
- **Dollar-cost-averaging ETF savers** — set a "sell when profit hits the goal" target and let discipline, not emotion, time your exit.
- **Day traders / short-term traders** — instantly compute the sell price, commission, and transaction tax to stay strict on daily entries and exits.
- **Any TW / US investor who wants to know the exit before the entry** — one tap to the price you should sell at and your real net profit.

## Quick Start
On launch, the **賣點試算 (Sell-Target)** tab opens by default:

> Example: TSLA at `$415`, holding `10` shares, want `+10%` → sell at **`$456.50`**.

1. Pick a market (台股 / 美股), type a code or name, and press **取得 (Fetch)** to pull a live price.
2. Enter your average cost and how many shares you hold, then choose a goal mode (報酬率 % or 目標獲利 $).
3. The panel shows the **target sell price**, total cost/revenue, and profit; for TW it adds a full commission + tax breakdown with net profit.

<img src="public/example1.png" width="300" alt="Timing a TW dividend-ETF sell">

## Tech Stack
- **React 18** + **Vite 6** (single-page web app, no backend)
- Live TW data via **TWSE MIS** (real-time quote) and **TWSE OpenAPI** (name→code list)
- Live US data via **Yahoo Finance** v8 chart + v1 search

## Web Version (Prototype)
> Same project as the mobile/desktop build, sharing the exact same calculation logic; only the layout and shell differ.

- Redesigned for desktop browsers: a top navigation bar plus a two-column workspace (inputs on the left, results on the right), with no phone frame
- Same dark/light themes and English / 繁體中文 toggle
- Footer with copyright and a bilingual (EN / 中文) privacy notice
- Preview: run `npm run dev`, then open `/web.html`

## Tabs
| Tab | Component | Description |
|---|---|---|
| <img src="public/stock.png" width="32" style="vertical-align:center">賣點試算 / Sell-Target | `App` (calc view) | Live price fetch, sell-target math, TW fee breakdown |
| <img src="public/calculator.png" width="32" style="vertical-align:center">手續費折數 / Fee Discount | `FeeDiscountPage` | Reverse-calculate broker commission discount, and apply it to Sell-Target in one tap |
| <img src="public/settings.png" width="32" style="vertical-align:center">設定 / Settings | `SettingsPage` | Language toggle, About, Bug Report, App Version |

## Data Sources
| Source | Purpose |
|---|---|
| TWSE MIS | Real-time TW quote, board (上市/上櫃), industry |
| TWSE OpenAPI | Full listed-stock catalog for name→code lookup |
| Yahoo Finance (v8 chart) | US real-time price + currency + exchange |
| Yahoo Finance (v1 search) | US symbol resolution from a company name |

## Disclaimer
- Yahoo prices can be 15-20 minutes delayed depending on the exchange.
- This is an educational calculator, **not** investment advice.

## Roadmap (Work in Progress)
- **Price-alert push (到價通知)** — push a notification when the price hits the user's target return/profit.
- **Ex-dividend calendar (除權息日曆)** — link to TWSE data to keep dividend amounts and ex-dividend dates in sync.
- **Disposition-stock calendar (處置股日曆)** — live updates of stocks about to be, or currently under, disposition.

## Changelog

### 2026-07-07
- Renamed the project to SellTarget (brand, app name, Android package ID, and desktop icon all updated)
- Replaced the logo with a new design
- Updated the GitHub link to `github.com/fydeszzz/selltarget`
- Regenerated the Android release signing keystore under the selltarget name
- Rebuilt the desktop installers (SellTarget Setup / portable)
- Doubled the Settings-page logo size and unified the font size of section labels like "target sell price" and "your discount"

### 2026-06-28
- Added a web version prototype
- Docs correction: removed unused i18n keys, fixed accessibility label semantics.

### 2026-06-23
- Updated the interface for U.S. stock profits/returns and commission discount rates.
- Moved help text to info icons beside section headings—tap or hover to view details.

### 2026-06-21
- Live quotes now work for leveraged / inverse ETFs (e.g. `00631L`, `00632R`)

### 2026-06-20
- Clearer error and helper messages (connection failure, invalid price, small trade amount)
- Refined English wording and minor text

### 2026-06-19
- Sell price now shows a "vs current" reference percentage
- TW share count can switch between lots and odd-lots
- Apply a fee discount straight to the sell-target calculator
- More reliable price fetching
- Updated the app icon

### 2026-06-12
- Fixed an intermittent TW live-quote connection error (`ERR_CONNECTION_RESET`): the desktop app now retries the native fetch quickly on failure, with the proxy chain kept as a fallback.
- Removed the TW price-limit display so the layout reads the same as the US market.

### 2026-06-10
- Stock search now shows a type-ahead dropdown: entering a TW/US name lists every same-prefix match live, ranked with stocks first and warrants/leverage after.
- Added an "Avg cost" field: enter your average holding price to see live unrealized P&L; the sell target is now based on your actual cost.
- UI redesign: current price and average cost sit side by side, the target is one unified field.

### 2026-06-07
- Added "Who It's For" and a usage walkthrough from a user's point of view.

### 2026-06-04
- Added a "Use Case" section walking through a TW dividend-ETF sell-timing example.
- Code cleanup.

### 2026-06-03
- Minor docs touch-up.
- Show TW or ET date in the stock status section.

### 2026-06-02
- Added a Light appearance theme: switch between light and dark in Settings. Defaults to dark and remembers your preference.
- Fixed several issues and polished details.

### 2026-05-31
- Initial release: React + Vite scaffold, Yahoo price fetch, two goal modes, editorial dark UI.

---

## 👤 Author
Ricy Hsu

Contact: [fydeszzz@gmail.com](mailto:fydeszzz@gmail.com)

---

## 📅 Last Updated
July 7, 2026
