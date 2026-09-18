import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import TrashMap from './pages/TrashMap';
import WasteSchedule from './pages/WasteSchedule';
import styles from './styles/App.module.css';

function App() {
  return (
    <BrowserRouter>
      <nav className={styles.sidebar}>
        <NavLink to="/" end className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>
          지도
        </NavLink>
        <NavLink to="/schedule" className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>
          배출 규칙 안내
        </NavLink>
      </nav>

      <div className={styles.content}>
        <Routes>
          <Route path="/" element={<TrashMap />} />
          <Route path="/schedule" element={<WasteSchedule />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;