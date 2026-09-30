// 백엔드 서버 주소. 배포할 때는 VITE_API_BASE_URL 환경변수(예: https://dropspot-api.onrender.com)로 지정하고,
// 없으면 로컬 개발 서버를 사용
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
