import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import DocumentList from '@/pages/DocumentList';
import Practice from '@/pages/Practice';
import Result from '@/pages/Result';
import History from '@/pages/History';
import { useLocaleStore, useT } from '@/locales';

type Theme = 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggle };
}

function NavHeader({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const location = useLocation();
  const isPracticing = location.pathname.startsWith('/practice');
  const t = useT();
  const { locale, toggleLocale } = useLocaleStore();

  return (
    <nav className="nav-header">
      <Link to="/" className="nav-logo">
        <span className="nav-logo-main">{t('nav.logo.main')}</span>
        <span className="nav-logo-sub">{t('nav.logo.sub')}</span>
      </Link>
      <div className="nav-right">
        {!isPracticing && (
          <div className="nav-links">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              {t('nav.documents')}
            </Link>
            <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
              {t('nav.history')}
            </Link>
          </div>
        )}
        <button className="locale-toggle" onClick={toggleLocale}>
          {locale === 'zh' ? 'EN' : '中'}
        </button>
        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <BrowserRouter>
      <div className="app">
        <NavHeader theme={theme} onToggleTheme={toggle} />
        <Routes>
          <Route path="/" element={<DocumentList />} />
          <Route path="/practice/:id" element={<Practice />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
