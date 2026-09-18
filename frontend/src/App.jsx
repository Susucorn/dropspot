import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import TrashMap from './TrashMap';
import WasteSchedule from './WasteSchedule';

function App() {
  return (
    <BrowserRouter>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2000,
          background: '#222',
          padding: '10px 16px',
          display: 'flex',
          gap: 16,
        }}
      >
        <NavLink to="/" end style={{ color: 'white' }}>
          지도
        </NavLink>
        <NavLink to="/schedule" style={{ color: 'white' }}>
          배출 규칙 안내
        </NavLink>
      </nav>
      <div style={{ paddingTop: 44 }}>
        <Routes>
          <Route path="/" element={<TrashMap />} />
          <Route path="/schedule" element={<WasteSchedule />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;