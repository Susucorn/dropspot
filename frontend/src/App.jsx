import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import TrashMap from './pages/TrashMap';
import styles from './styles/App.module.css';

// 흰색 쓰레기통 위에 새싹 잎을 얹은 로고 (초록 배지 안에 표시)
function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="11" width="12" height="10" rx="1.5" fill="#fff" />
      <rect x="4.5" y="8.5" width="15" height="2.5" rx="1" fill="#fff" />
      <path d="M12 8.5 C12 5.5 13.8 3.5 17 3.5 C17 6.5 15.2 8.5 12 8.5 Z" fill="#c5e8b7" />
      <path d="M12 8.5 C12 6.3 10.7 4.8 8.2 4.8 C8.2 7 9.5 8.5 12 8.5 Z" fill="#e3f4da" />
      <line x1="10" y1="13.5" x2="10" y2="18.5" stroke="#43a047" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <line x1="14" y1="13.5" x2="14" y2="18.5" stroke="#43a047" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function HeaderSearchIcon() {
  return (
    <svg
      className={styles.headerSearchIcon}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className={styles.appShell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.logoBadge}>
              <LogoIcon />
            </span>
            <div className={styles.brandText}>
              <span className={styles.brandName}>
                Drop<span className={styles.brandAccent}>Spot</span>
              </span>
              <span className={styles.brandTagline}>내 주변 쓰레기통 찾고, 올바르게 분리배출해요</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.headerSearch}>
              <HeaderSearchIcon />
              <input type="text" className={styles.headerSearchInput} placeholder="검색" />
            </div>
            <button type="button" className={styles.userMenuButton} aria-label="사용자 메뉴">
              <UserIcon />
            </button>
          </div>
        </header>

        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? styles.navTabActive : styles.navTab)}>
            지도
          </NavLink>
        </nav>

        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<TrashMap />} />
          </Routes>
        </main>

        <footer className={styles.footer}>© 2026 DropSpot · 우리 동네 배출 규칙 &amp; 분리배출 안내</footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
