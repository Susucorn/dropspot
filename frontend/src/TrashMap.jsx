import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// 지역 바뀔 때마다 지도를 해당 지역으로 자동 확대해주는 역할
function ChangeView({ bins }) {
  const map = useMap();
  useEffect(() => {
    if (bins.length > 0) {
      const bounds = bins.map((b) => [parseFloat(b.위도), parseFloat(b.경도)]);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [bins, map]);
  return null;
}

function TrashMap() {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('부산광역시');
  const [bins, setBins] = useState([]);

  // 지역 목록 불러오기 (최초 1회)
  useEffect(() => {
    fetch('http://localhost:4000/api/regions')
      .then((res) => res.json())
      .then(setRegions)
      .catch((err) => console.error(err));
  }, []);

  // 선택된 지역이 바뀔 때마다 해당 지역 휴지통 불러오기
  useEffect(() => {
    if (!selectedRegion) return;
    fetch(`http://localhost:4000/api/trashbins?sido=${encodeURIComponent(selectedRegion)}`)
      .then((res) => res.json())
      .then((data) => {
        const filtered = data.filter((item) => {
          const lat = parseFloat(item.위도);
          const lng = parseFloat(item.경도);
          return !isNaN(lat) && !isNaN(lng);
        });
        setBins(filtered);
      })
      .catch((err) => console.error(err));
  }, [selectedRegion]);

  return (
    <div>
      <div
        style={{
          position: 'absolute',
          zIndex: 1000,
          top: 10,
          left: 10,
          background: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: 8 }}>휴지통 {bins.length}개</span>
      </div>

      <MapContainer center={[36.5, 127.8]} zoom={7} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <ChangeView bins={bins} />
        {bins.map((bin, idx) => (
          <Marker key={idx} position={[parseFloat(bin.위도), parseFloat(bin.경도)]}>
            <Popup>
              <b>{bin.설치장소명 || '휴지통'}</b>
              <br />
              {bin.소재지도로명주소 || bin.소재지지번주소}
              <br />
              종류: {bin.휴지통종류}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default TrashMap;