import { useEffect, useMemo, useState } from 'react';
import styles from '../styles/WasteSchedule.module.css';
import { fetchRegions, fetchSchedule } from '../api/wasteScheduleApi';
import { isValid, buildWeeklyRows } from '../utils/wasteScheduleUtils';

function WasteSchedule() {
  const [regionMap, setRegionMap] = useState({});
  const [ctpv, setCtpv] = useState('');
  const [sgg, setSgg] = useState('');
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRegions()
      .then((data) => {
        setRegionMap(data);
        const firstCtpv = Object.keys(data)[0];
        if (firstCtpv) {
          const firstSgg = data[firstCtpv][0] || '';
          setCtpv(firstCtpv);
          setSgg(firstSgg);
          setQuery(`${firstCtpv} ${firstSgg}`);
        }
      })
      .catch(() => setError('지역 목록을 불러오지 못했어요.'));
  }, []);

  useEffect(() => {
    if (!ctpv || !sgg) return;
    setLoading(true);
    setError('');
    fetchSchedule(ctpv, sgg)
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('배출 정보를 불러오지 못했어요.');
        setLoading(false);
      });
  }, [ctpv, sgg]);

  // regionMap({시도: [시군구,...]})을 "경기도 가평군" 같은 검색용 리스트로 펼침
  const regionOptions = useMemo(() => {
    const list = [];
    Object.entries(regionMap).forEach(([c, sggs]) => {
      sggs.forEach((s) => list.push({ ctpv: c, sgg: s, label: `${c} ${s}` }));
    });
    return list;
  }, [regionMap]);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return regionOptions.filter((o) => o.label.includes(query.trim())).slice(0, 8);
  }, [query, regionOptions]);

  function handleSelect(option) {
    setCtpv(option.ctpv);
    setSgg(option.sgg);
    setQuery(option.label);
    setShowSuggestions(false);
  }

  return (
    <div className={styles.container}>
      <h2>우리 동네 배출 규칙 안내</h2>

      <div className={styles.searchBox}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="시/도, 시/군/구를 입력하세요 (예: 경기도 가평군)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className={styles.suggestionList}>
            {suggestions.map((o) => (
              <li key={o.label} className={styles.suggestionItem} onMouseDown={() => handleSelect(o)}>
                {o.label}
              </li>
            ))}
          </ul>
        )}
        {showSuggestions && query.trim() && suggestions.length === 0 && (
          <ul className={styles.suggestionList}>
            <li className={styles.suggestionEmpty}>검색 결과가 없어요.</li>
          </ul>
        )}
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className={styles.errorText}>{error}</p>}
      {!loading && !error && results.length === 0 && <p>해당 지역 정보가 없어요.</p>}

      {results.map((r, idx) => (
        <div key={idx} className={styles.card}>
          <p className={styles.cardTitle}>
            {results.length > 1 ? `${idx + 1}. ` : ''}
            {isValid(r.MNG_ZONE_TRGT_RGN_NM) ? r.MNG_ZONE_TRGT_RGN_NM : `${r.CTPV_NM} ${r.SGG_NM}`}
          </p>

          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.dayHeader}>요일</th>
                <th>배출 시간 / 품목</th>
              </tr>
            </thead>
            <tbody>
              {buildWeeklyRows(r).map((row) => (
                <tr key={row.day}>
                  <td className={styles.dayCell}>{row.day}</td>
                  <td>
                    {row.items.length > 0 ? (
                      row.items.map((item, i) => (
                        <div key={i} className={styles.itemChip}>
                          {item}
                        </div>
                      ))
                    ) : (
                      <span className={styles.noItem}>배출 없음</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isValid(r.TMPRY_BULK_WASTE_EMSN_MTHD) && (
            <p className={styles.metaText}>
              대형폐기물: {r.TMPRY_BULK_WASTE_EMSN_MTHD}
              {isValid(r.TMPRY_BULK_WASTE_EMSN_PLC) && ` (배출 장소: ${r.TMPRY_BULK_WASTE_EMSN_PLC})`}
            </p>
          )}
          {r.UNCLLT_DAY && <p className={styles.metaText}>미수거일: {r.UNCLLT_DAY}</p>}
          {r.MNG_DEPT_NM && (
            <p className={styles.metaText}>
              문의: {r.MNG_DEPT_NM} {r.MNG_DEPT_TELNO}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default WasteSchedule;