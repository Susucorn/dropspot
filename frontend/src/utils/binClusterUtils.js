// 이 줌 레벨(카카오 지도 level, 숫자가 클수록 더 축소된 상태) 이상에서는
// 개별 아이콘 대신 클러스터 아이콘을 보여준다
export const CLUSTER_ZOOM_LEVEL = 6;

// 줌 레벨이 높을수록(더 축소될수록) 격자 한 칸이 커지도록 지수적으로 스케일링
function getGridSizeDeg(level) {
  return 0.01 * 2 ** (level - CLUSTER_ZOOM_LEVEL);
}

// 위/경도 격자로 휴지통들을 묶어 { lat, lng, count, bins } 클러스터 목록을 만듦
export function clusterBins(bins, level) {
  const gridSize = getGridSizeDeg(level);
  const cells = new Map();

  bins.forEach((bin) => {
    const lat = parseFloat(bin.위도);
    const lng = parseFloat(bin.경도);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const key = `${Math.floor(lat / gridSize)}_${Math.floor(lng / gridSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(bin);
  });

  return [...cells.values()].map((group) => {
    const lat = group.reduce((sum, b) => sum + parseFloat(b.위도), 0) / group.length;
    const lng = group.reduce((sum, b) => sum + parseFloat(b.경도), 0) / group.length;
    return { lat, lng, count: group.length, bins: group };
  });
}
