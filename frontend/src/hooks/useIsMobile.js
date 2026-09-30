import { useEffect, useState } from 'react';

// 이 폭 이하면 모바일 레이아웃(지도 전체 화면 + 플로팅 버튼 + 하단 슬라이드 패널)을 사용
export const MOBILE_MAX_WIDTH = 768;
const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

// 화면 폭이 모바일 기준 이하인지. 창 크기를 바꾸면(또는 기기를 돌리면) 바로 다시 계산됨
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const handleChange = (e) => setIsMobile(e.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
