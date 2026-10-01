import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';
import styles from '../styles/TrashMap.module.css';
import scheduleStyles from '../styles/WasteSchedule.module.css';
import SchedulePanelContent from '../components/SchedulePanelContent';
import ReportModal from '../components/ReportModal';
import MobileBottomSheet from '../components/MobileBottomSheet';
import LocationPermissionPrompt from '../components/LocationPermissionPrompt';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWasteItemSearch, WasteItemSearchBox, WasteItemResults } from '../components/WasteItemSearch';
import {
  fetchRegions,
  fetchTrashbinsByRegion,
  fetchNearbyTrashbins,
  fetchTrashbinsInBounds,
  fetchFacilities,
  fetchDistrictTrashbins,
} from '../api/trashbinApi';
import { fetchSchedule, fetchRegions as fetchScheduleRegions } from '../api/wasteScheduleApi';
import {
  filterValidBins,
  getBinKind,
  formatBinType,
  toDistrictBin,
  isInScope,
  BIN_KIND_LABELS,
} from '../utils/trashbinUtils';
import {
  fitBoundsToBins,
  centerMapOnLocation,
  zoomIntoCluster,
  geocodeAddress,
  getRegionFromCoords,
  findDistrictBinCoords,
} from '../utils/kakaoMapUtils';
import { getCurrentLocation, getGeolocationPermission, watchGeolocationPermission } from '../utils/geolocation';
import {
  isValid,
  dedupeScheduleResults,
  splitZoneNames,
  normalizeZoneName,
  zoneDisplayName,
} from '../utils/wasteScheduleUtils';
import { CLUSTER_ZOOM_LEVEL, clusterBins } from '../utils/binClusterUtils';

const INITIAL_MAP_LEVEL = 13;
// 위치 권한 안내에서 '지역을 직접 선택할게요'를 고르면 같은 탭에서는 다시 묻지 않도록 기억 (sessionStorage)
const LOCATION_PROMPT_SKIPPED_KEY = 'dropspot:locationPromptSkipped';
const LOCATION_DENIED_MESSAGE = '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용하면 내 주변 쓰레기통을 볼 수 있어요.';
const LOCATION_NOT_SET_MESSAGE = '위치 권한을 허용하면 내 주변 쓰레기통을 볼 수 있어요.';
const NEARBY_RADII_KM = [1, 3, 10];

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

// 재활용 쓰레기통은 파란색 통 + 흰색 순환 화살표로 일반 휴지통과 구분. 클릭하면 뚜껑이 열리며 더 진한 파란색으로 강조됨
function RecyclingBinIcon({ open }) {
  const color = open ? '#0d47a1' : '#1e88e5';
  const fillTransition = { transition: 'fill 0.25s ease' };
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="9" width="12" height="12" rx="1.5" fill={color} style={fillTransition} />
      <g fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.4 12.43 A2.6 2.6 0 0 1 12.4 17.57" />
        <path d="M13.3 16.8 L12.4 17.57 L13.3 18.4" />
        <path d="M11.6 17.57 A2.6 2.6 0 0 1 11.6 12.43" />
        <path d="M10.7 11.6 L11.6 12.43 L10.7 13.2" />
      </g>
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

// 일반+재활용 겸용 쓰레기통: 왼쪽 절반은 일반(회색), 오른쪽 절반은 재활용(파란색). 클릭하면 양쪽 모두 진해짐
function MixedBinIcon({ open }) {
  const left = open ? '#222222' : '#4a4a4a';
  const right = open ? '#0d47a1' : '#1e88e5';
  const fillTransition = { transition: 'fill 0.25s ease' };
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="9" width="12" height="12" rx="1.5" fill={left} style={fillTransition} />
      <path d="M12 9 H16.5 A1.5 1.5 0 0 1 18 10.5 V19.5 A1.5 1.5 0 0 1 16.5 21 H12 Z" fill={right} style={fillTransition} />
      <line x1="12" y1="9" x2="12" y2="21" stroke="#fff" strokeWidth="0.8" />
      <g
        transform={open ? 'rotate(-25 5 7.5)' : 'rotate(0 5 7.5)'}
        style={{ transition: 'transform 0.25s ease' }}
      >
        <rect x="4" y="6" width="16" height="3" rx="1" fill={left} style={fillTransition} />
        <path d="M12 6 H19 A1 1 0 0 1 20 7 V8 A1 1 0 0 1 19 9 H12 Z" fill={right} style={fillTransition} />
        <rect x="10" y="4" width="4" height="2" rx="1" fill={left} style={fillTransition} />
        <path d="M12 4 H13 A1 1 0 0 1 14 5 A1 1 0 0 1 13 6 H12 Z" fill={right} style={fillTransition} />
      </g>
    </svg>
  );
}

// 재활용센터는 쓰레기통이 아닌 건물이라 청록색 건물 아이콘(지붕 + 창문 + 출입문)으로 표시.
// 흰 테두리 원형 배지 안에 넣어 쓰레기통 아이콘과 모양부터 구분되게 하고, 클릭하면 더 진한 색으로 강조
function RecyclingCenterIcon({ open }) {
  const color = open ? '#00574b' : '#00897b';
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#fff" stroke={color} strokeWidth="1.5" style={{ transition: 'stroke 0.25s ease' }} />
      <path d="M5.5 10.5 L12 5.5 L18.5 10.5 Z" fill={color} style={{ transition: 'fill 0.25s ease' }} />
      <rect x="7" y="10.5" width="10" height="7.5" fill={color} style={{ transition: 'fill 0.25s ease' }} />
      <rect x="8.3" y="12" width="2" height="2" fill="#fff" />
      <rect x="13.7" y="12" width="2" height="2" fill="#fff" />
      <rect x="10.9" y="14.5" width="2.2" height="3.5" fill="#fff" />
    </svg>
  );
}

// 의류수거함은 보라색 원형 배지 안에 흰 티셔츠 모양으로 표시. 클릭하면 더 진한 보라색으로 강조
function ClothingBinIcon({ open }) {
  const color = open ? '#4a148c' : '#8e24aa';
  const transition = { transition: 'fill 0.25s ease' };
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill={color} stroke="#fff" strokeWidth="1.5" style={transition} />
      <path
        d="M9.2 6.5 L6 8.2 L7.3 10.8 L8.5 10.3 V17.5 H15.5 V10.3 L16.7 10.8 L18 8.2 L14.8 6.5 C14.4 7.6 13.3 8.3 12 8.3 C10.7 8.3 9.6 7.6 9.2 6.5 Z"
        fill="#fff"
      />
    </svg>
  );
}

const MARKER_ICONS = {
  general: TrashBinIcon,
  recycle: RecyclingBinIcon,
  both: MixedBinIcon,
  center: RecyclingCenterIcon,
  clothing: ClothingBinIcon,
};
// 마커를 그리는 순서/겹침 우선순위: 재활용센터(건물) > 의류수거함 > 재활용 > 겸용 > 일반
const KIND_ORDER = { general: 0, both: 1, recycle: 2, clothing: 3, center: 4 };
// 범례 버튼 목록 (클래스명은 TrashMap.module.css 기준)
const LEGEND_ITEMS = [
  { kind: 'general', label: '일반 쓰레기통', unit: '개', dotClass: 'legendDotGeneral', countClass: 'legendCount' },
  { kind: 'recycle', label: '재활용 쓰레기통', unit: '개', dotClass: 'legendDotRecycle', countClass: 'legendCountRecycle' },
  { kind: 'both', label: '일반+재활용 겸용', unit: '개', dotClass: 'legendDotBoth', countClass: 'legendCountBoth' },
  { kind: 'center', label: '재활용센터', unit: '곳', dotClass: 'legendDotCenter', countClass: 'legendCountCenter' },
  { kind: 'clothing', label: '의류수거함', unit: '개', dotClass: 'legendDotClothing', countClass: 'legendCountClothing' },
];
// 범례에서 아무것도 고르지 않았을 때 기본으로 보여줄 종류
// (재활용센터·의류수거함은 쓰레기통이 아니라서 기본으로는 숨기고, 범례에서 골랐을 때만 표시)
const DEFAULT_VISIBLE_KINDS = ['general', 'recycle', 'both'];

// 선택해도 오른쪽 패널에 배출 규칙(시간표)을 보여주지 않는 종류 (집 앞 배출 시간표와 관계없는 시설)
const NO_SCHEDULE_KINDS = ['center', 'clothing'];

// 휴지통과 같은 범위로 함께 불러오는 시설 데이터 (백엔드 경로, 반경 조회 시 넓혀서 찾을 반경)
const FACILITY_TYPES = [
  // 재활용센터는 휴지통보다 훨씬 드물어서 더 넓게 찾음
  { kind: 'center', path: '/api/recycling-centers', radiusKm: (r) => Math.max(r * 3, 5) },
  { kind: 'clothing', path: '/api/clothing-bins', radiusKm: (r) => Math.max(r * 2, 2) },
];

function isKindShown(kind, selectedKinds) {
  return selectedKinds.length > 0 ? selectedKinds.includes(kind) : DEFAULT_VISIBLE_KINDS.includes(kind);
}

// 클러스터 테두리 색 클래스 (일반은 기본 스타일)
// 선택한 쓰레기통/시설 종류 라벨 배지 클래스
const KIND_BADGE_CLASS = {
  general: styles.kindBadgeGeneral,
  recycle: styles.kindBadgeRecycle,
  both: styles.kindBadgeBoth,
  center: styles.kindBadgeCenter,
  clothing: styles.kindBadgeClothing,
};

const CLUSTER_CLASS = {
  recycle: styles.clusterIconRecycle,
  both: styles.clusterIconBoth,
  center: styles.clusterIconCenter,
  clothing: styles.clusterIconClothing,
};

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
  // 카카오 지도 객체가 만들어졌는지. 위치를 지도보다 먼저 찾은 경우에도 지도가 준비되면 그 위치로 옮기기 위해 사용
  const [mapReady, setMapReady] = useState(false);
  // 휴지통/재활용센터 요청마다 번호를 매겨, 늦게 도착한 이전 요청 응답이 최신 결과를 덮어쓰지 않게 함
  // (예: 처음 들어올 때 기본 시도 전체 요청이 내 위치 주변 요청보다 늦게 끝나는 경우)
  const loadIdRef = useRef(0);
  // 사용자가 지도를 직접 드래그해서 둘러보는 중인지. 이 동안에는 화면 영역 안의 휴지통을 불러오고,
  // 내 위치/시도 기준으로 지도를 자동으로 다시 맞추지 않음. 이벤트 핸들러에서 바로 읽어야 해서 ref도 함께 둠
  const browsingRef = useRef(false);
  const [browsing, setBrowsing] = useState(false);
  const [regions, setRegions] = useState([]);
  const [selectedSido, setSelectedSido] = useState('부산광역시');
  const [bins, setBins] = useState([]);
  // 재활용센터·의류수거함 같은 시설 데이터 ({ [kind]: 항목 배열 }, FACILITY_TYPES 참고)
  const [facilities, setFacilities] = useState({ center: [], clothing: [] });
  // 구청별 공공쓰레기통(부산 남구, 대구 동구 등, 주소/장소명을 좌표로 바꾼 것) + 지금 불러온 휴지통 범위.
  // 구청 데이터는 한 번만 받아서 좌표로 바꿔 두고, 범위가 바뀔 때마다 그 안에 있는 것만 골라서 표시
  const [districtBins, setDistrictBins] = useState([]);
  const [binScope, setBinScope] = useState(null);
  // 범례에서 고른 종류들만 지도에 표시 (여러 개 선택 가능). 비어 있으면 기본: 쓰레기통 3종류만, 재활용센터는 숨김
  const [selectedKinds, setSelectedKinds] = useState([]);
  const isMobile = useIsMobile();
  // 내 위치(또는 드래그한 지도 중심)가 속한 { sido, sgg }. 모바일에서는 아무것도 선택하지 않아도
  // 이 지역의 배출 규칙을 하단 패널에 보여줌
  const [autoRegion, setAutoRegion] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  // 앱을 처음 열 때 보여주는 위치 권한 안내 화면
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  // 권한을 아직 정하지 않은 채 위치 요청 시간이 지났을 때, 뒤늦게 허용하면 다시 찾기 위한 구독 해제 함수
  const permissionUnwatchRef = useRef(null);
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

  // '품목 찾기' 탭의 배출품목 검색 상태 (탭 전환은 SchedulePanelContent 안에서 관리)
  const itemSearch = useWasteItemSearch();
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  // 신고 폼에 넘길 { location, manager }. null이면 폼이 닫힌 상태
  const [reportTarget, setReportTarget] = useState(null);

  // 레벨 숫자가 클수록 더 축소된 상태 → 많이 축소했을 때만 클러스터로 묶어서 표시
  const isClustered = zoomLevel >= CLUSTER_ZOOM_LEVEL;
  // 휴지통 API 항목은 휴지통종류로 일반/재활용/겸용을 나누고, 재활용센터·의류수거함은 시설 종류로 따로 분류
  const markers = useMemo(
    () => [
      ...bins.map((item) => ({ item, kind: getBinKind(item) })),
      // 구청별 공공쓰레기통은 지금 불러온 범위(시도/반경/화면 영역) 안에 있는 것만 함께 표시
      ...districtBins.filter((b) => isInScope(b, binScope)).map((item) => ({ item, kind: getBinKind(item) })),
      ...FACILITY_TYPES.flatMap((type) => facilities[type.kind].map((item) => ({ item, kind: type.kind }))),
    ],
    [bins, facilities, districtBins, binScope]
  );
  // 종류별로 서로 겹치지 않게 각각 따로 셈 (겸용은 일반·재활용 개수에 포함하지 않음)
  const kindCounts = useMemo(() => {
    const counts = Object.fromEntries(LEGEND_ITEMS.map((item) => [item.kind, 0]));
    markers.forEach(({ kind }) => {
      counts[kind] += 1;
    });
    return counts;
  }, [markers]);

  // 범례에서 켜 둔 종류만 표시. 재활용 마커는 일반 마커 위에 그려서 겹쳐도 가려지지 않게 뒤쪽으로 정렬
  const visibleMarkers = useMemo(() => {
    return markers
      .filter(({ kind }) => isKindShown(kind, selectedKinds))
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  }, [markers, selectedKinds]);

  // 범례 버튼: 누르면 선택에 추가, 선택된 걸 다시 누르면 선택에서 뺌
  function toggleKind(kind) {
    setSelectedKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  }

  // 종류별로 따로 묶어서 클러스터 색으로도 구분
  const clusters = useMemo(() => {
    if (!isClustered) return [];
    const groups = Object.fromEntries(LEGEND_ITEMS.map((item) => [item.kind, []]));
    visibleMarkers.forEach(({ item, kind }) => groups[kind].push(item));
    return Object.entries(groups).flatMap(([kind, items]) =>
      clusterBins(items, zoomLevel).map((c) => ({ ...c, kind }))
    );
  }, [visibleMarkers, zoomLevel, isClustered]);

  useEffect(() => {
    fetchRegions().then(setRegions).catch(console.error);
  }, []);

  useEffect(() => {
    fetchScheduleRegions().then(setScheduleRegionMap).catch(console.error);
  }, []);

  // 구청별 공공쓰레기통 목록을 받아 카카오로 좌표를 찾음 (카카오 지도 로드 후 한 번만).
  // 주소가 있으면 주소 검색(정확), 없으면 장소명 검색(대략적). 좌표를 못 찾은 항목은 지도에 표시하지 않음
  useEffect(() => {
    // 카카오 스크립트를 못 불러온 경우(예: 등록되지 않은 도메인/포트)엔 좌표 변환을 시도하지 않음
    if (loading || error || !window.kakao?.maps?.services) return;
    let cancelled = false;
    (async () => {
      try {
        const groups = await fetchDistrictTrashbins();
        const converted = [];
        for (const group of groups) {
          for (const record of group.records) {
            const coords = await findDistrictBinCoords(record, group);
            if (coords) converted.push(toDistrictBin(record, group, coords.coords, coords.approximate));
            else console.warn(`${group.source} 위치를 찾지 못했어요:`, record);
          }
        }
        if (!cancelled) setDistrictBins(converted);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, error]);

  // 내 위치를 찾으면 좌표로 시/도를 알아내 왼쪽 시/도 선택 박스를 맞춤
  // (myLocation이 있으면 시/도 전체 휴지통 요청은 건너뛰므로 주변 마커는 그대로 유지됨)
  useEffect(() => {
    if (!myLocation || loading) return;
    updateRegionFromCoords(myLocation[0], myLocation[1]);
  }, [myLocation, loading]);

  useEffect(() => {
    // 내 위치를 찾는 중이거나 찾은 뒤, 또는 지도를 드래그해 둘러보는 중에는 시도 전체를 불러오지 않음
    if (myLocation || locating || browsing) return;
    const loadId = ++loadIdRef.current;
    setBinScope({ type: 'sido', sido: selectedSido });
    fetchTrashbinsByRegion(selectedSido)
      .then((data) => loadId === loadIdRef.current && setBins(filterValidBins(data)))
      .catch(console.error);
    loadFacilities(loadId, { type: 'sido', sido: selectedSido });
  }, [selectedSido, myLocation, locating, browsing]);

  useEffect(() => {
    if (!mapReady || loading) return;
    // 지역 검색으로 직접 중심/줌을 맞췄거나 지도를 드래그해 옮긴 경우에는 자동으로 다시 맞추지 않음
    if (pickedRegion || browsing) return;

    if (myLocation) {
      // 가장 가까운 휴지통이 1km보다 멀면(반경을 넓혀서 찾은 경우) 내 위치와 가까운 휴지통들이 함께 보이게 맞춤
      const nearest = bins[0];
      if (nearest && nearest.distance > 1) {
        fitBoundsToBins(mapRef.current, [...bins.slice(0, 5), { 위도: myLocation[0], 경도: myLocation[1] }]);
      } else {
        centerMapOnLocation(mapRef.current, myLocation, 4);
      }
    } else if (bins.length > 0) {
      fitBoundsToBins(mapRef.current, bins);
    }
  }, [bins, myLocation, loading, pickedRegion, mapReady]);

  // 휴지통 아이콘을 클릭하거나 지역을 검색해서 선택하면, 그 지역(시도/시군구, 필요시 동)의
  // 배출 규칙을 오른쪽 패널에 조회 (재활용센터·의류수거함은 배출 시간표를 보여주지 않으므로 조회하지 않음)
  useEffect(() => {
    if (selectedBin && NO_SCHEDULE_KINDS.includes(getBinKind(selectedBin))) {
      setScheduleResults([]);
      setScheduleError('');
      setScheduleLoading(false);
      return;
    }
    // 아무것도 선택하지 않았을 때는 내 위치/지도 중심 지역(autoRegion)의 규칙을 보여줌 (모바일·데스크톱 공통)
    const fallback = autoRegion;
    const ctpv = selectedBin ? selectedBin.시도명 : pickedRegion ? pickedRegion.ctpv : fallback?.sido;
    const sgg = selectedBin ? selectedBin.시군구명 : pickedRegion ? pickedRegion.sgg : fallback?.sgg;
    const dong = selectedBin ? null : pickedRegion ? pickedRegion.dong || null : null;

    // 시군구는 비어 있을 수 있음 (세종특별자치시처럼 시군구가 없는 시도 → 서버가 시도 기준으로 찾음)
    if (!ctpv) {
      setScheduleResults([]);
      setScheduleError('');
      setScheduleLoading(false);
      return;
    }
    // 쓰레기통을 연달아 누르거나 지도를 움직여 지역이 빠르게 바뀔 때, 늦게 도착한 이전 지역의 응답이
    // 최신 결과를 덮어쓰지 않도록 이 요청이 아직 최신인지 확인
    let cancelled = false;
    setScheduleLoading(true);
    setScheduleError('');
    fetchSchedule(ctpv, sgg)
      .then((data) => {
        if (cancelled) return;
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
        if (cancelled) return;
        setScheduleError('배출 규칙을 불러오지 못했어요.');
        setScheduleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBin, pickedRegion, autoRegion]);

  // 데스크톱 ↔ 모바일 레이아웃이 바뀌면 지도 영역 크기가 달라지므로 카카오 지도에 다시 계산하게 함
  useEffect(() => {
    mapRef.current?.relayout();
  }, [isMobile]);

  // 동을 선택했다면 여러 동이 묶인 전체 문자열 대신 선택한 동 이름만 제목으로 사용.
  // 동을 아직 선택하지 않았다면 "+"로 이어진 원본 대신 ", "로 구분해 전체 동 이름이 잘리지 않게 보여줌
  // 구역 칸에 배출 방법 설명문이 잘못 들어간 경우엔 "북구 전역"처럼 앞부분만 보여줌
  function getScheduleCardTitle(r) {
    if (!isValid(r.MNG_ZONE_TRGT_RGN_NM)) return `${r.CTPV_NM} ${r.SGG_NM}`;
    const dong = pickedRegion && !selectedBin ? pickedRegion.dong : null;
    const zones = splitZoneNames(r.MNG_ZONE_TRGT_RGN_NM).map(zoneDisplayName).filter(Boolean);
    if (dong && zones.includes(dong)) return dong;
    return zones.length > 0 ? zones.join(', ') : `${r.CTPV_NM} ${r.SGG_NM}`;
  }

  // 내 위치/지역 검색/시도 선택처럼 지도를 새로 맞추는 동작 전에 호출해 둘러보기 모드를 끔
  function stopBrowsing() {
    browsingRef.current = false;
    setBrowsing(false);
  }

  // 지도 화면에 보이는 영역 안의 휴지통/재활용센터를 불러오고, 화면 중심의 시/도로 선택 박스를 맞춤
  function loadBinsInView(map) {
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const area = { swLat: sw.getLat(), swLng: sw.getLng(), neLat: ne.getLat(), neLng: ne.getLng() };

    const loadId = ++loadIdRef.current;
    setBinScope({ type: 'bounds', ...area });
    fetchTrashbinsInBounds(area)
      .then((data) => loadId === loadIdRef.current && setBins(filterValidBins(data)))
      .catch(console.error);
    loadFacilities(loadId, { type: 'bounds', ...area });

    const center = map.getCenter();
    updateRegionFromCoords(center.getLat(), center.getLng());
  }

  // 좌표가 속한 시/도로 선택 박스를 맞추고(syncSido), 시/군/구까지 기억해 둠 (모바일 하단 패널의 기본 지역)
  function updateRegionFromCoords(lat, lng, { syncSido = true } = {}) {
    getRegionFromCoords(lat, lng)
      .then((region) => {
        if (syncSido) setSelectedSido(region.sido);
        setAutoRegion((prev) => (prev && prev.sido === region.sido && prev.sgg === region.sgg ? prev : region));
      })
      .catch(console.error);
  }

  // 신고 폼을 열면서 위치를 자동으로 채움: 쓰레기통을 선택했으면 그 쓰레기통 정보,
  // 지역 검색 중이면 검색한 지역 이름 + 현재 지도 중심 좌표를 사용
  function openReport(record) {
    let location;
    if (selectedBin) {
      location = {
        name: selectedBin.시설명 || selectedBin.설치장소명 || '',
        address: selectedBin.소재지도로명주소 || selectedBin.소재지지번주소 || '',
        region: `${selectedBin.시도명} ${selectedBin.시군구명}`,
        lat: parseFloat(selectedBin.위도),
        lng: parseFloat(selectedBin.경도),
      };
    } else {
      // 지역 검색으로 고른 지역, 없으면(모바일 기본 상태) 내 위치/지도 중심 지역을 사용
      const center = mapRef.current?.getCenter();
      const regionLabel = pickedRegion
        ? pickedRegion.label
        : autoRegion
          ? `${autoRegion.sido} ${autoRegion.sgg}`.trim()
          : '';
      location = {
        name: '',
        address: regionLabel,
        region: pickedRegion ? `${pickedRegion.ctpv} ${pickedRegion.sgg}` : regionLabel,
        lat: center ? center.getLat() : undefined,
        lng: center ? center.getLng() : undefined,
      };
    }
    setReportTarget({
      location,
      manager: { name: record.MNG_DEPT_NM || '', tel: record.MNG_DEPT_TELNO || '' },
    });
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
    const loadId = ++loadIdRef.current;
    setBinScope({ type: 'radius', lat: location[0], lng: location[1], radiusKm });
    fetchNearbyTrashbins(location[0], location[1], radiusKm)
      .then((data) => loadId === loadIdRef.current && setBins(filterValidBins(data)))
      .catch(console.error);
    loadFacilities(loadId, { type: 'radius', lat: location[0], lng: location[1], radiusKm });
  }

  // 재활용센터·의류수거함을 휴지통과 같은 범위(시도/반경/화면 영역)로 불러옴.
  // 반경 조회는 시설마다 드문 정도가 달라 FACILITY_TYPES의 radiusKm로 넓혀서 찾음
  function loadFacilities(loadId, scope) {
    FACILITY_TYPES.forEach((type) => {
      const typeScope = scope.type === 'radius' ? { ...scope, radiusKm: type.radiusKm(scope.radiusKm) } : scope;
      fetchFacilities(type.path, typeScope)
        .then((data) => {
          if (loadId !== loadIdRef.current) return;
          setFacilities((prev) => ({ ...prev, [type.kind]: filterValidBins(data) }));
        })
        .catch(console.error);
    });
  }

  // 휴지통 데이터가 지역별로 드문드문해서, 1km 안에 없으면 3km → 10km 순으로 반경을 넓혀 찾음
  async function fetchNearestTrashbins(lat, lng) {
    for (const radius of NEARBY_RADII_KM) {
      const data = filterValidBins(await fetchNearbyTrashbins(lat, lng, radius));
      if (data.length > 0) return { bins: data, radius };
    }
    return { bins: [], radius: NEARBY_RADII_KM[NEARBY_RADII_KM.length - 1] };
  }

  function handleSelectRegion(option) {
    setRegionQuery(option.label);
    setShowRegionSuggestions(false);
    setSelectedBin(null);
    setMyLocation(null);
    setPickedRegion(option);
    stopBrowsing();
    // 왼쪽 상단 시/도 선택 박스도 검색한 지역의 시/도로 맞춤
    // (이때 시/도 전체 휴지통 요청이 나가지만, 뒤이은 주변 휴지통 요청이 loadIdRef로 덮어씀)
    setSelectedSido(option.ctpv);
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
    stopBrowsing();
    setPickedRegion(null);
    setSelectedBin(null);
    const loadId = ++loadIdRef.current;
    stopWatchingPermission();

    const applyLocation = (location) => {
      if (loadId !== loadIdRef.current) return;
      setMyLocation(location);
      setLocating(false);
      fetchNearestTrashbins(location[0], location[1])
        .then(({ bins: found, radius }) => {
          if (loadId !== loadIdRef.current) return;
          setBins(found);
          setBinScope({ type: 'radius', lat: location[0], lng: location[1], radiusKm: radius });
          if (found.length === 0) setLocationError(`내 위치 ${radius}km 안에 휴지통 정보가 없어요.`);
          // 재활용센터·의류수거함도 휴지통을 찾은 반경에 맞춰 찾음
          loadFacilities(loadId, { type: 'radius', lat: location[0], lng: location[1], radiusKm: radius });
        })
        .catch(console.error);
    };

    getCurrentLocation()
      .then(applyLocation)
      .catch(async (err) => {
        if (loadId !== loadIdRef.current) return;
        // err.code 1 = 사용자가 권한을 거절함 (브라우저 원문 메시지는 영어라 한국어 안내로 바꿔서 보여줌)
        if (err.code === 1) {
          setLocationError(LOCATION_DENIED_MESSAGE);
          setLocating(false);
          return;
        }

        // 시간 초과 등: 권한 창에서 아무것도 누르지 않고 있으면 제한 시간이 지나버림.
        // 권한을 이미 허용한 경우(GPS가 느린 경우)엔 오류 문구 없이 정확도를 낮춰 한 번 더 조용히 시도
        const permission = await getGeolocationPermission();
        if (permission === 'granted') {
          getCurrentLocation({ enableHighAccuracy: false, timeout: 20000, maximumAge: 5 * 60 * 1000 })
            .then(applyLocation)
            .catch(() => loadId === loadIdRef.current && setLocating(false));
          return;
        }

        // 권한을 아직 정하지 않은 경우에만 안내 문구를 보여주고, 뒤늦게 허용을 누르면 자동으로 다시 찾음
        setLocationError(LOCATION_NOT_SET_MESSAGE);
        setLocating(false);
        permissionUnwatchRef.current = watchGeolocationPermission((state) => {
          if (state === 'granted') {
            findMyLocation();
          } else if (state === 'denied') {
            stopWatchingPermission();
            setLocationError(LOCATION_DENIED_MESSAGE);
          }
        });
      });
  };

  // 권한 상태 변경 구독을 해제 (새로 위치를 찾거나 화면을 떠날 때)
  function stopWatchingPermission() {
    permissionUnwatchRef.current?.();
    permissionUnwatchRef.current = null;
  }

  useEffect(() => stopWatchingPermission, []);

  // 페이지에 처음 들어오면 위치 권한 상태를 확인해서:
  // - 이미 허용: 안내 없이 바로 내 위치로 시작
  // - 이미 거절: 안내 화면 대신 설정 방법을 알려주고 지역별 보기로 시작
  // - 아직 안 물어봄: 브라우저 권한 창보다 먼저 안내 화면(LocationPermissionPrompt)을 보여줌
  //   (같은 탭에서 '직접 선택'을 고른 적이 있으면 다시 묻지 않음)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const showPromptUnlessSkipped = () => {
      let skipped = false;
      try {
        skipped = sessionStorage.getItem(LOCATION_PROMPT_SKIPPED_KEY) === '1';
      } catch {
        // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 그냥 안내 화면을 보여줌
      }
      if (!skipped) setShowLocationPrompt(true);
    };

    if (!navigator.permissions?.query) {
      showPromptUnlessSkipped();
      return;
    }
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (status.state === 'granted') findMyLocation();
        else if (status.state === 'denied') setLocationError(LOCATION_DENIED_MESSAGE);
        else showPromptUnlessSkipped();
      })
      .catch(showPromptUnlessSkipped);
  }, []);

  function handleAllowLocation() {
    setShowLocationPrompt(false);
    findMyLocation();
  }

  function handleSkipLocation() {
    setShowLocationPrompt(false);
    try {
      sessionStorage.setItem(LOCATION_PROMPT_SKIPPED_KEY, '1');
    } catch {
      // 저장하지 못해도 이번 화면에서는 닫힘
    }
  }

  if (loading) return <div>지도를 불러오는 중...</div>;
  if (error) return <div>지도를 불러오지 못했어요. 카카오 앱 키/도메인 등록을 확인해주세요.</div>;

  const hasSelection = Boolean(selectedBin || pickedRegion);
  // 선택이 없어도 내 위치/지도 중심 지역(autoRegion)이 있으면 그 지역의 배출 규칙을 보여줌
  const autoRegionLabel = autoRegion ? `${autoRegion.sido} ${autoRegion.sgg}`.trim() : '';
  const hasScheduleTarget = hasSelection || Boolean(autoRegion);
  const hideSchedule = Boolean(selectedBin) && NO_SCHEDULE_KINDS.includes(getBinKind(selectedBin));

  // 지역 검색창 (데스크톱은 오른쪽 패널, 모바일은 지도 위 플로팅 영역에서 같이 사용)
  const regionSearchRow = (
    <div className={scheduleStyles.searchRow}>
      <div className={scheduleStyles.inputWrap}>
        <input
          type="text"
          className={scheduleStyles.searchInput}
          placeholder={isMobile ? '지역 검색 (예: 부산광역시 북구 화명동)' : '시/도, 시/군/구, 동/읍/면을 검색하세요 (예: 부산광역시 북구 화명동)'}
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
  );

  // 모바일 하단 패널에 넘길 제목/선택 정보
  const sheetTitle = selectedBin
    ? `${selectedBin.시도명} ${selectedBin.시군구명}`
    : pickedRegion
      ? pickedRegion.label
      : autoRegion
        ? `${autoRegion.sido} ${autoRegion.sgg}`.trim()
        : '';
  const sheetPlace = selectedBin
    ? (() => {
        const kind = getBinKind(selectedBin);
        return {
          badge: BIN_KIND_LABELS[kind],
          badgeClass: KIND_BADGE_CLASS[kind],
          name: selectedBin.시설명 || selectedBin.설치장소명 || BIN_KIND_LABELS[kind],
          lines: [
            selectedBin.소재지도로명주소 || selectedBin.소재지지번주소,
            selectedBin.휴지통종류 && `종류: ${formatBinType(selectedBin.휴지통종류)}`,
            selectedBin.설치대수 > 1 && `설치 대수: ${selectedBin.설치대수}대`,
            selectedBin.세부위치 && `세부 위치: ${selectedBin.세부위치}`,
            selectedBin.관리기관 && `관리기관: ${selectedBin.관리기관}`,
            selectedBin.전화번호 && `☎ ${selectedBin.전화번호}`,
            selectedBin.운영시간 && `평일 운영: ${selectedBin.운영시간}`,
            selectedBin.휴일운영시간 && `휴일 운영: ${selectedBin.휴일운영시간}`,
            selectedBin.휴무일 && `휴무일: ${selectedBin.휴무일}`,
            selectedBin.취급품목 && `취급 품목: ${selectedBin.취급품목}`,
            selectedBin.distance !== undefined && `거리: 약 ${(selectedBin.distance * 1000).toFixed(0)}m`,
            selectedBin.출처 && `출처: ${selectedBin.출처}`,
          ],
          note: selectedBin.대략적위치 ? '※ 장소 이름으로 찾은 대략적인 위치예요.' : null,
        };
      })()
    : null;
  // 선택이 바뀔 때마다 달라지는 값 (바뀌면 관리구역 선택이 첫 구역으로 돌아감).
  // 아무것도 고르지 않았을 때도 지도를 옮겨 기준 지역이 바뀌면 값이 달라지도록 지역 이름을 포함
  const sheetSelectionKey = selectedBin
    ? `${selectedBin.위도},${selectedBin.경도},${selectedBin.시설명 || selectedBin.설치장소명}`
    : pickedRegion
      ? pickedRegion.label
      : `auto:${autoRegionLabel}`;

  // 배출 규칙 패널 내용(SchedulePanelContent)에 넘길 값: 모바일 하단 패널과 데스크톱 오른쪽 패널 공통
  const schedulePanelProps = {
    place: sheetPlace,
    records: scheduleResults,
    getRecordTitle: getScheduleCardTitle,
    loading: scheduleLoading,
    error: scheduleError,
    showSchedule: !hideSchedule,
    selectionKey: sheetSelectionKey,
    emptyMessage: hasScheduleTarget
      ? '이 지역의 배출 규칙 정보가 없어요.'
      : '지역을 검색하거나 지도에서 쓰레기통을 누르면 배출 규칙을 보여드려요.',
    onReport: openReport,
    itemSearchContent: (
      <>
        <WasteItemSearchBox query={itemSearch.query} setQuery={itemSearch.setQuery} runSearch={itemSearch.runSearch} />
        <WasteItemResults
          query={itemSearch.query}
          items={itemSearch.items}
          loading={itemSearch.loading}
          error={itemSearch.error}
        />
      </>
    ),
  };

  return (
    <div className={styles.mapWrap}>
      <div className={styles.mapArea}>
        {!isMobile && (
        <div className={styles.controlPanel}>
          <select
            className={styles.regionSelect}
            value={selectedSido}
            onChange={(e) => {
              setMyLocation(null);
              setPickedRegion(null);
              setSelectedBin(null);
              stopBrowsing();
              setSelectedSido(e.target.value);
            }}
          >
            {/* 휴지통 데이터가 없는 시/도를 검색한 경우에도 선택 박스에 그 이름이 보이도록 목록에 추가 */}
            {(regions.includes(selectedSido) ? regions : [...regions, selectedSido]).map((r) => (
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
                stopBrowsing();
              }}
            >
              <RegionIcon />
              지역별로 보기
            </button>
          </div>
          <div className={styles.legend}>
            {/* 누른 종류들만 지도에 표시(여러 개 선택 가능). 선택을 모두 풀면 기본 상태(쓰레기통 전체)로 돌아감 */}
            {LEGEND_ITEMS.map((item) => {
              const selected = selectedKinds.includes(item.kind);
              return (
                <button
                  key={item.kind}
                  type="button"
                  className={`${styles.legendItem} ${
                    selected
                      ? styles.legendItemActive
                      : isKindShown(item.kind, selectedKinds)
                        ? ''
                        : styles.legendItemOff
                  }`}
                  onClick={() => toggleKind(item.kind)}
                  aria-pressed={selected}
                  title={selected ? '다시 누르면 선택 해제' : `${item.label} 선택`}
                >
                  <span className={`${styles.legendDot} ${styles[item.dotClass]}`} />
                  {item.label} <strong className={styles[item.countClass]}>{kindCounts[item.kind]}</strong>
                  {item.unit}
                </button>
              );
            })}
          </div>
          {locationError && <div className={styles.errorText}>{locationError}</div>}
        </div>
        )}

        <div className={styles.mapCanvas}>
          {/* 모바일: 지도 위에 떠 있는 지역 검색창 + 버튼 (내 위치 / 지역별 보기 + 종류별 필터) */}
          {isMobile && (
            <div className={styles.floatingControls}>
              <div className={styles.floatingSearch}>{regionSearchRow}</div>
              {geocodeError && <p className={styles.floatingError}>{geocodeError}</p>}
              <div className={styles.floatingRow}>
                <button
                  type="button"
                  className={`${styles.floatingButton} ${myLocation ? styles.floatingButtonActive : ''}`}
                  onClick={findMyLocation}
                  disabled={locating}
                >
                  <LocationIcon />
                  {locating ? '찾는 중...' : '내 위치 보기'}
                </button>
                <button
                  type="button"
                  className={`${styles.floatingButton} ${!myLocation ? styles.floatingButtonActive : ''}`}
                  onClick={() => {
                    setMyLocation(null);
                    setPickedRegion(null);
                    setSelectedBin(null);
                    stopBrowsing();
                  }}
                >
                  <RegionIcon />
                  지역별 보기
                </button>
              </div>
              {/* 종류가 많아서 한 줄로 두고 옆으로 밀어서 봄. 누른 종류들만 지도에 표시(데스크톱 범례와 같음) */}
              <div className={styles.floatingFilterRow}>
                {LEGEND_ITEMS.map((item) => {
                  const selected = selectedKinds.includes(item.kind);
                  const shown = isKindShown(item.kind, selectedKinds);
                  return (
                    <button
                      key={item.kind}
                      type="button"
                      className={`${styles.floatingButton} ${
                        selected ? styles.floatingButtonActive : shown ? '' : styles.floatingButtonOff
                      }`}
                      onClick={() => toggleKind(item.kind)}
                      aria-pressed={selected}
                    >
                      <span className={`${styles.legendDot} ${styles[item.dotClass]}`} />
                      {item.label} <strong>{kindCounts[item.kind]}</strong>
                      {item.unit}
                    </button>
                  );
                })}
              </div>
              {locationError && <p className={styles.floatingError}>{locationError}</p>}
            </div>
          )}
          <Map
            center={{ lat: 36.5, lng: 127.8 }}
            level={INITIAL_MAP_LEVEL}
            style={{ width: '100%', height: '100%' }}
            onCreate={(map) => {
              mapRef.current = map;
              setMapReady(true);
              setZoomLevel(map.getLevel());
            }}
            onZoomChanged={(map) => setZoomLevel(map.getLevel())}
            // 사용자가 드래그하면 둘러보기 모드로 전환. 지도가 멈추면(idle) 그 화면 영역의 휴지통을 불러옴.
            // 둘러보기 중에는 확대/축소나 클러스터 클릭으로 화면이 바뀌어도 다시 불러옴
            onDragEnd={() => {
              browsingRef.current = true;
              setBrowsing(true);
            }}
            onIdle={(map) => {
              if (browsingRef.current) {
                loadBinsInView(map);
              } else if (!myLocation && !locating) {
                // 내 위치 없이 보는 중(위치 권한 거부, '지역별 보기')이면 배출 규칙을 보여줄 기본 지역을
                // 지도 중심으로 정함. 시/도 선택은 그대로 두어 지도가 다른 시/도로 튀지 않게 함
                const center = map.getCenter();
                updateRegionFromCoords(center.getLat(), center.getLng(), { syncSido: false });
              }
            }}
          >
            {myLocation && (
              <CustomOverlayMap position={{ lat: myLocation[0], lng: myLocation[1] }}>
                <div className={styles.myLocationDot} />
              </CustomOverlayMap>
            )}

            {isClustered
              ? clusters.map((cluster, idx) => (
                  <CustomOverlayMap
                    key={`${cluster.kind}-${idx}`}
                    position={{ lat: cluster.lat, lng: cluster.lng }}
                    clickable
                  >
                    <div
                      className={`${styles.clusterIcon} ${CLUSTER_CLASS[cluster.kind] || ''}`}
                      onClick={() => handleClusterClick(cluster)}
                    >
                      <span className={styles.clusterCount}>{cluster.count}</span>
                    </div>
                  </CustomOverlayMap>
                ))
              : visibleMarkers.map(({ item, kind }, idx) => {
                  const Icon = MARKER_ICONS[kind];
                  return (
                    <CustomOverlayMap
                      key={`${kind}-${idx}`}
                      position={{ lat: parseFloat(item.위도), lng: parseFloat(item.경도) }}
                      clickable
                      zIndex={KIND_ORDER[kind]}
                    >
                      <div
                        className={`${styles.binIcon} ${selectedBin === item ? styles.binIconSelected : ''}`}
                        onClick={() => {
                          setPickedRegion(null);
                          setSelectedBin(item);
                        }}
                      >
                        <Icon open={selectedBin === item} />
                      </div>
                    </CustomOverlayMap>
                  );
                })}
          </Map>
        </div>
      </div>

      {/* 모바일에서는 오른쪽 사이드바 대신 하단 슬라이드 패널(MobileBottomSheet)을 사용 */}
      {!isMobile && (
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
        <div className={styles.panelSearchArea}>
          <div className={scheduleStyles.searchCard}>{regionSearchRow}</div>
          {geocodeError && <div className={styles.errorText}>{geocodeError}</div>}
        </div>

        <div className={styles.panelResults}>
          {hasScheduleTarget && (
            <div className={styles.panelResultHeader}>
              <div>
                {/* 아무것도 고르지 않았을 때는 내 위치(또는 지도 중심) 지역 기준임을 표시 */}
                {!hasSelection && (
                  <span className={styles.autoRegionBadge}>{myLocation ? '내 위치 기준' : '지도 중심 기준'}</span>
                )}
                <h3 className={styles.panelTitle}>{sheetTitle}</h3>
              </div>
              {hasSelection && (
                <button
                  className={styles.closeButton}
                  onClick={() => {
                    setSelectedBin(null);
                    setPickedRegion(null);
                  }}
                  aria-label="선택 해제"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {/* 모바일 하단 패널과 같은 내용: 선택한 곳 정보 + 오늘 배출 / 전체 규칙 보기 / 품목 찾기 탭 */}
          <SchedulePanelContent {...schedulePanelProps} />
        </div>
        </div>
      </div>
      )}

      {isMobile && (
        <MobileBottomSheet
          title={sheetTitle}
          onClearSelection={() => {
            setSelectedBin(null);
            setPickedRegion(null);
          }}
          {...schedulePanelProps}
        />
      )}

      {showLocationPrompt && <LocationPermissionPrompt onAllow={handleAllowLocation} onSkip={handleSkipLocation} />}

      {reportTarget && (
        <ReportModal
          location={reportTarget.location}
          manager={reportTarget.manager}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

export default TrashMap;
