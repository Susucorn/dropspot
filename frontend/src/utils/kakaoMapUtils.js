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
  const words = placeName.trim().split(/\s+/);
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