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