import { useEffect, useMemo, useState } from 'react';
import styles from '../styles/WasteSchedule.module.css';
import { fetchRegions, fetchSchedule } from '../api/wasteScheduleApi';
import { fetchWasteItems, fetchWasteSpots } from '../api/wasteRecyclingApi';
import { isValid, buildWeeklyRows, splitZoneNames, normalizeZoneName } from '../utils/wasteScheduleUtils';

const SEARCH_DEBOUNCE_MS = 300;

function SearchIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 배출품목명으로 배출방법을 검색하는 독립 검색창 (기후에너지환경부 분리배출 정보조회 서비스 getItem)
function WasteItemSearch() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function runSearch(q) {
    const trimmed = q.trim();
    if (!trimmed) {
      setItems([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetchWasteItems(trimmed)
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('배출품목 정보를 불러오지 못했어요.');
        setLoading(false);
      });
  }

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>배출품목으로 배출방법 찾기</h3>
      <div className={styles.searchCard}>
        <div className={styles.searchRow}>
          <div className={styles.inputWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="품목명을 입력하세요 (예: 화분, 소화기, 형광등)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.clearButton}
                aria-label="검색어 지우기"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery('');
                }}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.searchSubmitButton}
            aria-label="검색"
            onClick={() => runSearch(query)}
          >
            <SearchIcon className={styles.searchButtonIcon} />
          </button>
        </div>
      </div>

      {loading && <p>검색 중...</p>}
      {error && <p className={styles.errorText}>{error}</p>}
      {!loading && !error && query.trim() && items.length === 0 && <p>검색 결과가 없어요.</p>}

      {items.length > 0 && (
        <ul className={styles.resultList}>
          {items.map((it, idx) => (
            <li key={idx} className={styles.resultRow}>
              <span className={styles.resultName}>{it.itemNm}</span>
              <span className={styles.resultDetail}>{it.dschgMthd}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 동 이름으로 분리배출 장소를 검색하는 독립 검색창 (기후에너지환경부 분리배출 정보조회 서비스 getSpot)
function WasteSpotSearch() {
  const [query, setQuery] = useState('');
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function runSearch(q) {
    const trimmed = q.trim();
    if (!trimmed) {
      setSpots([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetchWasteSpots(trimmed)
      .then((data) => {
        setSpots(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('분리배출 장소 정보를 불러오지 못했어요.');
        setLoading(false);
      });
  }

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>동 이름으로 분리배출 장소 찾기</h3>
      <div className={styles.searchCard}>
        <div className={styles.searchRow}>
          <div className={styles.inputWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="동 이름을 입력하세요 (예: 화명동)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.clearButton}
                aria-label="검색어 지우기"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery('');
                }}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.searchSubmitButton}
            aria-label="검색"
            onClick={() => runSearch(query)}
          >
            <SearchIcon className={styles.searchButtonIcon} />
          </button>
        </div>
      </div>

      {loading && <p>검색 중...</p>}
      {error && <p className={styles.errorText}>{error}</p>}
      {!loading && !error && query.trim() && spots.length === 0 && <p>검색 결과가 없어요.</p>}

      {spots.length > 0 && (
        <ul className={styles.resultList}>
          {spots.map((s, idx) => (
            <li key={idx} className={styles.resultRow}>
              <span className={styles.resultName}>{s.spotNm}</span>
              <span className={styles.resultDetail}>
                {s.addrBase}
                {isValid(s.addrDtl) ? ` ${s.addrDtl}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WasteSchedule() {
  const [regionMap, setRegionMap] = useState({});
  const [ctpv, setCtpv] = useState('');
  const [sgg, setSgg] = useState('');
  const [dong, setDong] = useState('');
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRegions()
      .then((data) => setRegionMap(data))
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

  // regionMap({시도: {시군구: [동/읍/면,...]}})을 "경기도 가평군" / "경기도 가평군 가평읍" 같은 검색용 리스트로 펼침
  const regionOptions = useMemo(() => {
    const list = [];
    Object.entries(regionMap).forEach(([c, sggMap]) => {
      Object.entries(sggMap).forEach(([s, dongs]) => {
        list.push({ ctpv: c, sgg: s, dong: '', label: `${c} ${s}` });
        dongs.forEach((d) => {
          list.push({ ctpv: c, sgg: s, dong: d, label: `${c} ${s} ${d}` });
        });
      });
    });
    return list;
  }, [regionMap]);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return regionOptions.filter((o) => o.label.includes(query.trim())).slice(0, 8);
  }, [query, regionOptions]);

  // 동까지 선택한 경우, 결과에서 해당 동/읍/면이 포함된 항목만 남김
  const filteredResults = useMemo(() => {
    if (!dong) return results;
    return results.filter(
      (r) =>
        isValid(r.MNG_ZONE_TRGT_RGN_NM) &&
        splitZoneNames(r.MNG_ZONE_TRGT_RGN_NM).some((zone) => normalizeZoneName(zone) === dong)
    );
  }, [results, dong]);

  // 동을 선택했다면 "구포동+금곡동+화명동+..." 대신 선택한 동 이름만 제목으로 사용
  function getRegionTitle(r) {
    if (dong && isValid(r.MNG_ZONE_TRGT_RGN_NM)) {
      const zones = splitZoneNames(r.MNG_ZONE_TRGT_RGN_NM).map(normalizeZoneName);
      if (zones.includes(dong)) return dong;
    }
    return isValid(r.MNG_ZONE_TRGT_RGN_NM) ? r.MNG_ZONE_TRGT_RGN_NM : `${r.CTPV_NM} ${r.SGG_NM}`;
  }

  // 수거 지점(EMSN_PLC)만 다르고 화면에 보이는 배출 규칙 내용은 완전히 같은 항목은 하나로 합침
  const dedupedResults = useMemo(() => {
    const seen = new Set();
    return filteredResults.filter((r) => {
      const key = JSON.stringify({
        title: getRegionTitle(r),
        rows: buildWeeklyRows(r),
        bulkMethod: isValid(r.TMPRY_BULK_WASTE_EMSN_MTHD) ? r.TMPRY_BULK_WASTE_EMSN_MTHD : '',
        bulkPlace: isValid(r.TMPRY_BULK_WASTE_EMSN_PLC) ? r.TMPRY_BULK_WASTE_EMSN_PLC : '',
        uncolltDay: r.UNCLLT_DAY || '',
        deptName: r.MNG_DEPT_NM || '',
        deptTel: r.MNG_DEPT_TELNO || '',
      });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filteredResults, dong]);

  function handleSelect(option) {
    setCtpv(option.ctpv);
    setSgg(option.sgg);
    setDong(option.dong);
    setQuery(option.label);
    setShowSuggestions(false);
  }

  function handleClearQuery() {
    setQuery('');
    setShowSuggestions(false);
  }

  return (
    <div className={styles.container}>
      <h2>우리 동네 배출 규칙 안내</h2>

      <div className={styles.searchCard}>
        <div className={styles.searchRow}>
          <div className={styles.inputWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="시/도, 시/군/구, 동/읍/면을 입력하세요 (예: 경기도 가평군 가평읍)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {query && (
              <button
                type="button"
                className={styles.clearButton}
                aria-label="검색어 지우기"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleClearQuery();
                }}
              >
                ×
              </button>
            )}
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
          <button
            type="button"
            className={styles.searchSubmitButton}
            aria-label="검색"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowSuggestions(true);
            }}
          >
            <SearchIcon className={styles.searchButtonIcon} />
          </button>
        </div>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className={styles.errorText}>{error}</p>}
      {!loading && !error && !ctpv && <p>지역을 검색해서 선택해주세요.</p>}
      {!loading && !error && ctpv && results.length === 0 && <p>해당 지역 정보가 없어요.</p>}
      {!loading && !error && ctpv && results.length > 0 && filteredResults.length === 0 && (
        <p>해당 동 정보가 없어요.</p>
      )}

      {dedupedResults.map((r, idx) => (
        <div key={idx} className={styles.card}>
          <p className={styles.cardTitle}>
            {dedupedResults.length > 1 ? `${idx + 1}. ` : ''}
            {getRegionTitle(r)}
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

      <hr className={styles.divider} />
      <WasteItemSearch />
      <hr className={styles.divider} />
      <WasteSpotSearch />
    </div>
  );
}

export default WasteSchedule;
