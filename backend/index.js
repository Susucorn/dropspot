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