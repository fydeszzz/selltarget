<div align="right">

[English](README.en.md) · **繁體中文**

</div>

# Sell Signal — 遵守紀律，到價即賣
![logo](public/logo.png)
~ 選定股票 · 設定目標 · 算出該賣的價格 ~

## 功能特色
- 賣出目標計算機：輸入價格、股數與目標，算出精確的賣出價
- 兩種目標模式：目標 **報酬率 %** 或目標 **獲利 $**（兩者各自記住輸入值）
- 即時股價查詢：**台股**（TWSE MIS）與 **美股**（Yahoo Finance）
- 美股盤前／盤後價標籤：盤前或盤後時段會在公司名旁顯示當前延長交易時段價（僅供參考，不影響試算）
- 可用代號或公司名稱搜尋（例如 `2330` 或 `台積電`、`TSLA` 或 `Tesla`）
- 台股費用試算：券商手續費（0.1425%、最低 NT$20、可選填折數倍率）＋ 證券交易稅，並自動辨識 ETF
- 台股每日漲跌停顯示（漲停 / 跌停，±10%）
- 即時／昨收的資料新鮮度標籤，附台北時間的成交時間戳
- 手續費折數反推計算機：輸入實付手續費，反推你實際拿到的折數
- 雙語介面（English / 繁體中文），自動偵測並記住偏好
- 行動裝置優先的深色編輯風版面，搭配常駐底部導覽列

## 快速開始範例
本機執行後，預設開啟 **計算機** 分頁：

> 範例：TSLA 股價 `$415`、持有 `10` 股、想要 `+10%` → 應在 **`$456.50`** 賣出。

1. 選擇市場（台股 / 美股），輸入代號或名稱，按 **取得** 拉取即時股價。
2. 輸入持有股數，選擇目標模式（報酬率 % 或 目標獲利 $）。
3. 右側面板顯示 **目標賣出價**、總成本／總收入、獲利，台股還會附上完整的手續費＋稅金分項與淨獲利。

從底部導覽列切換分頁：**手續費** 反推你的券商折數，**設定** 包含語言、關於與問題回報資訊。

## 技術架構
- **React 18** + **Vite 6**（單頁式網頁應用，無後端）
- 單一 `styles.css` 的**純 CSS** 設計系統（CSS 變數，不依賴框架）
- 手寫 **i18n**（en / zh），無套件，約 30 組字串
- 台股即時資料來自 **TWSE MIS**（即時報價＋漲跌停）與 **TWSE OpenAPI**（名稱→代號清單）
- 美股即時資料來自 **Yahoo Finance** v8 chart + v1 search
- **Vite 開發代理**（在開發時補上正確的 Referer/CORS）＋ 靜態建置用的公開 **CORS 代理備援鏈**

## 本機執行
```bash
npm install      # 第一次才需要
npm run dev      # 在 localhost:5173 啟動開發伺服器（自動開啟）
npm run build    # 正式建置 → dist/
npm run preview  # 在 localhost:5173 預覽正式建置
```

純邏輯模組本身就是可執行的自我測試：
```bash
node src/lib/calculate.js   # 印出 OK percent / OK dollar
node src/lib/twFees.js      # 印出 PASS commission / tax / etf-tax
```

## 專案結構
```
stock-calculator/
├─ src/
│  ├─ main.jsx                 # React 進入點（createRoot）＋ 引入 styles.css
│  ├─ App.jsx                  # 根元件：狀態、市場/語言偏好、計算流程協調
│  ├─ styles.css               # 完整設計系統（變數、版面、元件）
│  ├─ lib/
│  │  ├─ calculate.js          # 核心賣出目標計算（% / $ 模式）
│  │  ├─ twFees.js             # 台股手續費＋證交稅、ETF 判斷
│  │  ├─ feeDiscount.js        # 由實付手續費反推券商折數
│  │  ├─ priceLimits.js        # 台股 ±10% 漲跌停
│  │  ├─ fetchPrice.js         # 市場感知的股價抓取（台股＋美股）含代理鏈
│  │  ├─ i18n.js               # en/zh 字串＋語言/市場偵測
│  │  └─ tw-stocks.json        # 內建備援清單（約 85 檔熱門台股）
│  └─ components/
│     ├─ BottomNav.jsx         # 常駐底部導覽：計算機 · 折數 · 設定
│     ├─ FeeDiscountPage.jsx   # 手續費折數反推計算機
│     └─ SettingsPage.jsx      # 語言、關於、問題回報、App 版本
│
├─ public/
│  ├─ stock.png                # 計算機分頁圖示
│  ├─ calculator.png           # 折數分頁圖示
│  ├─ settings.png             # 設定分頁圖示
│  └─ logo.png                 # 品牌標誌（顯示於 設定 → 關於）
│
├─ index.html
├─ vite.config.js              # MIS / TWSE / Yahoo 的開發代理
├─ package.json
└─ README.md
```

## 分頁
| 分頁 | 元件 | 說明 |
|---|---|---|
| <img src="public/stock.png" width="32" style="vertical-align:center">計算機 / Calculator | `App`（calc view） | 即時股價查詢、賣出目標計算、台股費用分項 |
| <img src="public/calculator.png" width="32" style="vertical-align:center">手續費 / Discount | `FeeDiscountPage` | 反推券商手續費折數（折數） |
| <img src="public/settings.png" width="32" style="vertical-align:center">設定 / Settings | `SettingsPage` | 語言切換、關於、問題回報、App 版本 |

## 核心邏輯模組
| 模組 | 職責 |
|---|---|
| `calculate.js` | 由價格／股數／目標算出目標價；回傳成本、收入、獲利、% |
| `twFees.js` | 買進＋賣出手續費（NT$20 下限）、證交稅、淨獲利；含 ETF 判斷 |
| `feeDiscount.js` | 實付手續費 → 折數、實際費率、原始手續費 |
| `priceLimits.js` | ±10% 漲停 / 跌停（tick-size 表預留供未來精確化） |
| `fetchPrice.js` | 導向台股（MIS）或美股（Yahoo）；代理備援＋名稱解析 |

核心賣出目標數學：

```text
percent mode → targetPrice = currentPrice * (1 + targetValue / 100)
dollar  mode → targetPrice = currentPrice + (targetValue / amount)
```

## 台股費用常數
| 常數 | 數值 | 意義 |
|---|---|---|
| `COMMISSION_RATE` | `0.001425` | 手續費 0.1425%，每一筆（買＋賣各算） |
| `COMMISSION_MIN` | `20` | 每筆手續費最低 NT$20 |
| `TAX_STOCK` | `0.003` | 證交稅 0.3% — 一般個股，僅賣出 |
| `TAX_ETF` | `0.001` | 證交稅 0.1% — ETF（代號以 `00` 開頭） |

## 資料來源
| 來源 | 用途 |
|---|---|
| TWSE MIS | 台股即時報價、漲跌停、板別（上市/上櫃）、產業別 |
| TWSE OpenAPI | 完整上市股票清單，供名稱→代號查詢 |
| Yahoo Finance（v8 chart） | 美股即時價格＋幣別＋交易所 |
| Yahoo Finance（v1 search） | 由公司名稱解析美股代號 |

## API 與代理說明
- **開發時**（`npm run dev`）：請求走 Vite 的同源代理（`vite.config.js`），補上 MIS 取得即時報價所需的 `Referer` 標頭，並完全繞過 CORS。
- **靜態建置**：沒有伺服器，請求改用一連串公開 CORS 代理備援（`corsproxy.io` → `allorigins` → `codetabs`）。較慢，且可能無法取得 MIS 的即時資料。
- **正式部署建議**：架設真正的伺服器端代理（Vercel / Netlify / Cloudflare Worker）複製開發代理的轉發行為，再把正式環境的網址指向它。
- Yahoo 股價依交易所不同，可能延遲 15～20 分鐘。
- 本工具僅供教學試算，**並非**投資建議。

## 已知問題 / 優化筆記
- `fetchPrice.js` 已抓取台股官方的 `limits`，但 UI 目前改用本地 `priceLimits()` 的 ±10% 近似值；將 `meta.limits` 串接進來即可讓台股漲跌停與交易所一致。
- `priceLimits.pickTick()` 仍是空樁（`return null`）；tick-size 表已在程式碼內註解，供未來升級。
- `BottomNav` 沿用了 `aria-label={t.marketLabel}`；應改為它自己的導覽標籤。

## 開發藍圖
- **到價通知（price-alert push）** — 等股價達到使用者設定的目標報酬率／獲利時送出推播通知。規劃為免費起步、進階通知為付費功能。
- **與交易所一致的台股漲跌停** — 以 TWSE tick-size 表（`priceLimits.pickTick`）與 `fetchPrice` 已回傳的官方 `limits` 取代目前的 ±10% 近似值。

## 變更紀錄

### 2026-05-31
- 初版發布：React + Vite 專案骨架、Yahoo 股價抓取、兩種目標模式、深色編輯風 UI。

---

## 👤 Author
Ricy Hsu

---

## 📅 Last Updated
May 31, 2026
