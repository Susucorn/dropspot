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

// 앱에서 사용하는 데이터/API 출처 (푸터 '데이터 출처'에 표시)
const DATA_SOURCES = [
  { name: '전국휴지통표준데이터', provider: '공공데이터포털', url: 'https://www.data.go.kr/data/15129450/standard.do' },
  { name: '전국재활용센터표준데이터', provider: '공공데이터포털', url: 'https://www.data.go.kr/data/15021108/standard.do' },
  { name: '전국의류수거함표준데이터', provider: '공공데이터포털', url: 'https://www.data.go.kr/data/15139214/standard.do' },
  { name: '생활쓰레기배출정보 조회서비스', provider: '행정안전부', url: 'https://www.data.go.kr/data/15155080/openapi.do' },
  { name: '분리배출 정보조회 서비스', provider: '기후에너지환경부', url: 'https://www.data.go.kr/data/15156866/openapi.do' },
  { name: '부산광역시 남구_공공쓰레기통 현황', provider: '부산광역시 남구', url: 'https://www.data.go.kr/data/15087700/fileData.do' },
  { name: '대구광역시 동구_가로 쓰레기통 설치현황', provider: '대구광역시 동구', url: 'https://www.data.go.kr/data/15127640/fileData.do' },
  { name: '경기도 고양시_가로변 쓰레기통 현황', provider: '경기도 고양시', url: 'https://www.data.go.kr/data/15087918/fileData.do' },
  { name: '전남광주통합특별시 광산구_쓰레기통 현황', provider: '전남광주통합특별시 광산구', url: 'https://www.data.go.kr/data/15108027/fileData.do' },
  { name: '카카오맵 API (지도·주소/장소 검색)', provider: 'Kakao', url: 'https://apis.map.kakao.com/' },
];

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

        <footer className={styles.footer}>
          {/* 출처가 많아서 평소에는 한 줄로 두고, '데이터 출처'를 누르면 목록을 펼침 (지도 공간 확보) */}
          <details className={styles.sources}>
            <summary className={styles.footerLine}>
              <span>© 2026 DropSpot · 우리 동네 배출 규칙 &amp; 분리배출 안내</span>
              <span className={styles.sourcesToggle}>데이터 출처 ({DATA_SOURCES.length})</span>
            </summary>
            <ul className={styles.sourceList}>
              {DATA_SOURCES.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                    {s.name}
                  </a>
                  <span className={styles.sourceProvider}> · {s.provider}</span>
                </li>
              ))}
            </ul>
          </details>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
