import LegalModal from './LegalModal.jsx';

// Bilingual privacy notice, tailored to what SellSignal actually does: it has no
// accounts and no server of its own — preferences live in the browser's
// localStorage, and the only outbound data is the stock symbol you look up, sent
// to third-party quote providers (TWSE / Yahoo Finance) via public CORS proxies.
// The modal shell (Escape, scroll-lock, section rendering) lives in LegalModal.

const POLICY = {
  en: {
    title: 'Privacy Notice',
    updated: 'Last updated: June 28, 2026',
    intro: 'SellSignal is an educational stock sell-target and Taiwan fee calculator. It has no user accounts and no backend of its own. This notice explains what limited data is involved when you use the web app. By using SellSignal, you agree to the practices described below.',
    sections: [
      {
        title: '1. Information We Do Not Collect',
        body: 'We do not collect personal information. There is no sign-up, login, or profile. We do not ask for your name, email, brokerage account, holdings, or any payment information.',
      },
      {
        title: '2. Information Stored on Your Device',
        body: 'To remember your settings, the app saves a few preferences locally in your browser (localStorage):',
        list: [
          'Language (中 / EN)',
          'Appearance (dark / light)',
          'Selected market (TW / US)',
        ],
        after: 'This data stays on your device, is never transmitted to us, and can be cleared at any time through your browser settings.',
      },
      {
        title: '3. Stock Quote Requests',
        body: 'When you fetch a price, the stock symbol you enter is sent to third-party market-data providers to retrieve a quote:',
        list: [
          'Taiwan Stock Exchange (TWSE) market information service',
          'Yahoo Finance',
          'Public CORS proxy services that relay these requests in the browser build',
        ],
        after: 'These providers may log requests under their own privacy policies. We do not store your searches or build a history of what you look up.',
      },
      {
        title: '4. Cookies and Analytics',
        body: 'The app does not set advertising or tracking cookies and does not run third-party analytics. The only client-side storage used is the localStorage preferences described above.',
      },
      {
        title: '5. Third-Party Links and Services',
        body: 'SellSignal relies on or links to external services governed by their own privacy policies, including the quote providers and CORS proxies above, the hosting/CDN that serves the site, and the optional GitHub and Ko-fi support links. We are not responsible for the practices of those third parties.',
      },
      {
        title: '6. Data Security',
        body: 'We apply reasonable safeguards, but no method of electronic transmission or storage is completely secure. Quote requests to third parties travel over the public internet.',
      },
      {
        title: '7. Children’s Privacy',
        body: 'SellSignal is not directed to children under 13, and we do not knowingly collect any information from children.',
      },
      {
        title: '8. Not Investment Advice',
        body: 'SellSignal is provided for educational and estimation purposes only. Prices and calculations may be delayed or inaccurate and must not be relied upon as financial or investment advice.',
      },
      {
        title: '9. Changes to This Notice',
        body: 'We may update this Privacy Notice from time to time. Changes take effect once posted here with an updated "Last updated" date.',
      },
      {
        title: '10. Contact',
        body: 'Questions about this Privacy Notice? Reach us at:',
        contact: true,
      },
    ],
  },
  zh: {
    title: '隱私權聲明',
    updated: '最後更新：2026 年 6 月 28 日',
    intro: 'SellSignal 是一款教學用途的股票賣點與台股手續費計算工具，沒有使用者帳號，也沒有自己的後端伺服器。本聲明說明您在使用網頁版時所涉及的少量資料。使用本工具即表示您同意以下說明的做法。',
    sections: [
      {
        title: '1. 我們不會收集的資訊',
        body: '我們不會收集個人資料。本工具沒有註冊、登入或個人檔案，也不會要求您的姓名、電子郵件、證券帳戶、持股或任何付款資訊。',
      },
      {
        title: '2. 儲存在您裝置上的資訊',
        body: '為了記住您的設定，本工具會將少量偏好儲存在您瀏覽器的本機儲存空間（localStorage）：',
        list: [
          '語言（中 / EN）',
          '外觀（深色 / 淺色）',
          '所選市場（台股 / 美股）',
        ],
        after: '這些資料僅保存在您的裝置上，不會傳送給我們，您也可隨時透過瀏覽器設定清除。',
      },
      {
        title: '3. 股價查詢請求',
        body: '當您查詢股價時，您輸入的股票代號會傳送至第三方行情資料來源以取得報價：',
        list: [
          '臺灣證券交易所（TWSE）行情資訊服務',
          'Yahoo Finance',
          '在網頁版中協助轉送這些請求的公開 CORS Proxy 服務',
        ],
        after: '這些來源可能依其各自的隱私權政策記錄請求。我們不會儲存您的查詢內容，也不會建立查詢紀錄。',
      },
      {
        title: '4. Cookie 與分析',
        body: '本工具不會設定廣告或追蹤用 Cookie，也未使用第三方分析服務。唯一使用的用戶端儲存即為上述的 localStorage 偏好設定。',
      },
      {
        title: '5. 第三方連結與服務',
        body: 'SellSignal 依賴或連結至受其各自隱私權政策規範的外部服務，包括上述的行情來源與 CORS Proxy、提供本網站的主機 / CDN，以及選用的 GitHub 與 Ko-fi 贊助連結。我們對這些第三方的做法不負責任。',
      },
      {
        title: '6. 資料安全',
        body: '我們採取合理的保護措施，但任何電子傳輸或儲存方式都無法保證完全安全。向第三方發出的報價請求會經由公開網際網路傳送。',
      },
      {
        title: '7. 兒童隱私',
        body: 'SellSignal 並非以 13 歲以下兒童為對象，我們不會在知情的情況下收集兒童的任何資訊。',
      },
      {
        title: '8. 非投資建議',
        body: 'SellSignal 僅供教學與試算用途。價格與計算結果可能延遲或不準確，不得作為財務或投資建議依據。',
      },
      {
        title: '9. 本聲明之變更',
        body: '我們可能不定期更新本隱私權聲明。變更於張貼在本頁並更新「最後更新」日期後生效。',
      },
      {
        title: '10. 聯絡我們',
        body: '對本隱私權聲明有任何疑問嗎？歡迎透過以下方式與我們聯絡：',
        contact: true,
      },
    ],
  },
};

export default function PrivacyModal({ lang = 'en', onClose }) {
  return <LegalModal data={POLICY[lang] || POLICY.en} lang={lang} onClose={onClose} />;
}
