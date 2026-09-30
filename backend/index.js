require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// ── 휴지통 데이터 (로컬 파일) ──────────────────────────────
const trashbinData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'trashbin.json'), 'utf-8')
);

const trashbinRegions = [...new Set(trashbinData.records.map((r) => r.시도명))]
  .filter(Boolean)
  .sort();

app.get('/api/regions', (req, res) => {
  res.json(trashbinRegions);
});

app.get('/api/trashbins', (req, res) => {
  const { sido } = req.query;
  if (!sido) return res.json(trashbinData.records);
  res.json(trashbinData.records.filter((r) => r.시도명 === sido));
});

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 지도 화면 영역(남서/북동 모서리 좌표) 안에 있는 항목만 골라냄. 영역 파라미터가 잘못되면 null
function filterInBounds(records, query) {
  const swLat = parseFloat(query.swLat);
  const swLng = parseFloat(query.swLng);
  const neLat = parseFloat(query.neLat);
  const neLng = parseFloat(query.neLng);
  if ([swLat, swLng, neLat, neLng].some(isNaN)) return null;

  return records.filter((r) => {
    const lat = parseFloat(r.위도);
    const lng = parseFloat(r.경도);
    return lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng;
  });
}

app.get('/api/trashbins/in-bounds', (req, res) => {
  const result = filterInBounds(trashbinData.records, req.query);
  if (!result) return res.status(400).json({ error: '지도 영역 정보가 필요합니다.' });
  res.json(result);
});

app.get('/api/trashbins/nearby', (req, res) => {
  const userLat = parseFloat(req.query.lat);
  const userLng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.radius) || 1;

  if (isNaN(userLat) || isNaN(userLng)) {
    return res.status(400).json({ error: '위치 정보가 필요합니다.' });
  }

  const nearby = trashbinData.records
    .map((r) => {
      const lat = parseFloat(r.위도);
      const lng = parseFloat(r.경도);
      if (isNaN(lat) || isNaN(lng)) return null;
      return { ...r, distance: getDistance(userLat, userLng, lat, lng) };
    })
    .filter((r) => r && r.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  res.json(nearby);
});

// ── 재활용센터 데이터 (전국재활용센터표준데이터 공공 API, 서버 시작 시 한 번만 불러와 캐싱) ──
// 휴지통 데이터와 같은 모양(위도/경도/시도명/시군구명)으로 정규화해서 프론트에서 같이 다룰 수 있게 함
let recyclingCenterData = [];

// 표준데이터 API는 항목명이 문서/버전마다 조금씩 달라서 후보 이름을 차례로 확인함
function pickField(item, candidates, pattern) {
  for (const key of candidates) {
    if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') {
      return String(item[key]).trim();
    }
  }
  if (pattern) {
    const key = Object.keys(item).find((k) => pattern.test(k) && String(item[k] ?? '').trim() !== '');
    if (key) return String(item[key]).trim();
  }
  return '';
}

function normalizeRecyclingCenter(item) {
  const 도로명주소 = pickField(item, ['rdnmadr', 'rdnmAdr', 'roadNmAddr']);
  const 지번주소 = pickField(item, ['lnmadr', 'lnmAdr', 'lotnoAddr']);
  const [시도명 = '', 시군구명 = ''] = (도로명주소 || 지번주소).split(/\s+/);
  return {
    시설구분: '재활용',
    시설명: pickField(item, ['ruseCnterNm', 'rcyclCnterNm', 'rcyclCntrNm', 'cnterNm'], /(Cnter|Cntr).*Nm$/i),
    소재지도로명주소: 도로명주소,
    소재지지번주소: 지번주소,
    위도: pickField(item, ['latitude', 'lat']),
    경도: pickField(item, ['longitude', 'lot', 'lng']),
    시도명,
    시군구명,
    전화번호: pickField(item, ['operPhoneNumber', 'phoneNumber'], /Telno$|phone/i),
    운영시간: formatHours(item.weekdayOperOpenHhmm, item.weekdayOperColseHhmm),
    휴일운영시간: formatHours(item.holidayOperOpenHhmm, item.holidayCloseOpenHhmm),
    휴무일: (item.rstdeInfo || '').split('+').filter(Boolean).join(', '),
    취급품목: (item.trtmntPrdlst || '').split('+').filter(Boolean).join(', '),
  };
}

function formatHours(open, close) {
  return open && close ? `${open} ~ ${close}` : '';
}

async function loadRecyclingCenterData() {
  // 공공데이터포털 인증키는 계정 단위라, 전용 키가 없으면 기존 키를 그대로 사용
  const serviceKey =
    process.env.RECYCLING_CENTER_SERVICE_KEY ||
    process.env.HOUSEHOLD_WASTE_SERVICE_KEY ||
    process.env.WASTE_ITEM_SERVICE_KEY;
  if (!serviceKey) {
    console.error('❌ 재활용센터 API 인증키가 .env에 없어요!');
    return;
  }

  const numOfRows = 1000;
  let pageNo = 1;
  let all = [];
  let totalCount = Infinity;

  while (all.length < totalCount) {
    const query = new URLSearchParams({
      serviceKey,
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
      type: 'json',
    });
    const response = await fetch(`https://api.data.go.kr/openapi/tn_pubr_public_ruse_cnter_api?${query}`);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('❌ 재활용센터 API 응답이 JSON이 아니에요:', text.slice(0, 300));
      break;
    }

    if (pageNo === 1) {
      console.log('🔍 재활용센터 API 응답 확인:', JSON.stringify(data).slice(0, 500));
    }

    // 이 API는 다른 공공 API와 달리 response 래퍼 없이 { header, body }를 바로 내려줌
    const root = data?.response ?? data;
    const body = root?.body;
    if (!body) {
      console.error('❌ 재활용센터 body가 없어요. 응답 헤더:', root?.header);
      break;
    }
    totalCount = Number(body.totalCount) || 0;
    // 표준데이터 API는 items가 바로 배열이지만, 다른 API처럼 items.item 형태일 수도 있어 둘 다 처리
    const rawItems = Array.isArray(body.items) ? body.items : body.items?.item || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];
    if (items.length === 0) break;
    all = all.concat(items);
    pageNo++;
  }

  recyclingCenterData = all
    .map(normalizeRecyclingCenter)
    .filter((r) => !isNaN(parseFloat(r.위도)) && !isNaN(parseFloat(r.경도)));
  console.log(`재활용센터 데이터 ${recyclingCenterData.length}건 로드 완료 (원본 ${all.length}건)`);
}

// 재활용센터·의류수거함처럼 서버에 캐싱해 둔 시설 데이터에 공통 조회 API 3개를 붙임
//   GET {basePath}?sido=        시도별
//   GET {basePath}/in-bounds    지도 화면 영역 안
//   GET {basePath}/nearby       좌표 기준 반경(km) 안 (가까운 순)
// getData는 요청 시점의 최신 캐시를 돌려주는 함수
function registerFacilityRoutes(basePath, getData, defaultRadiusKm) {
  app.get(basePath, (req, res) => {
    const { sido } = req.query;
    if (!sido) return res.json(getData());
    res.json(getData().filter((r) => r.시도명 === sido));
  });

  app.get(`${basePath}/in-bounds`, (req, res) => {
    const result = filterInBounds(getData(), req.query);
    if (!result) return res.status(400).json({ error: '지도 영역 정보가 필요합니다.' });
    res.json(result);
  });

  app.get(`${basePath}/nearby`, (req, res) => {
    const userLat = parseFloat(req.query.lat);
    const userLng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || defaultRadiusKm;

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ error: '위치 정보가 필요합니다.' });
    }

    const nearby = getData()
      .map((r) => ({ ...r, distance: getDistance(userLat, userLng, parseFloat(r.위도), parseFloat(r.경도)) }))
      .filter((r) => r.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    res.json(nearby);
  });
}

registerFacilityRoutes('/api/recycling-centers', () => recyclingCenterData, 5);

// ── 의류수거함 (전국의류수거함표준데이터 공공 API, 서버 시작 시 한 번만 불러와 캐싱) ──
let clothingBinData = [];

// 표준데이터의 시도명(ctpvNm)이 '전남광주통합특별시'처럼 휴지통 데이터·시도 선택 박스와 다를 수 있어서,
// 주소 첫 단어가 시/도 이름이면(예: "광주광역시 북구 ...") 그걸 우선 사용
function sidoFromAddress(address, fallback) {
  const first = (address || '').trim().split(/\s+/)[0] || '';
  return /(특별시|광역시|특별자치시|특별자치도|도)$/.test(first) ? first : fallback;
}

// '전남광주통합특별시'는 휴지통 데이터·시도 선택 박스에 없어서, 시군구로 광주광역시/전라남도를 나눔
const GWANGJU_DISTRICTS = ['동구', '서구', '남구', '북구', '광산구'];
function splitMergedSido(sido, sgg) {
  if (sido !== '전남광주통합특별시') return sido;
  return GWANGJU_DISTRICTS.includes(sgg) ? '광주광역시' : '전라남도';
}

function normalizeClothingBin(item) {
  const 도로명주소 = pickField(item, ['lctnRoadNmAddr']);
  const 지번주소 = pickField(item, ['lctnLotnoAddr']);
  const 시군구명 = pickField(item, ['sggNm']);
  const 시도명 = splitMergedSido(sidoFromAddress(도로명주소 || 지번주소, pickField(item, ['ctpvNm'])), 시군구명);
  return {
    시설구분: '의류수거함',
    시설명: pickField(item, ['instlPlcNm']),
    소재지도로명주소: 도로명주소,
    소재지지번주소: 지번주소,
    위도: pickField(item, ['lat']),
    경도: pickField(item, ['lot']),
    시도명,
    시군구명,
    세부위치: pickField(item, ['dtlPstn']),
    관리기관: pickField(item, ['mngInstNm']).split('+').filter(Boolean).join(', '),
    전화번호: pickField(item, ['mngInstTelno']),
  };
}

async function loadClothingBinData() {
  const serviceKey = process.env.HOUSEHOLD_WASTE_SERVICE_KEY;
  if (!serviceKey) {
    console.error('❌ 의류수거함 API 인증키(HOUSEHOLD_WASTE_SERVICE_KEY)가 .env에 없어요!');
    return;
  }

  const numOfRows = 1000;
  let pageNo = 1;
  let all = [];
  let totalCount = Infinity;

  while (all.length < totalCount) {
    const query = new URLSearchParams({ serviceKey, pageNo: String(pageNo), numOfRows: String(numOfRows), type: 'json' });
    const response = await fetch(`https://api.data.go.kr/openapi/tn_pubr_public_clothing_collect_bins_api?${query}`);
    const data = await response.json().catch(() => null);
    // 이 API도 재활용센터 API처럼 response 래퍼 없이 { header, body }를 바로 내려줌
    const body = (data?.response ?? data)?.body;
    if (!body) {
      console.error('❌ 의류수거함 응답 형식이 달라요:', JSON.stringify(data).slice(0, 300));
      break;
    }
    totalCount = Number(body.totalCount) || 0;
    const rawItems = Array.isArray(body.items) ? body.items : body.items?.item || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];
    if (items.length === 0) break;
    all = all.concat(items);
    pageNo++;
  }

  clothingBinData = all
    .map(normalizeClothingBin)
    .filter((r) => !isNaN(parseFloat(r.위도)) && !isNaN(parseFloat(r.경도)));
  console.log(`의류수거함 데이터 ${clothingBinData.length}건 로드 완료 (원본 ${all.length}건)`);
}

registerFacilityRoutes('/api/clothing-bins', () => clothingBinData, 3);

// ── 배출 규칙 데이터 (공공 API, 서버 시작 시 한 번만 불러와 캐싱) ──
let wasteScheduleData = [];

async function loadWasteScheduleData() {
  const serviceKey = process.env.HOUSEHOLD_WASTE_SERVICE_KEY;
  if (!serviceKey) {
    console.error('❌ HOUSEHOLD_WASTE_SERVICE_KEY가 .env에 없어요!');
    return;
  }

  const numOfRows = 1000;
  let pageNo = 1;
  let all = [];
  let totalCount = Infinity;

  while (all.length < totalCount) {
    const url = `https://apis.data.go.kr/1741000/household_waste_info/info?serviceKey=${encodeURIComponent(
      serviceKey
    )}&pageNo=${pageNo}&numOfRows=${numOfRows}&returnType=json`;

    const response = await fetch(url);
    const data = await response.json();

    if (pageNo === 1) {
      console.log('🔍 배출정보 API 응답 확인:', JSON.stringify(data).slice(0, 500));
    }

    const body = data?.response?.body;
    if (!body) {
      console.error('❌ body가 없어요. 응답 헤더:', data?.response?.header);
      break;
    }
    totalCount = body.totalCount;
    const items = body.items?.item || [];
    if (items.length === 0) break;
    all = all.concat(items);
    pageNo++;
  }

  wasteScheduleData = all;
  console.log(`배출 규칙 데이터 ${wasteScheduleData.length}건 로드 완료`);
}

function isValidRegionText(text) {
  return Boolean(text) && text !== '해당없음' && text !== '없음';
}

// MNG_ZONE_TRGT_RGN_NM은 지역마다 구분자가 "+" 또는 ","로 다르고, 괄호 안에도
// ","가 섞여있어(예: "석남1동(456~467, 480~484)") 괄호 밖의 구분자만 기준으로 쪼갬
function splitZoneNames(text) {
  const zones = [];
  let current = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);

    if ((ch === '+' || ch === ',') && depth === 0) {
      zones.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) zones.push(current);
  return zones.map((z) => z.trim()).filter(Boolean);
}

// "석남1동(456~467, 480~484)" -> "석남1동" 처럼 끝에 붙은 부연설명 괄호를 제거
function normalizeZoneName(zone) {
  let name = zone.trim();
  while (/\([^()]*\)\s*$/.test(name)) {
    name = name.replace(/\s*\([^()]*\)\s*$/, '').trim();
  }
  return name;
}

// 관리구역 칸에 구역 이름 대신 배출 방법 설명문이 통째로 들어간 경우 (원본 데이터 입력 오류)
// 예: 대구 북구 "북구 전역(배출방법) 1. 스티커 구입하여 ... (여기로, www.yeogiro24.co.kr) ..."
// 주소(URL)·전화번호·"1. " 같은 번호 매기기가 있거나 너무 길면 설명문으로 봄
function isDescriptiveZoneName(name) {
  return name.length > 40 || /https?:|www\.|\d{2,4}-\d{3,4}|(^|\s)\d+\.\s/.test(name);
}

// { 시도: { 시군구: [동/읍/면, ...] } } 형태로 응답 (동 정보는 MNG_ZONE_TRGT_RGN_NM을 펼쳐 수집).
// 설명문형 구역 이름은 지역 검색 자동완성에 나오지 않도록 제외
app.get('/api/waste-schedule/regions', (req, res) => {
  const map = {};
  wasteScheduleData.forEach((r) => {
    if (!r.CTPV_NM || !r.SGG_NM) return;
    if (!map[r.CTPV_NM]) map[r.CTPV_NM] = {};
    if (!map[r.CTPV_NM][r.SGG_NM]) map[r.CTPV_NM][r.SGG_NM] = new Set();
    if (isValidRegionText(r.MNG_ZONE_TRGT_RGN_NM)) {
      splitZoneNames(r.MNG_ZONE_TRGT_RGN_NM).forEach((zone) => {
        const cleaned = normalizeZoneName(zone);
        if (cleaned && !isDescriptiveZoneName(cleaned)) map[r.CTPV_NM][r.SGG_NM].add(cleaned);
      });
    }
  });

  const result = Object.fromEntries(
    Object.entries(map).map(([ctpv, sggMap]) => [
      ctpv,
      Object.fromEntries(
        Object.entries(sggMap).map(([sgg, dongs]) => [sgg, [...dongs].sort()])
      ),
    ])
  );
  res.json(result);
});

// 휴지통/재활용센터 데이터와 배출 규칙 데이터의 시도명이 다른 경우 (행정구역 통합·명칭 변경, 오타)
// 예: 휴지통 데이터는 "광주광역시"/"전라남도"인데 배출 규칙 데이터는 "전남광주통합특별시"
const CTPV_ALIASES = {
  광주광역시: ['전남광주통합특별시'],
  전라남도: ['전남광주통합특별시'],
  전라북도: ['전북특별자치도'],
  강원도: ['강원특별자치도'],
  서을특별시: ['서울특별시'],
};

// 시군구명 비교용: "동두천시"와 "동두천", "창원시 의창구"와 "창원시"처럼 표기가 달라도 같은 곳으로 봄
function normalizeSggName(name) {
  return (name || '').trim().split(/\s+/)[0].replace(/시$/, '');
}

function findScheduleRecords(ctpv, sgg) {
  const ctpvCandidates = [ctpv, ...(CTPV_ALIASES[ctpv] || [])];
  for (const c of ctpvCandidates) {
    const inCtpv = wasteScheduleData.filter((r) => r.CTPV_NM === c);
    const exact = inCtpv.filter((r) => r.SGG_NM === sgg);
    if (exact.length > 0) return exact;
    const normalized = normalizeSggName(sgg);
    const loose = inCtpv.filter((r) => normalizeSggName(r.SGG_NM) === normalized);
    if (loose.length > 0) return loose;
  }
  return [];
}

app.get('/api/waste-schedule', (req, res) => {
  const { ctpv, sgg } = req.query;
  if (!ctpv || !sgg) {
    return res.status(400).json({ error: '시도와 시군구를 선택해주세요.' });
  }
  res.json(findScheduleRecords(ctpv, sgg));
});

// ── 분리배출 정보조회 서비스 (기후에너지환경부, 실시간 프록시) ──
const WASTE_ITEM_BASE_URL = 'https://apis.data.go.kr/1482000/WasteRecyclingService';

async function callWasteRecyclingApi(operation, params) {
  const serviceKey = process.env.WASTE_ITEM_SERVICE_KEY;
  if (!serviceKey) {
    throw Object.assign(new Error('WASTE_ITEM_SERVICE_KEY가 .env에 없어요!'), { status: 500 });
  }

  const query = new URLSearchParams({
    serviceKey,
    pageNo: '1',
    numOfRows: '20',
    returnType: 'json',
    ...params,
  });
  const response = await fetch(`${WASTE_ITEM_BASE_URL}/${operation}?${query.toString()}`);
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // XML 오류 응답 등은 아래에서 원문 일부를 로그로 남김
  }

  const header = data?.response?.header;
  if (!header || (header.resultCode !== '00' && header.resultCode !== '03')) {
    // 인증키 오류는 { OpenAPI_ServiceResponse: { cmmMsgHeader: { returnAuthMsg } } } 형태로 옴
    const authMsg = data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg;
    const reason = header?.resultMsg || authMsg || `HTTP ${response.status}`;
    console.error(`❌ 분리배출 정보조회 실패 (${reason}):`, text.slice(0, 200));
    throw Object.assign(new Error(`분리배출 정보를 불러오지 못했어요. (${reason})`), { status: 502 });
  }

  const items = data.response.body?.items?.item || [];
  return Array.isArray(items) ? items : [items];
}

// 배출품목 정보 조회: 품목명으로 배출방법 검색
app.get('/api/waste-items', async (req, res) => {
  const itemNm = (req.query.itemNm || '').trim();
  if (!itemNm) {
    return res.status(400).json({ error: '품목명을 입력해주세요.' });
  }

  try {
    const items = await callWasteRecyclingApi('getItem', { itemNm });
    res.json(items);
  } catch (err) {
    console.error('배출품목 조회 실패:', err);
    res.status(err.status || 502).json({ error: err.message });
  }
});

// 분리배출 장소정보 조회: 동 이름으로 배출 장소 검색
app.get('/api/waste-spots', async (req, res) => {
  const addr = (req.query.addr || '').trim();
  if (!addr) {
    return res.status(400).json({ error: '동 이름을 입력해주세요.' });
  }

  try {
    const spots = await callWasteRecyclingApi('getSpot', { addr });
    res.json(spots);
  } catch (err) {
    console.error('분리배출 장소 조회 실패:', err);
    res.status(err.status || 502).json({ error: err.message });
  }
});

// ── 구청별 공공쓰레기통 현황 (공공데이터포털 파일데이터 자동변환 API, 서버 시작 시 캐싱) ──
// 좌표가 없어서 좌표 변환은 프론트에서 카카오로 함 (주소가 있으면 주소 검색, 없으면 장소명 검색).
// 컬럼 이름이 구청마다 달라서 { 위치명, 도로명주소, 지번주소, 종류, 설치대수 }로 맞춰서 내려줌.
// 새 구청 데이터를 추가하려면 이 목록에 항목만 추가하면 됨
// (공공데이터포털에서 해당 데이터 '활용신청'을 해야 같은 인증키로 호출 가능)
const DISTRICT_TRASHBIN_SOURCES = [
  {
    id: 'busan-namgu',
    name: '부산광역시 남구 공공쓰레기통 현황',
    sido: '부산광역시',
    sgg: '남구',
    url: 'https://api.odcloud.kr/api/15087700/v1/uddi:4116126b-1692-4d6f-8bc4-b935aedc0992', // 20251211
  },
  {
    id: 'daegu-donggu',
    name: '대구광역시 동구 가로 쓰레기통 설치현황',
    sido: '대구광역시',
    sgg: '동구',
    url: 'https://api.odcloud.kr/api/15127640/v1/uddi:7e8c7561-a6b0-4a34-b86d-a282f1427a2c', // 20250519
  },
  {
    // 위도/경도가 들어 있어 좌표 변환 없이 바로 표시. 시군구명은 행마다 "고양시 덕양구"처럼 구까지 들어옴
    id: 'goyang',
    name: '경기도 고양시 가로변 쓰레기통 현황',
    sido: '경기도',
    sgg: '고양시',
    url: 'https://api.odcloud.kr/api/15087918/v1/uddi:c29ea3d0-c314-463b-805f-908650a55db6', // 20250224
  },
  {
    // 데이터 이름은 '전남광주통합특별시'지만 주소와 기존 휴지통 데이터·시도 선택 박스가 '광주광역시'라서 맞춤.
    // 2022년 데이터라 대부분 기존 휴지통 데이터(2026년)에 이미 들어 있음 → 아래 중복 제거로 걸러짐
    id: 'gwangju-gwangsan',
    name: '전남광주통합특별시 광산구 쓰레기통 현황',
    sido: '광주광역시',
    sgg: '광산구',
    url: 'https://api.odcloud.kr/api/15108027/v1/uddi:bb55f6e7-6040-4009-ae66-b7067e20d819', // 20221110
  },
];
// 좌표가 있는 구청 데이터 중, 기존 휴지통 데이터와 이 거리(km) 안에 겹치는 항목은 같은 쓰레기통으로 보고 제외
const DUPLICATE_DISTANCE_KM = 0.015;
const districtTrashbinData = {}; // { [source.id]: 정규화된 항목 배열 }

// 좌표(위도/경도), 행별 시군구명, 관리기관/전화번호는 데이터에 있을 때만 채워짐 (없으면 빈 문자열)
function normalizeDistrictTrashbin(row) {
  return {
    위치명: pickField(row, ['위치명', '위치', '설치위치', '세부위치', '설치장소']),
    도로명주소: pickField(row, ['설치위치 도로명주소', '도로명주소']),
    지번주소: pickField(row, ['설치위치 지번주소', '지번주소', '설치주소']),
    종류: pickField(row, ['종류', '쓰레기통종류']),
    설치대수: Number(pickField(row, ['설치대수', '설치 개수', '설치개수'], /설치.*(대수|개수)/)) || 1,
    위도: pickField(row, ['위도']),
    경도: pickField(row, ['경도']),
    시군구명: pickField(row, ['시군구명']),
    관리기관: pickField(row, ['관리기관', '관리기관명']),
    전화번호: pickField(row, ['전화번호', '관리기관전화번호']),
  };
}

async function loadDistrictTrashbinSource(source) {
  const serviceKey = process.env.HOUSEHOLD_WASTE_SERVICE_KEY;
  if (!serviceKey) throw new Error('HOUSEHOLD_WASTE_SERVICE_KEY가 .env에 없어요!');
  const query = new URLSearchParams({ serviceKey, page: '1', perPage: '1000', returnType: 'JSON' });
  const response = await fetch(`${source.url}?${query}`);
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.data)) {
    const hint = response.status === 401 ? ' (공공데이터포털에서 이 데이터 활용신청이 필요해요)' : '';
    throw new Error(`응답 오류 ${response.status}${hint}: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const rows = data.data.map(normalizeDistrictTrashbin).filter((r) => r.위치명 || r.도로명주소 || r.지번주소);
  const unique = rows.filter((r) => !isDuplicateOfTrashbin(r));
  districtTrashbinData[source.id] = unique;
  const skipped = rows.length - unique.length;
  console.log(
    `${source.name} ${unique.length}건 로드 완료${skipped ? ` (기존 휴지통 데이터와 겹치는 ${skipped}건 제외)` : ''}`
  );
}

// 좌표가 있는 항목이 기존 휴지통 데이터(trashbin.json)의 쓰레기통과 같은 곳인지 (좌표가 없으면 판단 불가 → false)
function isDuplicateOfTrashbin(row) {
  const lat = parseFloat(row.위도);
  const lng = parseFloat(row.경도);
  if (isNaN(lat) || isNaN(lng)) return false;
  return trashbinData.records.some((r) => {
    const rLat = parseFloat(r.위도);
    const rLng = parseFloat(r.경도);
    return !isNaN(rLat) && !isNaN(rLng) && getDistance(lat, lng, rLat, rLng) <= DUPLICATE_DISTANCE_KM;
  });
}

// 한 곳이 실패해도(예: 활용신청 전) 나머지 구청 데이터는 계속 불러옴
async function loadDistrictTrashbinData() {
  await Promise.all(
    DISTRICT_TRASHBIN_SOURCES.map((source) =>
      loadDistrictTrashbinSource(source).catch((err) => console.error(`❌ ${source.name} 로드 실패:`, err.message))
    )
  );
}

app.get('/api/district-trashbins', (req, res) => {
  res.json(
    DISTRICT_TRASHBIN_SOURCES.filter((s) => districtTrashbinData[s.id]).map((s) => ({
      source: s.name,
      sido: s.sido,
      sgg: s.sgg,
      records: districtTrashbinData[s.id],
    }))
  );
});

// ── 쓰레기통 신고 접수 (사진은 base64로 받아 파일로 저장, 신고 내용은 JSON 파일에 누적) ──
const REPORT_STATUSES = ['파손', '없음', '이동됨', '가득 참', '오염', '기타'];
const REPORT_MAX_PHOTOS = 3;
const REPORT_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const REPORTS_FILE = path.join(__dirname, 'data', 'reports.json');
const REPORT_UPLOAD_DIR = path.join(__dirname, 'uploads', 'reports');
const PHOTO_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function readReports() {
  if (!fs.existsSync(REPORTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8'));
}

// "data:image/png;base64,...." 형태의 사진을 검사해서 { ext, buffer }로 변환. 형식이 잘못되면 에러
function decodePhoto(dataUrl) {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl || '');
  const ext = match && PHOTO_EXTENSIONS[match[1]];
  if (!ext) throw Object.assign(new Error('사진은 JPG, PNG, WEBP, GIF만 첨부할 수 있어요.'), { status: 400 });
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > REPORT_MAX_PHOTO_BYTES) {
    throw Object.assign(new Error('사진 한 장은 5MB 이하만 첨부할 수 있어요.'), { status: 400 });
  }
  return { ext, buffer };
}

app.post('/api/reports', express.json({ limit: '25mb' }), (req, res) => {
  const { status, memo = '', location = {}, manager = {}, photos = [] } = req.body || {};

  if (!REPORT_STATUSES.includes(status)) {
    return res.status(400).json({ error: '쓰레기통 상태를 선택해주세요.' });
  }
  if (!location.address && !location.name) {
    return res.status(400).json({ error: '신고 위치 정보가 필요해요.' });
  }
  if (!Array.isArray(photos) || photos.length > REPORT_MAX_PHOTOS) {
    return res.status(400).json({ error: `사진은 최대 ${REPORT_MAX_PHOTOS}장까지 첨부할 수 있어요.` });
  }

  try {
    // 사진을 모두 검사한 뒤에 저장해서, 중간에 실패하면 파일이 남지 않게 함
    const decoded = photos.map(decodePhoto);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    fs.mkdirSync(REPORT_UPLOAD_DIR, { recursive: true });
    const photoFiles = decoded.map(({ ext, buffer }, i) => {
      const fileName = `${id}-${i + 1}.${ext}`;
      fs.writeFileSync(path.join(REPORT_UPLOAD_DIR, fileName), buffer);
      return `uploads/reports/${fileName}`;
    });

    const report = {
      id,
      createdAt: new Date().toISOString(),
      status,
      memo: String(memo).slice(0, 500),
      location: {
        name: String(location.name || ''),
        address: String(location.address || ''),
        region: String(location.region || ''),
        lat: Number(location.lat) || null,
        lng: Number(location.lng) || null,
      },
      manager: { name: String(manager.name || ''), tel: String(manager.tel || '') },
      photos: photoFiles,
    };

    const reports = readReports();
    reports.push(report);
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
    console.log(`🚩 쓰레기통 신고 접수: [${status}] ${report.location.name || report.location.address}`);
    res.status(201).json({ id });
  } catch (err) {
    console.error('신고 저장 실패:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : '신고를 저장하지 못했어요.' });
  }
});

// ── 서버 시작: 배출 규칙 + 재활용센터 데이터 로드 후 실행 (몇 초 걸릴 수 있어요) ──
Promise.all([
  loadWasteScheduleData().catch((err) => console.error('배출 규칙 데이터 로드 실패:', err)),
  loadRecyclingCenterData().catch((err) => console.error('재활용센터 데이터 로드 실패:', err)),
  loadDistrictTrashbinData().catch((err) => console.error('구청별 공공쓰레기통 데이터 로드 실패:', err)),
  loadClothingBinData().catch((err) => console.error('의류수거함 데이터 로드 실패:', err)),
])
  .finally(() => {
    app.listen(process.env.PORT || 4000, () => {
      console.log('서버 실행 중: http://localhost:4000');
    });
  });
