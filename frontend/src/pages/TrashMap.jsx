import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';
import styles from '../styles/TrashMap.module.css';
import scheduleStyles from '../styles/WasteSchedule.module.css';
import ScheduleResultCard from '../components/ScheduleResultCard';
import { useWasteItemSearch, WasteItemSearchBox, WasteItemResults } from '../components/WasteItemSearch';
import { fetchRegions, fetchTrashbinsByRegion, fetchNearbyTrashbins } from '../api/trashbinApi';
import { fetchSchedule, fetchRegions as fetchScheduleRegions } from '../api/wasteScheduleApi';
import { filterValidBins } from '../utils/trashbinUtils';
import { fitBoundsToBins, centerMapOnLocation, zoomIntoCluster, geocodeAddress } from '../utils/kakaoMapUtils';
import { getCurrentLocation } from '../utils/geolocation';
import { isValid, dedupeScheduleResults, splitZoneNames, normalizeZoneName } from '../utils/wasteScheduleUtils';
import { CLUSTER_ZOOM_LEVEL, clusterBins } from '../utils/binClusterUtils';

const INITIAL_MAP_LEVEL = 13;

// 기본은 뚜껑 닫힌 회색 쓰레기통, 클릭된 아이콘만 뚜껑이 살짝 열리며 초록색으로 강조됨
function TrashBinIcon({ open }) {
  const color = open ? '#2e7d32' : '#4a4a4a';
  const fillTransition = { transition: 'fill 0.25s ease' };
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="9" width="12" height="12" rx="1.5" fill={color} style={fillTransition} />
      <line x1="9.5" y1="12" x2="9.5" y2="18" stroke="#fff" strokeWidth="1" opacity="0.6" />
      <line x1="14.5" y1="12" x2="14.5" y2="18" stroke="#fff" strokeWidth="1" opacity="0.6" />
      <g
        transform={open ? 'rotate(-25 5 7.5)' : 'rotate(0 5 7.5)'}
        style={{ transition: 'transform 0.25s ease' }}
      >
        <rect x="4" y="6" width="16" height="3" rx="1" fill={color} style={fillTransition} />
        <rect x="10" y="4" width="4" height="2" rx="1" fill={color} style={fillTransition} />
      </g>
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function RegionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <polygon points="3 6 9 4 15 6 21 4 21 18 15 20 9 18 3 20" />
      <line x1="9" y1="4" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="20" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 패널이 펼쳐져 있으면 접기(‹), 접혀 있으면 펼치기(›) 방향을 가리킴
function ChevronIcon({ collapsed }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.3s ease' }}
    >
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}

function TrashMap() {
  const [loading, error] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
    libraries: ['services'],
  });

  const mapRef = useRef(null);
  const [regions, setRegions] = useState([]);
  const [selectedSido, setSelectedSido] = useState('부산광역시');
  const [bins, setBins] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedBin, setSelectedBin] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_MAP_LEVEL);

  const [scheduleResults, setScheduleResults] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // 지역 검색으로 지도 중심 이동 + 배출 규칙 조회 (시/도, 시/군/구, 동/읍/면 자동완성)
  const [scheduleRegionMap, setScheduleRegionMap] = useState({});
  const [regionQuery, setRegionQuery] = useState('');
  const [showRegionSuggestions, setShowRegionSuggestions] = useState(false);
  const [pickedRegion, setPickedRegion] = useState(null);
  const [geocodeError, setGeocodeError] = useState('');

  // 오른쪽 패널 상단 탭: '배출 규칙 안내'(지역 검색) / '배출품목 찾기'(품목 검색)
  const [activeTab, setActiveTab] = useState('schedule');
  const itemSearch = useWasteItemSearch();
  const [panelCollapsed, setPanelCollapsed] = useState(false);

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
    fetchScheduleRegions().then(setScheduleRegionMap).catch(console.error);
  }, []);

  useEffect(() => {
    if (myLocation) return;
    fetchTrashbinsByRegion(selectedSido)
      .then((data) => setBins(filterValidBins(data)))
      .catch(console.error);
  }, [selectedSido, myLocation]);

  useEffect(() => {
    if (!mapRef.current || loading) return;
    // 지역 검색으로 직접 중심/줌을 맞춘 경우에는 자동으로 다시 맞추지 않음
    if (pickedRegion) return;

    if (myLocation) {
      centerMapOnLocation(mapRef.current, myLocation, 4);
    } else if (bins.length > 0) {
      fitBoundsToBins(mapRef.current, bins);
    }
  }, [bins, myLocation, loading, pickedRegion]);

  // 휴지통 아이콘을 클릭하거나 지역을 검색해서 선택하면, 그 지역(시도/시군구, 필요시 동)의
  // 배출 규칙을 오른쪽 패널에 조회
  useEffect(() => {
    const ctpv = selectedBin ? selectedBin.시도명 : pickedRegion ? pickedRegion.ctpv : null;
    const sgg = selectedBin ? selectedBin.시군구명 : pickedRegion ? pickedRegion.sgg : null;
    const dong = selectedBin ? null : pickedRegion ? pickedRegion.dong || null : null;

    if (!ctpv || !sgg) {
      setScheduleResults([]);
      setScheduleError('');
      return;
    }
    setScheduleLoading(true);
    setScheduleError('');
    fetchSchedule(ctpv, sgg)
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        const filtered = dong
          ? all.filter(
              (r) =>
                isValid(r.MNG_ZONE_TRGT_RGN_NM) &&
                splitZoneNames(r.MNG_ZONE_TRGT_RGN_NM).some((z) => normalizeZoneName(z) === dong)
            )
          : all;
        setScheduleResults(dedupeScheduleResults(filtered));
        setScheduleLoading(false);
      })
      .catch(() => {
        setScheduleError('배출 규칙을 불러오지 못했어요.');
        setScheduleLoading(false);
      });
  }, [selectedBin, pickedRegion]);

  // 동을 선택했다면 여러 동이 묶인 전체 문자열 대신 선택한 동 이름만 제목으로 사용.
  // 동을 아직 선택하지 않았다면 "+"로 이어진 원본 대신 ", "로 구분해 전체 동 이름이 잘리지 않게 보여줌
  function getScheduleCardTitle(r) {
    if (!isValid(r.MNG_ZONE_TRGT_RGN_NM)) return `${r.CTPV_NM} ${r.SGG_NM}`;
    const dong = pickedRegion && !selectedBin ? pickedRegion.dong : null;
    const zones = splitZoneNames(r.MNG_ZONE_TRGT_RGN_NM).map(normalizeZoneName);
    if (dong && zones.includes(dong)) return dong;
    return zones.join(', ');
  }

  function handleClusterClick(cluster) {
    if (!mapRef.current) return;
    zoomIntoCluster(mapRef.current, cluster.lat, cluster.lng, CLUSTER_ZOOM_LEVEL - 1);
  }

  // regionMap({시도: {시군구: [동/읍/면,...]}})을 "경기도 가평군" / "경기도 가평군 가평읍" 같은 검색용 리스트로 펼침
  const regionOptions = useMemo(() => {
    const list = [];
    Object.entries(scheduleRegionMap).forEach(([c, sggMap]) => {
      Object.entries(sggMap).forEach(([s, dongs]) => {
        list.push({ ctpv: c, sgg: s, dong: '', label: `${c} ${s}` });
        dongs.forEach((d) => {
          list.push({ ctpv: c, sgg: s, dong: d, label: `${c} ${s} ${d}` });
        });
      });
    });
    return list;
  }, [scheduleRegionMap]);

  const regionSuggestions = useMemo(() => {
    if (!regionQuery.trim()) return [];
    return regionOptions.filter((o) => o.label.includes(regionQuery.trim())).slice(0, 8);
  }, [regionQuery, regionOptions]);

  // 검색으로 찾은 좌표로 지도 중심/줌을 맞추고, 그 주변 휴지통도 함께 불러와 마커로 표시
  function centerAndLoadNearbyBins(location, level, radiusKm) {
    if (mapRef.current) centerMapOnLocation(mapRef.current, location, level);
    fetchNearbyTrashbins(location[0], location[1], radiusKm)
      .then((data) => setBins(filterValidBins(data)))
      .catch(console.error);
  }

  function handleSelectRegion(option) {
    setRegionQuery(option.label);
    setShowRegionSuggestions(false);
    setSelectedBin(null);
    setMyLocation(null);
    setPickedRegion(option);
    setGeocodeError('');

    const addressText = [option.ctpv, option.sgg, option.dong].filter(Boolean).join(' ');
    geocodeAddress(addressText)
      .then((location) => centerAndLoadNearbyBins(location, option.dong ? 5 : 8, option.dong ? 2 : 3))
      .catch(() => {
        if (!option.dong) {
          setGeocodeError('지도에서 해당 위치를 찾지 못했어요.');
          return;
        }
        // 동/읍/면까지 포함한 주소로 좌표를 못 찾으면 시/군/구 단위로 재시도
        geocodeAddress(`${option.ctpv} ${option.sgg}`)
          .then((location) => centerAndLoadNearbyBins(location, 8, 3))
          .catch(() => setGeocodeError('지도에서 해당 위치를 찾지 못했어요.'));
      });
  }

  function handleClearRegionQuery() {
    setRegionQuery('');
    setShowRegionSuggestions(false);
  }

  // 돋보기 버튼 클릭(또는 Enter)으로 검색을 실행: 일치하는 지역 중 첫 번째를 선택함
  function handleRegionSearchSubmit() {
    if (regionSuggestions.length > 0) {
      handleSelectRegion(regionSuggestions[0]);
    } else {
      setShowRegionSuggestions(true);
    }
  }

  const findMyLocation = () => {
    setLocationError('');
    setLocating(true);
    setPickedRegion(null);
    setSelectedBin(null);
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

  // 페이지에 처음 들어오면 바로 내 위치를 가져와 지도 중심을 옮기고 마커를 표시
  useEffect(() => {
    findMyLocation();
  }, []);

  if (loading) return <div>지도를 불러오는 중...</div>;
  if (error) return <div>지도를 불러오지 못했어요. 카카오 앱 키/도메인 등록을 확인해주세요.</div>;

  const hasSelection = Boolean(selectedBin || pickedRegion);

  return (
    <div className={styles.mapWrap}>
      <div className={styles.mapArea}>
        <div className={styles.controlPanel}>
          <select
            className={styles.regionSelect}
            value={selectedSido}
            onChange={(e) => {
              setMyLocation(null);
              setPickedRegion(null);
              setSelectedBin(null);
              setSelectedSido(e.target.value);
            }}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.actionButton} ${myLocation ? styles.actionButtonActive : ''}`}
              onClick={findMyLocation}
              disabled={locating}
            >
              <LocationIcon />
              {locating ? '위치 찾는 중...' : '내 위치 주변 보기'}
            </button>
            <button
              type="button"
              className={`${styles.actionButton} ${!myLocation ? styles.actionButtonActive : ''}`}
              onClick={() => {
                setMyLocation(null);
                setPickedRegion(null);
                setSelectedBin(null);
              }}
            >
              <RegionIcon />
              지역별로 보기
            </button>
          </div>
          <div className={styles.binCount}>휴지통 {bins.length}개</div>
          {locationError && <div className={styles.errorText}>{locationError}</div>}
        </div>

        <div className={styles.mapCanvas}>
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
                    <div
                      className={`${styles.binIcon} ${selectedBin === bin ? styles.binIconSelected : ''}`}
                      onClick={() => {
                        setPickedRegion(null);
                        setSelectedBin(bin);
                      }}
                    >
                      <TrashBinIcon open={selectedBin === bin} />
                    </div>
                  </CustomOverlayMap>
                ))}
          </Map>
        </div>
      </div>

      <div className={styles.sidePanelGroup}>
        <button
          type="button"
          className={styles.panelToggleRail}
          onClick={() => setPanelCollapsed((v) => !v)}
          aria-label={panelCollapsed ? '패널 펼치기' : '패널 접기'}
        >
          <ChevronIcon collapsed={panelCollapsed} />
        </button>

        <div className={`${styles.sidePanel} ${panelCollapsed ? styles.sidePanelCollapsed : ''}`}>
        <div className={styles.panelTabs}>
          <button
            type="button"
            className={activeTab === 'schedule' ? styles.panelTabActive : styles.panelTab}
            onClick={() => setActiveTab('schedule')}
          >
            배출 규칙 안내
          </button>
          <button
            type="button"
            className={activeTab === 'item' ? styles.panelTabActive : styles.panelTab}
            onClick={() => setActiveTab('item')}
          >
            배출품목 찾기
          </button>
        </div>

        {activeTab === 'schedule' && (
          <>
            <div className={styles.panelSearchArea}>
              <div className={scheduleStyles.searchCard}>
                <div className={scheduleStyles.searchRow}>
                  <div className={scheduleStyles.inputWrap}>
                    <input
                      type="text"
                      className={scheduleStyles.searchInput}
                      placeholder="시/도, 시/군/구, 동/읍/면을 검색하세요 (예: 부산광역시 북구 화명동)"
                      value={regionQuery}
                      onChange={(e) => {
                        setRegionQuery(e.target.value);
                        setShowRegionSuggestions(true);
                      }}
                      onFocus={() => setShowRegionSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowRegionSuggestions(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRegionSearchSubmit();
                      }}
                    />
                    {regionQuery && (
                      <button
                        type="button"
                        className={scheduleStyles.clearButton}
                        aria-label="검색어 지우기"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleClearRegionQuery();
                        }}
                      >
                        ×
                      </button>
                    )}
                    {showRegionSuggestions && regionSuggestions.length > 0 && (
                      <ul className={scheduleStyles.suggestionList}>
                        {regionSuggestions.map((o) => (
                          <li
                            key={o.label}
                            className={scheduleStyles.suggestionItem}
                            onMouseDown={() => handleSelectRegion(o)}
                          >
                            {o.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    {showRegionSuggestions && regionQuery.trim() && regionSuggestions.length === 0 && (
                      <ul className={scheduleStyles.suggestionList}>
                        <li className={scheduleStyles.suggestionEmpty}>검색 결과가 없어요.</li>
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    className={scheduleStyles.searchSubmitButton}
                    aria-label="검색"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleRegionSearchSubmit();
                    }}
                  >
                    <SearchIcon className={scheduleStyles.searchButtonIcon} />
                  </button>
                </div>
              </div>
              {geocodeError && <div className={styles.errorText}>{geocodeError}</div>}
            </div>

            <div className={styles.panelResults}>
              {!hasSelection && (
                <p className={styles.panelPlaceholder}>
                  지역을 검색하거나 지도에서 휴지통 아이콘을 클릭하면
                  <br />
                  배출 규칙을 보여드려요.
                </p>
              )}

              {hasSelection && (
                <>
                  <div className={styles.panelResultHeader}>
                    {selectedBin ? (
                      <div>
                        <h3 className={styles.panelTitle}>{selectedBin.설치장소명 || '휴지통'}</h3>
                        <p className={styles.panelMeta}>
                          {selectedBin.소재지도로명주소 || selectedBin.소재지지번주소}
                        </p>
                        <p className={styles.panelMeta}>종류: {selectedBin.휴지통종류}</p>
                        {selectedBin.distance !== undefined && (
                          <p className={styles.panelMeta}>
                            거리: 약 {(selectedBin.distance * 1000).toFixed(0)}m
                          </p>
                        )}
                      </div>
                    ) : (
                      <h3 className={styles.panelTitle}>{pickedRegion.label}</h3>
                    )}
                    <button
                      className={styles.closeButton}
                      onClick={() => {
                        setSelectedBin(null);
                        setPickedRegion(null);
                      }}
                      aria-label="지우기"
                    >
                      ×
                    </button>
                  </div>

                  <hr className={styles.panelDivider} />

                  <h4 className={styles.panelSubtitle}>
                    {selectedBin
                      ? `${selectedBin.시도명} ${selectedBin.시군구명}`
                      : `${pickedRegion.ctpv} ${pickedRegion.sgg}`}{' '}
                    배출 규칙 안내
                  </h4>

                  {scheduleLoading && <p>불러오는 중...</p>}
                  {scheduleError && <p className={scheduleStyles.errorText}>{scheduleError}</p>}
                  {!scheduleLoading && !scheduleError && scheduleResults.length === 0 && (
                    <p>해당 지역 배출 규칙 정보가 없어요.</p>
                  )}

                  {scheduleResults.map((r, idx) => (
                    <ScheduleResultCard
                      key={idx}
                      title={`${scheduleResults.length > 1 ? `${idx + 1}. ` : ''}${getScheduleCardTitle(r)}`}
                      record={r}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'item' && (
          <>
            <div className={styles.panelSearchArea}>
              <WasteItemSearchBox
                query={itemSearch.query}
                setQuery={itemSearch.setQuery}
                runSearch={itemSearch.runSearch}
              />
            </div>
            <div className={styles.panelResults}>
              <WasteItemResults
                query={itemSearch.query}
                items={itemSearch.items}
                loading={itemSearch.loading}
                error={itemSearch.error}
              />
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default TrashMap;
