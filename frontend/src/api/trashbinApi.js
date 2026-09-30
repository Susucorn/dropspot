import { BASE_URL } from './config';

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

// 구청별 공공쓰레기통 목록 (좌표 없음)
// [{ source, sido, sgg, records: [{ 위치명, 도로명주소, 지번주소, 종류, 설치대수 }] }]
export function fetchDistrictTrashbins() {
  return fetch(`${BASE_URL}/api/district-trashbins`).then((res) => res.json());
}

function boundsQuery({ swLat, swLng, neLat, neLng }) {
  return `swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`;
}

// 지도 화면 영역 안의 휴지통 (지도를 드래그해서 옮겼을 때 사용)
export function fetchTrashbinsInBounds(bounds) {
  return fetch(`${BASE_URL}/api/trashbins/in-bounds?${boundsQuery(bounds)}`).then((res) => res.json());
}

// 재활용센터·의류수거함 같은 시설 데이터 조회 (휴지통과 같은 위도/경도/시도명/시군구명 필드로 내려옴)
// path: '/api/recycling-centers' | '/api/clothing-bins'
// scope: { type: 'sido', sido } | { type: 'radius', lat, lng, radiusKm } | { type: 'bounds', swLat, swLng, neLat, neLng }
export function fetchFacilities(path, scope) {
  let url;
  if (scope.type === 'sido') url = `${path}?sido=${encodeURIComponent(scope.sido)}`;
  else if (scope.type === 'radius') url = `${path}/nearby?lat=${scope.lat}&lng=${scope.lng}&radius=${scope.radiusKm}`;
  else url = `${path}/in-bounds?${boundsQuery(scope)}`;
  return fetch(`${BASE_URL}${url}`).then((res) => res.json());
}