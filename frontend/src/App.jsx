import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import TrashMap from './pages/TrashMap';
import styles from './styles/App.module.css';

function LogoIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="9" width="12" height="12" rx="1.5" fill="#4caf50" />
      <rect x="4" y="6" width="16" height="3" rx="1" fill="#4caf50" />
      <rect x="10" y="4" width="4" height="2" rx="1" fill="#4caf50" />
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
            <LogoIcon />
            <span className={styles.brandName}>DropSpot</span>
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
