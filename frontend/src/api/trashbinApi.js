const BASE_URL = 'http://localhost:4000';

export function fetchRegions() {
  return fetch(`${BASE_URL}/api/regions`).then((res) => res.json());
}

export function fetchTrashbinsByRegion(sido) {
  return fetch(`${BASE_URL}/api/trashbins?sido=${encodeURIComponent(sido)}`).then((res) => res.json());
}

export function fetchNearbyTrashbins(lat, lng, radius = 1) {
  return fetch(`${BASE_URL}/api/trashbins/nearby?lat=${lat}&lng=${lng}&radius=${radius}`).then((res) =>
    res.json()
  );
}

// 부산광역시 남구 공공쓰레기통 원본 목록 (좌표 없음: { 연번, 위치, 설치대수, 종류 })
export function fetchNamguTrashbins() {
  return fetch(`${BASE_URL}/api/namgu-trashbins`).then((res) => res.json());
}

function boundsQuery({ swLat, swLng, neLat, neLng }) {
  return `swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`;
}

// 지도 화면 영역 안의 휴지통/재활용센터 (지도를 드래그해서 옮겼을 때 사용)
export function fetchTrashbinsInBounds(bounds) {
  return fetch(`${BASE_URL}/api/trashbins/in-bounds?${boundsQuery(bounds)}`).then((res) => res.json());
}

export function fetchRecyclingCentersInBounds(bounds) {
  return fetch(`${BASE_URL}/api/recycling-centers/in-bounds?${boundsQuery(bounds)}`).then((res) => res.json());
}

// 재활용센터(전국재활용센터표준데이터): 휴지통과 같은 위도/경도/시도명/시군구명 필드로 내려옴
export function fetchRecyclingCentersByRegion(sido) {
  return fetch(`${BASE_URL}/api/recycling-centers?sido=${encodeURIComponent(sido)}`).then((res) => res.json());
}

export function fetchNearbyRecyclingCenters(lat, lng, radius = 5) {
  return fetch(`${BASE_URL}/api/recycling-centers/nearby?lat=${lat}&lng=${lng}&radius=${radius}`).then((res) =>
    res.json()
  );
}