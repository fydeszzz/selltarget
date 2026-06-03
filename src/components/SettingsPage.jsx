// App version — bump this string on each release.
const APP_VERSION = '1.0.0';

// Ko-fi support link. Replace `sellsignal` with your actual Ko-fi handle
// (the part after ko-fi.com/). 0% platform fee; global cards in, Stripe/
// PayPal payout.
const SUPPORT_URL = 'https://ko-fi.com/honeybagel86887';

export default function SettingsPage({ lang, setLang, theme, setTheme, t }) {
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
          <span className="label">{t.settingsTheme}</span>
          <div className="lang-toggle settings-lang" role="tablist" aria-label={t.settingsTheme}>
            <button
              role="tab"
              aria-selected={theme === 'dark'}
              className={`lang ${theme === 'dark' ? 'on' : ''}`}
              onClick={() => setTheme('dark')}
            >{t.themeDark}</button>
            <button
              role="tab"
              aria-selected={theme === 'light'}
              className={`lang ${theme === 'light' ? 'on' : ''}`}
              onClick={() => setTheme('light')}
            >{t.themeLight}</button>
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

        <div className="field">
          <span className="label">{t.settingsSupport}</span>
          <a
            className="support-btn"
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img className="support-icon" src="/cathand.png" alt="" aria-hidden />
            {t.supportButton}
          </a>
          <p className="page-desc">{t.supportNote}</p>
        </div>
      </section>
    </main>
  );
}
