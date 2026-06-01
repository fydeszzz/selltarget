// App version — bump this string on each release.
const APP_VERSION = '1.0.0';

export default function SettingsPage({ lang, setLang, t }) {
  return (
    <main className="grid">
      <section className="panel form settings">
        <div className="page-head">
          <div className="page-title-row">
            <img className="page-icon" src="/settings.png" alt="" aria-hidden />
            <h2 className="page-title">{t.settingsTitle}</h2>
          </div>
        </div>

        <div className="field">
          <span className="label">{t.settingsLang}</span>
          <div className="lang-toggle settings-lang" role="tablist" aria-label={t.languageLabel}>
            <button
              role="tab"
              aria-selected={lang === 'zh'}
              className={`lang ${lang === 'zh' ? 'on' : ''}`}
              onClick={() => setLang('zh')}
            >中</button>
            <button
              role="tab"
              aria-selected={lang === 'en'}
              className={`lang ${lang === 'en' ? 'on' : ''}`}
              onClick={() => setLang('en')}
            >EN</button>
          </div>
        </div>

        <div className="field">
          <span className="label">{t.settingsAbout}</span>
          <img className="about-logo" src="/logo.png" alt="Sell Signal" />
          <p className="page-desc">{t.settingsAboutText}</p>
        </div>

        <div className="field">
          <span className="label">{t.settingsBugReport}</span>
          <p className="page-desc">{t.settingsBugReportText}</p>
        </div>

        <div className="field">
          <span className="label">{t.settingsVersion}</span>
          <p className="page-desc mono">{APP_VERSION}</p>
        </div>

        <p className="muted small">{t.disclaimer}</p>
      </section>
    </main>
  );
}
