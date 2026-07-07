import LegalModal from './LegalModal.jsx';

// Bilingual Terms of Use, based on a standard ToS template and tailored to
// SellTarget (a free, account-less educational stock calculator). Rendered
// through the shared LegalModal shell.

const TERMS = {
  en: {
    title: 'Terms of Use',
    updated: 'Last updated: June 29, 2026',
    intro: 'These Terms of Use ("Terms") govern your access to and use of SellTarget (the "Service"), a free educational stock sell-target and Taiwan fee calculator. By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, please do not use the Service.',
    sections: [
      {
        title: '1. Eligibility',
        body: 'You must be at least 13 years old to use the Service. By using it, you represent that you meet this requirement and that you are able to form a binding agreement.',
      },
      {
        title: '2. The Service',
        body: 'SellTarget is provided free of charge for educational and estimation purposes. It has no user accounts and stores your preferences only in your own browser. Live quotes are retrieved from third-party market-data providers (such as the Taiwan Stock Exchange and Yahoo Finance) and may be delayed or inaccurate.',
      },
      {
        title: '3. No Investment Advice',
        body: 'The Service does not provide financial, investment, tax, or legal advice. All prices, calculations, fees, taxes, and results are estimates for reference only and must not be relied upon for any trading or investment decision. You are solely responsible for your own decisions.',
      },
      {
        title: '4. Acceptable Use',
        body: 'You agree not to misuse the Service. In particular, you agree not to:',
        list: [
          'Use the Service for any unlawful purpose or in violation of any applicable regulation',
          'Attempt to disrupt, overload, reverse-engineer, or gain unauthorized access to the Service or its data sources',
          'Scrape, resell, or redistribute the Service or third-party quote data in violation of the providers’ terms',
        ],
      },
      {
        title: '5. Third-Party Data and Services',
        body: 'Quote data and certain functionality depend on third parties. Their availability, accuracy, and timeliness are outside our control, and their content is subject to their own terms and conditions. We are not responsible for third-party data, services, or links.',
      },
      {
        title: '6. Intellectual Property',
        body: 'The Service’s name, logo, design, and original code are the property of their author. Market data and trademarks referenced through the Service belong to their respective owners.',
      },
      {
        title: '7. Disclaimer of Warranties',
        body: 'The Service is provided "as is" and "as available", without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, accuracy, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that quotes will be accurate or timely.',
      },
      {
        title: '8. Limitation of Liability',
        body: 'To the maximum extent permitted by law, the author shall not be liable for any direct, indirect, incidental, or consequential damages, including any trading or investment losses, arising from your use of or inability to use the Service.',
      },
      {
        title: '9. Changes to the Service and Terms',
        body: 'We may modify or discontinue the Service, and may update these Terms, at any time. Changes take effect once posted here with an updated "Last updated" date. Continued use after changes constitutes acceptance.',
      },
      {
        title: '10. Governing Law',
        body: 'These Terms are governed by the laws of Taiwan (R.O.C.), without regard to its conflict-of-laws rules, except where mandatory local consumer-protection laws apply to you.',
      },
      {
        title: '11. Contact',
        body: 'Questions about these Terms? Reach us at:',
        contact: true,
      },
    ],
  },
  zh: {
    title: '使用條款',
    updated: '最後更新：2026 年 6 月 29 日',
    intro: '本使用條款（下稱「條款」）規範您對 SellTarget（下稱「本服務」，一款免費的教學用股票賣點與台股手續費計算工具）的存取與使用。當您存取或使用本服務，即表示您同意接受本條款拘束；若您不同意，請勿使用本服務。',
    sections: [
      {
        title: '1. 使用資格',
        body: '您須年滿 13 歲方可使用本服務。使用本服務即表示您聲明符合此條件，並具備締結具拘束力協議的能力。',
      },
      {
        title: '2. 服務內容',
        body: 'SellTarget 為免費提供，僅供教學與試算之用。本服務沒有使用者帳號，僅將您的偏好設定儲存於您自己的瀏覽器中。即時報價取自第三方行情資料來源（例如臺灣證券交易所與 Yahoo Finance），可能延遲或不準確。',
      },
      {
        title: '3. 非投資建議',
        body: '本服務不提供任何財務、投資、稅務或法律建議。所有價格、計算、手續費、稅金與結果均為僅供參考之估算，不得作為任何交易或投資決策之依據。您須自行為您的決定負完全責任。',
      },
      {
        title: '4. 可接受的使用方式',
        body: '您同意不濫用本服務。特別是，您同意不會：',
        list: [
          '將本服務用於任何非法目的或違反任何適用法規',
          '嘗試干擾、超載、逆向工程，或未經授權存取本服務或其資料來源',
          '以違反資料提供者條款之方式擷取、轉售或散布本服務或第三方報價資料',
        ],
      },
      {
        title: '5. 第三方資料與服務',
        body: '報價資料及部分功能依賴第三方。其可用性、正確性與即時性非我們所能控制，其內容並受各自條款規範。我們對第三方資料、服務或連結不負責任。',
      },
      {
        title: '6. 智慧財產權',
        body: '本服務之名稱、標誌、設計與原創程式碼為其作者所有。透過本服務引用之行情資料與商標，則屬各自權利人所有。',
      },
      {
        title: '7. 免責（不予擔保）',
        body: '本服務係以「現狀」及「現有」基礎提供，不提供任何明示或默示之擔保，包括適售性、特定用途之適用性、正確性或不侵權。我們不擔保本服務不中斷、無錯誤，亦不擔保報價之正確或即時。',
      },
      {
        title: '8. 責任限制',
        body: '在法律允許之最大範圍內，對於因您使用或無法使用本服務所生之任何直接、間接、附帶或衍生性損害（包括任何交易或投資損失），作者概不負責。',
      },
      {
        title: '9. 服務與條款之變更',
        body: '我們得隨時修改或停止本服務，並得隨時更新本條款。變更於張貼在本頁並更新「最後更新」日期後生效。變更後繼續使用即視為接受。',
      },
      {
        title: '10. 準據法',
        body: '本條款依中華民國（台灣）法律解釋與適用，但不適用其法律衝突規則；若有對您強制適用之當地消費者保護法令，則從其規定。',
      },
      {
        title: '11. 聯絡我們',
        body: '對本條款有任何疑問嗎？歡迎透過以下方式與我們聯絡：',
        contact: true,
      },
    ],
  },
};

export default function TermsModal({ lang = 'en', onClose }) {
  return <LegalModal data={TERMS[lang] || TERMS.en} lang={lang} onClose={onClose} />;
}
