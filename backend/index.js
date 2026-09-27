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

app.get('/api/waste-schedule', (req, res) => {
  const { ctpv, sgg } = req.query;
  if (!ctpv || !sgg) {
    return res.status(400).json({ error: '시도와 시군구를 선택해주세요.' });
  }
  const matched = wasteScheduleData.filter((r) => r.CTPV_NM === ctpv && r.SGG_NM === sgg);
  res.json(matched);
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

// ── 서버 시작: 배출 규칙 데이터 로드 후 실행 (몇 초 걸릴 수 있어요) ──
loadWasteScheduleData()
  .catch((err) => console.error('배출 규칙 데이터 로드 실패:', err))
  .finally(() => {
    app.listen(process.env.PORT || 4000, () => {
      console.log('서버 실행 중: http://localhost:4000');
    });
  });
