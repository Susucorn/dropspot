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

app.get('/api/waste-schedule/regions', (req, res) => {
  const map = {};
  wasteScheduleData.forEach((r) => {
    if (!r.CTPV_NM) return;
    if (!map[r.CTPV_NM]) map[r.CTPV_NM] = new Set();
    if (r.SGG_NM) map[r.CTPV_NM].add(r.SGG_NM);
  });
  const result = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()]));
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

// ── 서버 시작: 배출 규칙 데이터 로드 후 실행 (몇 초 걸릴 수 있어요) ──
loadWasteScheduleData()
  .catch((err) => console.error('배출 규칙 데이터 로드 실패:', err))
  .finally(() => {
    app.listen(process.env.PORT || 4000, () => {
      console.log('서버 실행 중: http://localhost:4000');
    });
  });