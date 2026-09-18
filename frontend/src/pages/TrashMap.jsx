import { useEffect, useRef, useState } from 'react';
import { Map, MapMarker, CustomOverlayMap, useKakaoLoader } from 'react-kakao-maps-sdk';
import styles from '../styles/TrashMap.module.css';
import { fetchRegions, fetchTrashbinsByRegion, fetchNearbyTrashbins } from '../api/trashbinApi';
import { filterValidBins } from '../utils/trashbinUtils';
import { fitBoundsToBins, centerMapOnLocation } from '../utils/kakaoMapUtils';
import { getCurrentLocation } from '../utils/geolocation';

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
    fetchRegions().then(setRegions).catch(console.error);
  }, []);

  useEffect(() => {
    if (myLocation) return;
    fetchTrashbinsByRegion(selectedRegion)
      .then((data) => setBins(filterValidBins(data)))
      .catch(console.error);
  }, [selectedRegion, myLocation]);

  useEffect(() => {
    if (!mapRef.current || loading) return;

    if (myLocation) {
      centerMapOnLocation(mapRef.current, myLocation, 4);
    } else if (bins.length > 0) {
      fitBoundsToBins(mapRef.current, bins);
    }
  }, [bins, myLocation, loading]);

  const findMyLocation = () => {
    setLocationError('');
    setLocating(true);
    getCurrentLocation()
      .then((location) => {
        setMyLocation(location);
        setLocating(false);
        return fetchNearbyTrashbins(location[0], location[1], 1);
      })
      .then(setBins)
      .catch((err) => {
        setLocationError(`위치 정보를 가져오지 못했어요 (${err.message})`);
        setLocating(false);
      });
  };

  if (loading) return <div>지도를 불러오는 중...</div>;
  if (error) return <div>지도를 불러오지 못했어요. 카카오 앱 키/도메인 등록을 확인해주세요.</div>;

  return (
    <div>
      <div className={styles.controlPanel}>
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
        <button className={styles.button} onClick={findMyLocation} disabled={locating}>
          {locating ? '위치 찾는 중...' : '내 위치 주변 보기'}
        </button>
        {myLocation && (
          <button className={styles.button} onClick={() => setMyLocation(null)}>
            지역별로 보기
          </button>
        )}
        <div>휴지통 {bins.length}개</div>
        {locationError && <div className={styles.errorText}>{locationError}</div>}
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
            <div className={styles.myLocationDot} />
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
            <div className={styles.popup}>
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
              <button onClick={() => setSelectedBin(null)}>닫기</button>
            </div>
          </CustomOverlayMap>
        )}
      </Map>
    </div>
  );
}

export default TrashMap;