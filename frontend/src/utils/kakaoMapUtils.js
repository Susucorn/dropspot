export function fitBoundsToBins(map, bins) {
  const kakao = window.kakao;
  const bounds = new kakao.maps.LatLngBounds();
  bins.forEach((b) => {
    bounds.extend(new kakao.maps.LatLng(parseFloat(b.위도), parseFloat(b.경도)));
  });
  map.setBounds(bounds);
}

export function centerMapOnLocation(map, location, level = 4) {
  const kakao = window.kakao;
  map.setCenter(new kakao.maps.LatLng(location[0], location[1]));
  map.setLevel(level);
}

// 클러스터 아이콘을 클릭했을 때 그 지점으로 확대해 개별 아이콘이 보이게 함
export function zoomIntoCluster(map, lat, lng, level) {
  const kakao = window.kakao;
  map.setCenter(new kakao.maps.LatLng(lat, lng));
  map.setLevel(level);
}

// 좌표가 속한 시/도 이름(예: "부산광역시")을 반환 (카카오맵 services 라이브러리 필요)
export function getSidoFromCoords(lat, lng) {
  return new Promise((resolve, reject) => {
    const kakao = window.kakao;
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2RegionCode(lng, lat, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result[0]?.region_1depth_name) {
        resolve(result[0].region_1depth_name);
      } else {
        reject(new Error('시/도를 찾을 수 없어요.'));
      }
    });
  });
}

function keywordSearch(keyword) {
  return new Promise((resolve) => {
    const kakao = window.kakao;
    const places = new kakao.maps.services.Places();
    places.keywordSearch(keyword, (result, status) => {
      resolve(status === kakao.maps.services.Status.OK ? result : []);
    });
  });
}

// 장소 이름(예: "용호동 1-4 동생말 전망대")으로 시도해 볼 검색어 목록을 정확한 순서대로 만듦:
// 원래 이름 → 번지/'산' 같은 주소 조각을 뺀 이름 → 동 이름까지 뺀 이름 → 끝 단어를 하나씩 줄인 이름
function buildPlaceKeywords(placeName) {
  // "화전역앞-버스정류장-하행"처럼 하이픈으로 이어 쓴 이름은 띄어쓰기로 나눠서 검색
  const words = placeName.trim().replace(/-/g, ' ').split(/\s+/);
  const cleaned = words.filter((w) => w !== '산' && !/^\d/.test(w));
  const withoutDong = cleaned.filter((w) => !/[동읍면리]$/.test(w));
  const candidates = [words.join(' '), cleaned.join(' '), withoutDong.join(' ')];
  for (let n = cleaned.length - 1; n >= 1; n -= 1) {
    candidates.push(cleaned.slice(0, n).join(' '));
  }
  return [...new Set(candidates.filter(Boolean))];
}

// 장소 이름(예: "이기대 큰고개쉼터 팔각정")을 좌표로 변환 (카카오 장소 검색, services 라이브러리 필요).
// "{지역} {검색어}"로 buildPlaceKeywords 순서대로 찾아서, 결과 주소가 지역(예: "부산 남구")에 속한
// 첫 결과를 사용. 못 찾으면 null
export async function findPlaceCoords(placeName, region) {
  for (const keyword of buildPlaceKeywords(placeName)) {
    const results = await keywordSearch(`${region} ${keyword}`);
    const match = results.find((r) => (r.address_name || '').startsWith(region));
    if (match) {
      return {
        lat: parseFloat(match.y),
        lng: parseFloat(match.x),
        address: match.road_address_name || match.address_name,
        placeName: match.place_name,
      };
    }
  }
  return null;
}

// 카카오 검색 결과 주소는 시도를 줄여서 씀 (예: "부산광역시" → "부산", "충청남도" → "충남")
const SIDO_SHORT_NAMES = {
  충청북도: '충북',
  충청남도: '충남',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  전북특별자치도: '전북',
  강원특별자치도: '강원',
  제주특별자치도: '제주',
  세종특별자치시: '세종',
};

function shortSidoName(sido) {
  return SIDO_SHORT_NAMES[sido] || sido.slice(0, 2);
}

// 두 좌표 사이 거리(km)가 가까운지 대략 비교 (위도 1도 ≈ 111km)
function isNear(a, b, km) {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat ** 2 + dLng ** 2) <= km;
}

// 구청별 공공쓰레기통 항목의 좌표를 찾음.
// 1) 도로명/지번 주소로 주소 검색. 같은 주소에 정류장이 여러 개인 경우(예: 동대구역지하도1/2 버스정류장)
//    한 점에 겹치지 않도록, 위치명으로 장소 검색한 결과가 주소 좌표 1km 안이면 그 좌표를 사용
// 2) 주소가 없거나 못 찾으면 위치명으로만 장소 검색 (대략적인 위치)
// 반환: { coords: { lat, lng, address }, approximate } 또는 못 찾으면 null
export async function findDistrictBinCoords(record, group) {
  // 데이터에 좌표가 들어 있으면(예: 고양시) 검색 없이 그대로 사용
  const lat = parseFloat(record.위도);
  const lng = parseFloat(record.경도);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    return { coords: { lat, lng, address: record.도로명주소 || record.지번주소 }, approximate: false };
  }

  const region = `${shortSidoName(group.sido)} ${group.sgg}`;
  const place = record.위치명 ? await findPlaceCoords(record.위치명, region) : null;

  // 주소에 시도/구 이름이 빠져 있으면 붙여서 검색 (예: "동구 ○○로 1" → "대구광역시 동구 ○○로 1").
  // 분할/합병으로 없어진 번지(예: "화전동 545-2")는 부번을 뗀 본번 주소("화전동 545")로도 한 번 더 찾음
  const addressCandidates = [];
  for (const address of [record.도로명주소, record.지번주소].filter(Boolean)) {
    const full = address.startsWith(shortSidoName(group.sido))
      ? address
      : `${group.sido} ${address.startsWith(group.sgg) ? '' : `${group.sgg} `}${address}`;
    addressCandidates.push({ full, address });
    const mainLot = full.replace(/(\d+)-\d+$/, '$1');
    if (mainLot !== full) addressCandidates.push({ full: mainLot, address });
  }

  for (const { full, address } of addressCandidates) {
    try {
      const [lat, lng] = await geocodeAddress(full);
      const byAddress = { lat, lng, address };
      const coords = place && isNear(place, byAddress, 1) ? { lat: place.lat, lng: place.lng, address } : byAddress;
      return { coords, approximate: false };
    } catch {
      // 다음 주소나 장소 검색으로 넘어감
    }
  }
  return place ? { coords: place, approximate: true } : null;
}

// 주소 문자열(예: "부산광역시 북구 화명동")을 좌표로 변환 (카카오맵 services 라이브러리 필요)
export function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    const kakao = window.kakao;
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        resolve([parseFloat(result[0].y), parseFloat(result[0].x)]);
      } else {
        reject(new Error('주소를 찾을 수 없어요.'));
      }
    });
  });
}