import { asset } from '../lib/asset.js';

// App version — single source of truth is package.json "version", injected at
// build time by Vite (see vite.config.js `define`). Bump it in package.json
// ONLY; the installer filename and this label then stay in lockstep.
const APP_VERSION = __APP_VERSION__;

// Ko-fi support link. Replace `sellsignal` with your actual Ko-fi handle
// (the part after ko-fi.com/). 0% platform fee; global cards in, Stripe/
// PayPal payout.
const SUPPORT_URL = 'https://ko-fi.com/honeybagel86887';

// Author's GitHub repo — used by the Bug Report button so users can open
// issues or reach the author directly.
const GITHUB_URL = 'https://github.com/fydeszzz/sellsignal';

export default function SettingsPage({ lang, setLang, theme, setTheme, t }) {
  return (
    <main className="grid">
      <section className="panel form settings">
        <div className="page-head">
          <div className="page-title-row">
            <img className="page-icon" src={asset('settings.png')} alt="" aria-hidden />
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
          <span className="label">{t.settingsBugReport}</span>
          <a
            className="support-btn"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg className="support-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {t.githubButton}
          </a>
          <p className="page-desc">{t.settingsBugReportText}</p>
        </div>

        <div className="field">
          <span className="label">{t.settingsSupport}</span>
          <a
            className="support-btn"
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img className="support-icon" src={asset('cathand.png')} alt="" aria-hidden />
            {t.supportButton}
          </a>
          <p className="page-desc">{t.supportNote}</p>
        </div>

        <div className="field">
          <span className="label">{t.settingsAbout}</span>
          <img className="about-logo" src={asset('logo.png')} alt="Sell Signal" />
          <p className="page-desc">{t.settingsAboutText}</p>
        </div>

        <div className="field">
          <span className="label">{t.settingsVersion}</span>
          <p className="page-desc mono">{APP_VERSION}</p>
        </div>
      </section>
    </main>
  );
}
