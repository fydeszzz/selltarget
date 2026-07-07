import LegalModal from './LegalModal.jsx';

// Bilingual Disclaimer. The two key points are taken verbatim from the app's
// in-product disclaimer (quote delay + educational-use note) and surfaced first,
// then expanded with the standard accuracy / estimate / liability notes.

const DISCLAIMER = {
  en: {
    title: 'Disclaimer',
    updated: 'Last updated: June 29, 2026',
    intro: 'Please read the following before relying on any figure shown in SellTarget.',
    sections: [
      {
        title: 'Key Points',
        list: [
          'Yahoo prices may be delayed by 15–20 minutes depending on the exchange.',
          'This tool is for educational estimation only and is not investment advice.',
        ],
      },
      {
        title: 'Quote Delay and Data Accuracy',
        body: 'Live quotes are sourced from third parties (the Taiwan Stock Exchange and Yahoo Finance). Depending on the exchange, prices may be delayed, incomplete, or temporarily unavailable. We do not guarantee the accuracy, timeliness, or completeness of any quote or market information.',
      },
      {
        title: 'Calculations Are Estimates',
        body: 'Sell targets, commissions, transaction taxes, and net profit are calculated from standard rates and the values you enter. Your broker’s actual fees, discounts, rounding, and applicable taxes may differ, so real results will vary. Always confirm figures with your broker.',
      },
      {
        title: 'Not Investment Advice',
        body: 'Nothing in SellTarget constitutes financial, investment, tax, or legal advice, or a recommendation to buy or sell any security. All output is for reference and learning only. You are solely responsible for your own trading and investment decisions.',
      },
      {
        title: 'Use at Your Own Risk',
        body: 'The Service is provided "as is" without warranty of any kind. To the maximum extent permitted by law, the author accepts no liability for any loss or damage, including trading or investment losses, arising from your use of or reliance on the Service.',
      },
    ],
  },
  zh: {
    title: '免責聲明',
    updated: '最後更新：2026 年 6 月 29 日',
    intro: '在依據 SellTarget 顯示的任何數字採取行動前，請先閱讀以下說明。',
    sections: [
      {
        title: '重點摘要',
        list: [
          'Yahoo 股價依交易所不同，可能延遲 15～20 分鐘。',
          '本工具僅供教學試算，並非投資建議。',
        ],
      },
      {
        title: '報價延遲與資料正確性',
        body: '即時報價取自第三方（臺灣證券交易所與 Yahoo Finance）。依交易所不同，價格可能延遲、不完整或暫時無法取得。我們不擔保任何報價或行情資訊之正確性、即時性或完整性。',
      },
      {
        title: '試算僅供參考',
        body: '賣出目標價、手續費、證交稅與淨利，係以標準費率及您輸入的數值計算。您券商實際的手續費、折扣、進位方式與適用稅負可能不同，故實際結果會有差異。請務必與您的券商確認數字。',
      },
      {
        title: '非投資建議',
        body: 'SellTarget 的任何內容均不構成財務、投資、稅務或法律建議，亦非買賣任何有價證券之推薦。所有結果僅供參考與學習之用。您須自行為您的交易與投資決策負完全責任。',
      },
      {
        title: '使用風險自負',
        body: '本服務以「現狀」提供，不附帶任何形式之擔保。在法律允許之最大範圍內，對於因您使用或信賴本服務所生之任何損失或損害（包括交易或投資損失），作者概不負責。',
      },
    ],
  },
};

export default function DisclaimerModal({ lang = 'en', onClose }) {
  return <LegalModal data={DISCLAIMER[lang] || DISCLAIMER.en} lang={lang} onClose={onClose} />;
}
