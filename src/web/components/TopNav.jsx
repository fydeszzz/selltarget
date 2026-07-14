// Web top navigation bar: brand wordmark, view links, and quick toggles
// (language, theme) plus a GitHub link. Replaces the mobile bottom nav —
// web users expect navigation and preferences along the top. Brand logo and
// nav icons reuse the project's own assets in /public (logo.png, stock.png,
// calculator.png, settings.png) so the web build matches the app's identity.
import { asset } from '../../lib/asset.js';

const GITHUB_URL = 'https://github.com/fydeszzz/selltarget';

// Inline icons keep the bar self-contained (no extra image requests).
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
const GithubIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);
// FAQ nav icon — no PNG asset exists for this yet, so it's inline (same
// treatment as the theme/GitHub icons above) rather than a new image file.
const FaqIcon = () => (
  <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.2a2.6 2.6 0 0 1 5 1c0 1.7-2.4 1.9-2.4 3.6" />
    <path d="M12 17.2h.01" />
  </svg>
);

export default function TopNav({ view, setView, lang, setLang, theme, setTheme, t }) {
  const links = [
    { id: 'calc', label: t.nav.calc, icon: 'stock.png' },
    { id: 'fees', label: t.nav.fees, icon: 'calculator.png' },
    { id: 'settings', label: t.nav.settings, icon: 'settings.png' },
    { id: 'faq', label: t.nav.faq, svg: <FaqIcon /> },
  ];

  return (
    <header className="topbar">
      <button className="brand" onClick={() => setView('calc')} aria-label="SellTarget - 股票賣點計算機">
        <img className="brand-logo" src={asset('logo.png')} alt="SellTarget - 股票賣點計算機" />
      </button>

      <nav className="nav" aria-label={t.navLabel}>
        {links.map((l) => (
          <button
            key={l.id}
            className={`nav-link ${view === l.id ? 'on' : ''}`}
            aria-current={view === l.id ? 'page' : undefined}
            onClick={() => setView(l.id)}
          >
            {l.svg ?? <img className="nav-ico" src={asset(l.icon)} alt="" aria-hidden />}
            {l.label}
          </button>
        ))}
      </nav>

      <div className="topbar-tools">
        <div className="seg" role="group" aria-label={t.languageLabel}>
          <button className={lang === 'zh' ? 'on' : ''} aria-pressed={lang === 'zh'} onClick={() => setLang('zh')}>中</button>
          <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
        </div>

        <button
          className="icon-link"
          aria-label={t.settingsTheme}
          title={theme === 'dark' ? t.themeLight : t.themeDark}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <a className="icon-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label={t.githubButton}>
          <GithubIcon />
        </a>
      </div>
    </header>
  );
}
