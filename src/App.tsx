import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import DocumentList from '@/pages/DocumentList';
import Practice from '@/pages/Practice';
import Result from '@/pages/Result';

function NavHeader() {
  const location = useLocation();
  const isPracticing = location.pathname.startsWith('/practice');

  return (
    <nav className="nav-header">
      <Link to="/" className="nav-logo">
        <span className="nav-logo-main">type</span>
        <span className="nav-logo-sub">practice</span>
      </Link>
      {!isPracticing && (
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            documents
          </Link>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <NavHeader />
        <Routes>
          <Route path="/" element={<DocumentList />} />
          <Route path="/practice/:id" element={<Practice />} />
          <Route path="/result/:id" element={<Result />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
