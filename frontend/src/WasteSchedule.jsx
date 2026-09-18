import { useEffect, useState } from 'react';

function WasteSchedule() {
  const [regionMap, setRegionMap] = useState({});
  const [ctpv, setCtpv] = useState('');
  const [sgg, setSgg] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('http://localhost:4000/api/waste-schedule/regions')
      .then((res) => res.json())
      .then((data) => {
        setRegionMap(data);
        const firstCtpv = Object.keys(data)[0];
        if (firstCtpv) {
          setCtpv(firstCtpv);
          setSgg(data[firstCtpv][0] || '');
        }
      })
      .catch(() => setError('지역 목록을 불러오지 못했어요.'));
  }, []);

  useEffect(() => {
    if (!ctpv || !sgg) return;
    setLoading(true);
    setError('');
    fetch(`http://localhost:4000/api/waste-schedule?ctpv=${encodeURIComponent(ctpv)}&sgg=${encodeURIComponent(sgg)}`)
      .then((res) => res.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('배출 정보를 불러오지 못했어요.');
        setLoading(false);
      });
  }, [ctpv, sgg]);

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: '0 auto' }}>
      <h2>우리 동네 배출 규칙 안내</h2>

      <div style={{ marginBottom: 16 }}>
        <select
          value={ctpv}
          onChange={(e) => {
            const newCtpv = e.target.value;
            setCtpv(newCtpv);
            setSgg(regionMap[newCtpv]?.[0] || '');
          }}
        >
          {Object.keys(regionMap).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={sgg} onChange={(e) => setSgg(e.target.value)} style={{ marginLeft: 8 }}>
          {(regionMap[ctpv] || []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && results.length === 0 && <p>해당 지역 정보가 없어요.</p>}

      {results.map((r, idx) => (
        <div key={idx} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          {r.MNG_ZONE_TRGT_RGN_NM && r.MNG_ZONE_TRGT_RGN_NM !== '없음' && (
            <p style={{ fontWeight: 'bold', marginBottom: 8 }}>{r.MNG_ZONE_TRGT_RGN_NM}</p>
          )}
          <p>
            <b>음식물쓰레기</b> — {r.FOD_WST_EMSN_DOW || '정보 없음'} / {r.FOD_WST_EMSN_BGNG_TM}~{r.FOD_WST_EMSN_END_TM}
            <br />
            {r.FOD_WST_EMSN_MTHD}
          </p>
          <p>
            <b>일반쓰레기</b> — {r.LF_WST_EMSN_DOW || '정보 없음'} / {r.LF_WST_EMSN_BGNG_TM}~{r.LF_WST_EMSN_END_TM}
            <br />
            {r.LF_WST_EMSN_MTHD}
          </p>
          <p>
            <b>재활용품</b> — {r.RCYCL_EMSN_DOW || '정보 없음'} / {r.RCYCL_EMSN_BGNG_TM}~{r.RCYCL_EMSN_END_TM}
            <br />
            {r.RCYCL_EMSN_MTHD}
          </p>
          {r.UNCLLT_DAY && <p style={{ color: '#888', fontSize: 13 }}>미수거일: {r.UNCLLT_DAY}</p>}
          {r.MNG_DEPT_NM && (
            <p style={{ color: '#888', fontSize: 13 }}>
              문의: {r.MNG_DEPT_NM} {r.MNG_DEPT_TELNO}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default WasteSchedule;