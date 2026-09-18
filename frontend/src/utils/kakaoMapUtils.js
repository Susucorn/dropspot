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