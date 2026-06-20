// Persistent bottom navigation: Sell-Target · Fee Discount · Settings.
// Icons live in /public (stock.png, calculator.png, settings.png).
import { asset } from '../lib/asset.js';

const TABS = [
  { id: 'calc',     icon: 'stock.png' },
  { id: 'fees',     icon: 'calculator.png' },
  { id: 'settings', icon: 'settings.png' },
];

export default function BottomNav({ view, setView, t }) {
  return (
    <nav className="bottom-nav" role="tablist" aria-label={t.marketLabel}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={view === tab.id}
          className={`nav-item ${view === tab.id ? 'on' : ''}`}
          onClick={() => setView(tab.id)}
        >
          <img className="nav-icon" src={asset(tab.icon)} alt="" aria-hidden />
          <span className="nav-label">{t.nav[tab.id]}</span>
        </button>
      ))}
    </nav>
  );
}
