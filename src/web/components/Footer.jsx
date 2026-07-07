import { useState } from 'react';
import PrivacyModal from './PrivacyModal.jsx';
import TermsModal from './TermsModal.jsx';
import DisclaimerModal from './DisclaimerModal.jsx';

// Site footer for the web build: legal links + a copyright line. Bilingual via
// the `lang` prop. Order: Privacy · Terms · Copyright · Disclaimer.
const YEAR = 2026;

export default function Footer({ lang = 'en' }) {
  const [open, setOpen] = useState(null);   // 'privacy' | 'terms' | 'disclaimer' | null
  const zh = lang === 'zh';

  return (
    <>
      <footer className="web-footer">
        <button className="footer-link" onClick={() => setOpen('privacy')}>
          {zh ? '隱私權聲明' : 'Privacy Notice'}
        </button>
        <span className="footer-sep" aria-hidden>·</span>
        <button className="footer-link" onClick={() => setOpen('terms')}>
          {zh ? '使用條款' : 'Terms of Use'}
        </button>
        <span className="footer-sep" aria-hidden>|</span>
        <span className="footer-copy">
          {zh
            ? `Copyright © ${YEAR} SellTarget，版權所有`
            : `Copyright © ${YEAR} SellTarget. All Rights Reserved.`}
        </span>
        <span className="footer-sep" aria-hidden>·</span>
        <button className="footer-link" onClick={() => setOpen('disclaimer')}>
          {zh ? '免責聲明' : 'Disclaimer'}
        </button>
      </footer>

      {open === 'privacy'    && <PrivacyModal    lang={lang} onClose={() => setOpen(null)} />}
      {open === 'terms'      && <TermsModal      lang={lang} onClose={() => setOpen(null)} />}
      {open === 'disclaimer' && <DisclaimerModal lang={lang} onClose={() => setOpen(null)} />}
    </>
  );
}
