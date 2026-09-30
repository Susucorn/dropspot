import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from '../styles/LocationPermissionPrompt.module.css';

// 지도 핀 + 쓰레기통 일러스트 (초록 원 배경)
function LocationIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="48" cy="48" r="46" fill="#e8f5e9" />
      <circle cx="48" cy="48" r="32" fill="#c8e6c9" className={styles.pulse} />
      {/* 쓰레기통 */}
      <rect x="36" y="50" width="24" height="22" rx="3" fill="#43a047" />
      <rect x="32" y="44" width="32" height="6" rx="2" fill="#43a047" />
      <rect x="44" y="40" width="8" height="4" rx="2" fill="#43a047" />
      <line x1="43" y1="55" x2="43" y2="67" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="53" y1="55" x2="53" y2="67" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* 위치 핀 */}
      <path
        d="M66 18c-7.2 0-13 5.6-13 12.6C53 40 66 50 66 50s13-10 13-19.4C79 23.6 73.2 18 66 18z"
        fill="#fff"
        stroke="#2e7d32"
        strokeWidth="2.5"
      />
      <circle cx="66" cy="30.5" r="4.5" fill="#2e7d32" />
    </svg>
  );
}

const BENEFITS = [
  { icon: '🗑️', text: '가까운 쓰레기통을 바로 보여드려요' },
  { icon: '📅', text: '우리 동네 배출 요일과 시간을 알려드려요' },
  { icon: '♻️', text: '지금 버릴 수 있는 품목을 한눈에 볼 수 있어요' },
];

// 앱을 처음 열 때 브라우저 위치 권한 창보다 먼저 보여주는 안내 화면.
// '내 위치 허용하기'를 누르면 그때 브라우저 권한 창이 뜨고, '지역을 직접 선택할게요'는 위치 없이 시작
function LocationPermissionPrompt({ onAllow, onSkip }) {
  const allowButtonRef = useRef(null);

  // 키보드 사용자를 위해 기본 버튼에 포커스, ESC는 '직접 선택'과 같음
  useEffect(() => {
    allowButtonRef.current?.focus();
    const handleKey = (e) => e.key === 'Escape' && onSkip();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  return createPortal(
    <div className={styles.backdrop}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-prompt-title"
        aria-describedby="location-prompt-desc"
      >
        <div className={styles.illustration}>
          <LocationIllustration />
        </div>

        <h2 id="location-prompt-title" className={styles.title}>
          내 주변 쓰레기통을 찾아드릴게요
        </h2>
        <p id="location-prompt-desc" className={styles.description}>
          위치 권한을 허용하면 지금 있는 곳을 기준으로 안내해 드려요.
        </p>

        <ul className={styles.benefits}>
          {BENEFITS.map((b) => (
            <li key={b.text} className={styles.benefit}>
              <span className={styles.benefitIcon} aria-hidden="true">
                {b.icon}
              </span>
              {b.text}
            </li>
          ))}
        </ul>

        <button ref={allowButtonRef} type="button" className={styles.allowButton} onClick={onAllow}>
          📍 내 위치 허용하기
        </button>
        <button type="button" className={styles.skipButton} onClick={onSkip}>
          지역을 직접 선택할게요
        </button>

        <p className={styles.privacy}>🔒 위치 정보는 지도 표시에만 쓰이고 저장하지 않아요.</p>
      </div>
    </div>,
    document.body
  );
}

export default LocationPermissionPrompt;
