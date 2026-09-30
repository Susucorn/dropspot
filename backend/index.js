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

app.get('/api/recycling-centers', (req, res) => {
  const { sido } = req.query;
  if (!sido) return res.json(recyclingCenterData);
  res.json(recyclingCenterData.filter((r) => r.시도명 === sido));
});

app.get('/api/recycling-centers/in-bounds', (req, res) => {
  const result = filterInBounds(recyclingCenterData, req.query);
  if (!result) return res.status(400).json({ error: '지도 영역 정보가 필요합니다.' });
  res.json(result);
});

app.get('/api/recycling-centers/nearby', (req, res) => {
  const userLat = parseFloat(req.query.lat);
  const userLng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.radius) || 5;

  if (isNaN(userLat) || isNaN(userLng)) {
    return res.status(400).json({ error: '위치 정보가 필요합니다.' });
  }

  const nearby = recyclingCenterData
    .map((r) => ({ ...r, distance: getDistance(userLat, userLng, parseFloat(r.위도), parseFloat(r.경도)) }))
    .filter((r) => r.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  res.json(nearby);
});

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

// { 시도: { 시군구: [동/읍/면, ...] } } 형태로 응답 (동 정보는 MNG_ZONE_TRGT_RGN_NM을 펼쳐 수집)
app.get('/api/waste-schedule/regions', (req, res) => {
  const map = {};
  wasteScheduleData.forEach((r) => {
    if (!r.CTPV_NM || !r.SGG_NM) return;
    if (!map[r.CTPV_NM]) map[r.CTPV_NM] = {};
    if (!map[r.CTPV_NM][r.SGG_NM]) map[r.CTPV_NM][r.SGG_NM] = new Set();
    if (isValidRegionText(r.MNG_ZONE_TRGT_RGN_NM)) {
      splitZoneNames(r.MNG_ZONE_TRGT_RGN_NM).forEach((zone) => {
        const cleaned = normalizeZoneName(zone);
        if (cleaned) map[r.CTPV_NM][r.SGG_NM].add(cleaned);
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
  const data = await response.json();

  const header = data?.response?.header;
  if (!header || (header.resultCode !== '00' && header.resultCode !== '03')) {
    throw Object.assign(new Error(header?.resultMsg || '분리배출 정보를 불러오지 못했어요.'), {
      status: 502,
    });
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

// ── 서버 시작: 배출 규칙 + 재활용센터 데이터 로드 후 실행 (몇 초 걸릴 수 있어요) ──
Promise.all([
  loadWasteScheduleData().catch((err) => console.error('배출 규칙 데이터 로드 실패:', err)),
  loadRecyclingCenterData().catch((err) => console.error('재활용센터 데이터 로드 실패:', err)),
])
  .finally(() => {
    app.listen(process.env.PORT || 4000, () => {
      console.log('서버 실행 중: http://localhost:4000');
    });
  });
