// 지도 마커 종류: 'general'(일반), 'recycle'(재활용), 'both'(일반+재활용 겸용), 'center'(재활용센터 건물)
// 휴지통 API의 휴지통종류 값: '일반쓰레기', '재활용쓰레기', '일반쓰레기+재활용쓰'(원본에서 잘림), '기타'
// 재활용센터 API 항목은 시설구분이 '재활용'으로 들어오며, 쓰레기통이 아니라 건물이므로 따로 분류
export function getBinKind(bin) {
  if (bin.시설구분 === '재활용') return 'center';
  const type = bin.휴지통종류 || '';
  // 남구 공공쓰레기통 데이터는 종류가 '분리수거함'/'분리수거대'로 들어옴
  const hasRecycle = type.includes('재활용') || type.includes('분리수거');
  if (hasRecycle && type.includes('일반')) return 'both';
  if (hasRecycle) return 'recycle';
  return 'general';
}

// 휴지통종류 표시용: "일반쓰레기+재활용쓰"(원본 데이터에서 잘린 값) → "일반쓰레기, 재활용"
export function formatBinType(type) {
  return (type || '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part === '재활용쓰' ? '재활용' : part))
    .join(', ');
}

export const BIN_KIND_LABELS = {
  general: '일반 쓰레기통',
  recycle: '재활용 쓰레기통',
  both: '일반+재활용 쓰레기통',
  center: '재활용센터',
};

// 부산 남구 공공쓰레기통 원본({ 연번, 위치, 설치대수, 종류 })과 장소 검색으로 찾은 좌표를
// 기존 휴지통 데이터와 같은 필드 모양으로 합침
export function toNamguBin(record, coords) {
  return {
    출처: '부산광역시 남구 공공쓰레기통 현황',
    설치장소명: record.위치,
    시도명: '부산광역시',
    시군구명: '남구',
    소재지도로명주소: coords.address,
    위도: String(coords.lat),
    경도: String(coords.lng),
    휴지통종류: record.종류 || '',
    설치대수: record.설치대수,
    대략적위치: true,
  };
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 휴지통이 지금 불러온 범위 안에 있는지 (백엔드 조회 조건과 같은 기준)
// scope: { type: 'sido', sido } | { type: 'radius', lat, lng, radiusKm } | { type: 'bounds', swLat, swLng, neLat, neLng }
export function isInScope(bin, scope) {
  if (!scope) return false;
  const lat = parseFloat(bin.위도);
  const lng = parseFloat(bin.경도);
  if (scope.type === 'sido') return bin.시도명 === scope.sido;
  if (scope.type === 'radius') return distanceKm(scope.lat, scope.lng, lat, lng) <= scope.radiusKm;
  if (scope.type === 'bounds') {
    return lat >= scope.swLat && lat <= scope.neLat && lng >= scope.swLng && lng <= scope.neLng;
  }
  return false;
}

export function filterValidBins(bins) {
  return bins.filter((item) => {
    const lat = parseFloat(item.위도);
    const lng = parseFloat(item.경도);
    return !isNaN(lat) && !isNaN(lng);
  });
}