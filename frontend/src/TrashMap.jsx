import { useEffect, useRef, useState } from 'react';
import { Map, MapMarker, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';

function TrashMap() {
  const [loading, error] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
  });

  const mapRef = useRef(null);
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('부산광역시');
  const [bins, setBins] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedBin, setSelectedBin] = useState(null);

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

  // 지도 중심/확대 이동
  useEffect(() => {
    if (!mapRef.current || loading) return;
    const kakao = window.kakao;

    if (myLocation) {
      mapRef.current.setCenter(new kakao.maps.LatLng(myLocation[0], myLocation[1]));
      mapRef.current.setLevel(4);
    } else if (bins.length > 0) {
      const bounds = new kakao.maps.LatLngBounds();
      bins.forEach((b) => {
        bounds.extend(new kakao.maps.LatLng(parseFloat(b.위도), parseFloat(b.경도)));
      });
      mapRef.current.setBounds(bounds);
    }
  }, [bins, myLocation, loading]);

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
        setMyLocation([latitude, longitude]);
        setLocating(false);
        fetch(`http://localhost:4000/api/trashbins/nearby?lat=${latitude}&lng=${longitude}&radius=1`)
          .then((res) => res.json())
          .then(setBins)
          .catch(console.error);
      },
      (err) => {
        setLocationError(`위치 정보를 가져오지 못했어요 (${err.message})`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loading) return <div>지도를 불러오는 중...</div>;
  if (error) return <div>지도를 불러오지 못했어요. 카카오 앱 키/도메인 등록을 확인해주세요.</div>;

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

      <Map
        center={{ lat: 36.5, lng: 127.8 }}
        level={13}
        style={{ width: '100%', height: '100vh' }}
        onCreate={(map) => {
          mapRef.current = map;
        }}
      >
        {myLocation && (
          <CustomOverlayMap position={{ lat: myLocation[0], lng: myLocation[1] }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#4285F4',
                border: '3px solid white',
                boxShadow: '0 0 6px rgba(0,0,0,0.5)',
              }}
            />
          </CustomOverlayMap>
        )}

        {bins.map((bin, idx) => (
          <MapMarker
            key={idx}
            position={{ lat: parseFloat(bin.위도), lng: parseFloat(bin.경도) }}
            onClick={() => setSelectedBin(bin)}
          />
        ))}

        {selectedBin && (
          <CustomOverlayMap
            position={{ lat: parseFloat(selectedBin.위도), lng: parseFloat(selectedBin.경도) }}
            yAnchor={1.4}
          >
            <div
              style={{
                background: 'white',
                padding: '8px 10px',
                borderRadius: 6,
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                fontSize: 13,
                minWidth: 160,
              }}
            >
              <b>{selectedBin.설치장소명 || '휴지통'}</b>
              <br />
              {selectedBin.소재지도로명주소 || selectedBin.소재지지번주소}
              <br />
              종류: {selectedBin.휴지통종류}
              {selectedBin.distance !== undefined && (
                <>
                  <br />
                  거리: 약 {(selectedBin.distance * 1000).toFixed(0)}m
                </>
              )}
              <br />
              <button onClick={() => setSelectedBin(null)} style={{ marginTop: 4 }}>
                닫기
              </button>
            </div>
          </CustomOverlayMap>
        )}
      </Map>
    </div>
  );
}

export default TrashMap;