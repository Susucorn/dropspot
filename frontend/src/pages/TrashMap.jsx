import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';
import styles from '../styles/TrashMap.module.css';
import scheduleStyles from '../styles/WasteSchedule.module.css';
import { fetchRegions, fetchTrashbinsByRegion, fetchNearbyTrashbins } from '../api/trashbinApi';
import { fetchSchedule } from '../api/wasteScheduleApi';
import { filterValidBins } from '../utils/trashbinUtils';
import { fitBoundsToBins, centerMapOnLocation, zoomIntoCluster } from '../utils/kakaoMapUtils';
import { getCurrentLocation } from '../utils/geolocation';
import { isValid, buildWeeklyRows, dedupeScheduleResults, formatItemList } from '../utils/wasteScheduleUtils';
import { CLUSTER_ZOOM_LEVEL, clusterBins } from '../utils/binClusterUtils';

const INITIAL_MAP_LEVEL = 13;

// 기본은 뚜껑 닫힌 회색 쓰레기통, 클릭된 아이콘만 뚜껑이 살짝 열리며 초록색으로 강조됨
function TrashBinIcon({ open }) {
  const color = open ? '#2e7d32' : '#4a4a4a';
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="9" width="12" height="12" rx="1.5" fill={color} />
      <line x1="9.5" y1="12" x2="9.5" y2="18" stroke="#fff" strokeWidth="1" opacity="0.6" />
      <line x1="14.5" y1="12" x2="14.5" y2="18" stroke="#fff" strokeWidth="1" opacity="0.6" />
      <g transform={open ? 'rotate(-25 5 7.5)' : undefined}>
        <rect x="4" y="6" width="16" height="3" rx="1" fill={color} />
        <rect x="10" y="4" width="4" height="2" rx="1" fill={color} />
      </g>
    </svg>
  );
}

function TrashMap() {
  const [loading, error] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
  });

  const mapRef = useRef(null);
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('부산광역시');
  const [bins, setBins] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedBin, setSelectedBin] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_MAP_LEVEL);

  const [scheduleResults, setScheduleResults] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // 레벨 숫자가 클수록 더 축소된 상태 → 많이 축소했을 때만 클러스터로 묶어서 표시
  const isClustered = zoomLevel >= CLUSTER_ZOOM_LEVEL;
  const clusters = useMemo(
    () => (isClustered ? clusterBins(bins, zoomLevel) : []),
    [bins, zoomLevel, isClustered]
  );

  useEffect(() => {
    fetchRegions().then(setRegions).catch(console.error);
  }, []);

  useEffect(() => {
    if (myLocation) return;
    fetchTrashbinsByRegion(selectedRegion)
      .then((data) => setBins(filterValidBins(data)))
      .catch(console.error);
  }, [selectedRegion, myLocation]);

  useEffect(() => {
    if (!mapRef.current || loading) return;

    if (myLocation) {
      centerMapOnLocation(mapRef.current, myLocation, 4);
    } else if (bins.length > 0) {
      fitBoundsToBins(mapRef.current, bins);
    }
  }, [bins, myLocation, loading]);

  // 휴지통 아이콘을 클릭하면 그 지역(시도/시군구)의 배출 규칙을 오른쪽 패널에 조회
  useEffect(() => {
    if (!selectedBin) {
      setScheduleResults([]);
      setScheduleError('');
      return;
    }
    setScheduleLoading(true);
    setScheduleError('');
    fetchSchedule(selectedBin.시도명, selectedBin.시군구명)
      .then((data) => {
        setScheduleResults(dedupeScheduleResults(Array.isArray(data) ? data : []));
        setScheduleLoading(false);
      })
      .catch(() => {
        setScheduleError('배출 규칙을 불러오지 못했어요.');
        setScheduleLoading(false);
      });
  }, [selectedBin]);

  function handleClusterClick(cluster) {
    if (!mapRef.current) return;
    zoomIntoCluster(mapRef.current, cluster.lat, cluster.lng, CLUSTER_ZOOM_LEVEL - 1);
  }

  const findMyLocation = () => {
    setLocationError('');
    setLocating(true);
    getCurrentLocation()
      .then((location) => {
        setMyLocation(location);
        setLocating(false);
        return fetchNearbyTrashbins(location[0], location[1], 1);
      })
      .then(setBins)
      .catch((err) => {
        setLocationError(`위치 정보를 가져오지 못했어요 (${err.message})`);
        setLocating(false);
      });
  };

  if (loading) return <div>지도를 불러오는 중...</div>;
  if (error) return <div>지도를 불러오지 못했어요. 카카오 앱 키/도메인 등록을 확인해주세요.</div>;

  return (
    <div className={styles.mapWrap}>
      <div className={styles.controlPanel}>
        <select
          value={selectedRegion}
          onChange={(e) => {
            setMyLocation(null);
            setSelectedRegion(e.target.value);
          }}
        >
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button className={styles.button} onClick={findMyLocation} disabled={locating}>
          {locating ? '위치 찾는 중...' : '내 위치 주변 보기'}
        </button>
        {myLocation && (
          <button className={styles.button} onClick={() => setMyLocation(null)}>
            지역별로 보기
          </button>
        )}
        <div>휴지통 {bins.length}개</div>
        {locationError && <div className={styles.errorText}>{locationError}</div>}
      </div>

      <Map
        center={{ lat: 36.5, lng: 127.8 }}
        level={INITIAL_MAP_LEVEL}
        style={{ width: '100%', height: '100%' }}
        onCreate={(map) => {
          mapRef.current = map;
          setZoomLevel(map.getLevel());
        }}
        onZoomChanged={(map) => setZoomLevel(map.getLevel())}
      >
        {myLocation && (
          <CustomOverlayMap position={{ lat: myLocation[0], lng: myLocation[1] }}>
            <div className={styles.myLocationDot} />
          </CustomOverlayMap>
        )}

        {isClustered
          ? clusters.map((cluster, idx) => (
              <CustomOverlayMap key={idx} position={{ lat: cluster.lat, lng: cluster.lng }} clickable>
                <div className={styles.clusterIcon} onClick={() => handleClusterClick(cluster)}>
                  <span className={styles.clusterBinBg}>🗑️</span>
                  <span className={styles.clusterCount}>{cluster.count}</span>
                </div>
              </CustomOverlayMap>
            ))
          : bins.map((bin, idx) => (
              <CustomOverlayMap
                key={idx}
                position={{ lat: parseFloat(bin.위도), lng: parseFloat(bin.경도) }}
                clickable
              >
                <div className={styles.binIcon} onClick={() => setSelectedBin(bin)}>
                  <TrashBinIcon open={selectedBin === bin} />
                </div>
              </CustomOverlayMap>
            ))}
      </Map>

      {selectedBin && (
        <div className={styles.sidePanel}>
          <button className={styles.closeButton} onClick={() => setSelectedBin(null)} aria-label="닫기">
            ×
          </button>

          <h3 className={styles.panelTitle}>{selectedBin.설치장소명 || '휴지통'}</h3>
          <p className={styles.panelMeta}>{selectedBin.소재지도로명주소 || selectedBin.소재지지번주소}</p>
          <p className={styles.panelMeta}>종류: {selectedBin.휴지통종류}</p>
          {selectedBin.distance !== undefined && (
            <p className={styles.panelMeta}>거리: 약 {(selectedBin.distance * 1000).toFixed(0)}m</p>
          )}

          <hr className={styles.panelDivider} />

          <h4 className={styles.panelSubtitle}>
            {selectedBin.시도명} {selectedBin.시군구명} 배출 규칙 안내
          </h4>

          {scheduleLoading && <p>불러오는 중...</p>}
          {scheduleError && <p className={scheduleStyles.errorText}>{scheduleError}</p>}
          {!scheduleLoading && !scheduleError && scheduleResults.length === 0 && (
            <p>해당 지역 배출 규칙 정보가 없어요.</p>
          )}

          {scheduleResults.map((r, idx) => (
            <div key={idx} className={scheduleStyles.card}>
              <p className={scheduleStyles.cardTitle}>
                {scheduleResults.length > 1 ? `${idx + 1}. ` : ''}
                {isValid(r.MNG_ZONE_TRGT_RGN_NM) ? r.MNG_ZONE_TRGT_RGN_NM : `${r.CTPV_NM} ${r.SGG_NM}`}
              </p>

              <table className={scheduleStyles.table}>
                <thead>
                  <tr>
                    <th className={scheduleStyles.dayHeader}>요일</th>
                    <th>배출 시간 / 품목</th>
                  </tr>
                </thead>
                <tbody>
                  {buildWeeklyRows(r).map((row) => (
                    <tr key={row.day}>
                      <td className={scheduleStyles.dayCell}>{row.day}</td>
                      <td>
                        {row.items.length > 0 ? (
                          row.items.map((item, i) => (
                            <div key={i} className={scheduleStyles.itemChip}>
                              {item}
                            </div>
                          ))
                        ) : (
                          <span className={scheduleStyles.noItem}>배출 없음</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isValid(r.TMPRY_BULK_WASTE_EMSN_MTHD) && (
                <p className={scheduleStyles.metaText}>
                  대형폐기물: {r.TMPRY_BULK_WASTE_EMSN_MTHD}
                  {isValid(r.TMPRY_BULK_WASTE_EMSN_PLC) &&
                    ` (배출 장소: ${formatItemList(r.TMPRY_BULK_WASTE_EMSN_PLC)})`}
                </p>
              )}
              {r.UNCLLT_DAY && (
                <p className={scheduleStyles.metaText}>미수거일: {formatItemList(r.UNCLLT_DAY)}</p>
              )}
              {r.MNG_DEPT_NM && (
                <p className={scheduleStyles.metaText}>
                  문의: {r.MNG_DEPT_NM} {r.MNG_DEPT_TELNO}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrashMap;
