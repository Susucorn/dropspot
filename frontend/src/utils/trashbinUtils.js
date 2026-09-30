// 지도 마커 종류: 'general'(일반), 'recycle'(재활용), 'both'(일반+재활용 겸용), 'center'(재활용센터 건물)
// 휴지통 API의 휴지통종류 값: '일반쓰레기', '재활용쓰레기', '일반쓰레기+재활용쓰'(원본에서 잘림), '기타'
// 재활용센터 API 항목은 시설구분이 '재활용'으로 들어오며, 쓰레기통이 아니라 건물이므로 따로 분류
export function getBinKind(bin) {
  if (bin.시설구분 === '재활용') return 'center';
  const type = bin.휴지통종류 || '';
  const hasRecycle = type.includes('재활용');
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

export function filterValidBins(bins) {
  return bins.filter((item) => {
    const lat = parseFloat(item.위도);
    const lng = parseFloat(item.경도);
    return !isNaN(lat) && !isNaN(lng);
  });
}