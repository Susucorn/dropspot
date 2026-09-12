import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 내 위치 전용 아이콘 (파란 동그라미) — 이미지 파일 없이 만들어서 안 깨짐
const myLocationIcon = new L.DivIcon({
  className: 'my-location-marker',
  html: '<div style="background:#4285F4;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ChangeView({ bins, myLocation }) {
  const map = useMap();
  useEffect(() => {
    if (myLocation) {
      map.setView(myLocation, 16);
    } else if (bins.length > 0) {
      const bounds = bins.map((b) => [parseFloat(b.위도), parseFloat(b.경도)]);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [bins, myLocation, map]);
  return null;
}

function TrashMap() {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('부산광역시');
  const [bins, setBins] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    fetch('http://localhost:4000/api/regions')
      .then((res) => res.json())
      .then(setRegions)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (myLocation) return;
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
      .catch(console.error);
  }, [selectedRegion, myLocation]);

  const findMyLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('이 브라우저는 위치 정보를 지원하지 않아요.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log('내 위치:', latitude, longitude);
        setMyLocation([latitude, longitude]);
        setLocating(false);
        fetch(`http://localhost:4000/api/trashbins/nearby?lat=${latitude}&lng=${longitude}&radius=1`)
          .then((res) => res.json())
          .then(setBins)
          .catch(console.error);
      },
      (err) => {
        console.error('위치 가져오기 실패:', err);
        setLocationError(`위치 정보를 가져오지 못했어요 (${err.message})`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
          maxWidth: 280,
        }}
      >
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
        <button onClick={findMyLocation} style={{ marginLeft: 8 }} disabled={locating}>
          {locating ? '위치 찾는 중...' : '내 위치 주변 보기'}
        </button>
        {myLocation && (
          <button onClick={() => setMyLocation(null)} style={{ marginLeft: 8 }}>
            지역별로 보기
          </button>
        )}
        <div>휴지통 {bins.length}개</div>
        {locationError && <div style={{ color: 'red', marginTop: 4 }}>{locationError}</div>}
      </div>

      <MapContainer center={[36.5, 127.8]} zoom={7} style={{ height: '100vh', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <ChangeView bins={bins} myLocation={myLocation} />
        {myLocation && (
          <Marker position={myLocation} icon={myLocationIcon}>
            <Popup>내 위치</Popup>
          </Marker>
        )}
        {bins.map((bin, idx) => (
          <Marker key={idx} position={[parseFloat(bin.위도), parseFloat(bin.경도)]}>
            <Popup>
              <b>{bin.설치장소명 || '휴지통'}</b>
              <br />
              {bin.소재지도로명주소 || bin.소재지지번주소}
              <br />
              종류: {bin.휴지통종류}
              {bin.distance !== undefined && (
                <>
                  <br />
                  거리: 약 {(bin.distance * 1000).toFixed(0)}m
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default TrashMap;