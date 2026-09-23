const BASE_URL = 'http://localhost:4000';

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || '요청에 실패했어요.');
  }
  return data;
}

// 배출품목 정보 조회: 품목명으로 배출방법 검색
export function fetchWasteItems(itemNm) {
  return getJson(`${BASE_URL}/api/waste-items?itemNm=${encodeURIComponent(itemNm)}`);
}

// 분리배출 장소정보 조회: 동 이름으로 배출 장소 검색
export function fetchWasteSpots(addr) {
  return getJson(`${BASE_URL}/api/waste-spots?addr=${encodeURIComponent(addr)}`);
}
