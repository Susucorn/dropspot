require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const trashbinData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'trashbin.json'), 'utf-8')
);

// 두 좌표 사이 거리(km) 계산 (하버사인 공식)
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
  const radius = parseFloat(req.query.radius) || 1; // 기본 1km

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

// 시도명 목록 (중복 제거 + 정렬)
const regions = [...new Set(trashbinData.records.map((r) => r.시도명))]
  .filter(Boolean)
  .sort();

app.get('/api/regions', (req, res) => {
  res.json(regions);
});

app.get('/api/trashbins', (req, res) => {
  const { sido } = req.query;
  if (!sido) {
    return res.json(trashbinData.records); // 전체 (마커 매우 많음 주의)
  }
  const filtered = trashbinData.records.filter((r) => r.시도명 === sido);
  res.json(filtered);
});

app.listen(process.env.PORT || 4000, () => {
  console.log('서버 실행 중: http://localhost:4000');
});