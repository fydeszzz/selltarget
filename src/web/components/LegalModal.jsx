import { useEffect } from 'react';

// Shared shell for the footer's legal documents (Privacy / Terms / Disclaimer).
// Each document supplies a `data` object: { title, updated?, intro?, sections[] }.
// A section is { title, body?, list?, after?, contact? }. Content is user-facing
// localized data and lives in the per-document components; this file is only the
// presentation + behaviour (Escape to close, background scroll lock).

const CONTACT_EMAIL = 'fydeszzz@gmail.com';

function Section({ s, lang }) {
  return (
    <div className="pp-section">
      {s.title && <h3 className="pp-h3">{s.title}</h3>}
      {s.body && <p className="pp-p">{s.body}</p>}
      {s.list && (
        <ul className="pp-list">
          {s.list.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
      {s.after && <p className="pp-p">{s.after}</p>}
      {s.contact && (
        <p className="pp-p">
          {lang === 'zh' ? '電子郵件：' : 'Email: '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="pp-link">{CONTACT_EMAIL}</a>
        </p>
      )}
    </div>
  );
}

export default function LegalModal({ data, lang = 'en', onClose }) {
  // Close on Escape, and lock background scroll while the modal is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={data.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 className="modal-title">{data.title}</h2>
            {data.updated && <p className="modal-sub">{data.updated}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label={lang === 'zh' ? '關閉' : 'Close'}>×</button>
        </div>

        <div className="modal-body">
          {data.intro && <p className="pp-intro">{data.intro}</p>}
          {data.sections.map((s, i) => <Section key={i} s={s} lang={lang} />)}
        </div>
      </div>
    </div>
  );
}
