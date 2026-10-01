import { useEffect, useRef, useState } from 'react';
import styles from '../styles/WasteSchedule.module.css';
import { fetchWasteItems } from '../api/wasteRecyclingApi';

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

// 배출품목 검색 상태/로직 (기후에너지환경부 분리배출 정보조회 서비스 getItem).
// 검색창과 결과 목록을 서로 다른 영역(고정 상단 / 스크롤 영역)에 나눠 넣어야 해서 훅으로 분리함
export function useWasteItemSearch() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 검색할 때마다 번호를 매겨서, "페트" → "페트병"처럼 이어서 칠 때 늦게 도착한 이전 검색어의 결과나
  // 검색어를 지운 뒤 도착한 결과가 화면을 덮어쓰지 않게 함
  const searchIdRef = useRef(0);

  function runSearch(q) {
    const searchId = ++searchIdRef.current;
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
        if (searchId !== searchIdRef.current) return;
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        if (searchId !== searchIdRef.current) return;
        setError('배출품목 정보를 불러오지 못했어요.');
        setLoading(false);
      });
  }

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { query, setQuery, items, loading, error, runSearch };
}

export function WasteItemSearchBox({ query, setQuery, runSearch }) {
  return (
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
  );
}

export function WasteItemResults({ query, items, loading, error }) {
  return (
    <>
      {loading && <p>검색 중...</p>}
      {error && <p className={styles.errorText}>{error}</p>}
      {!loading && !error && query.trim() && items.length === 0 && <p>검색 결과가 없어요.</p>}

      {items.map((it, idx) => (
        <div key={idx} className={styles.resultGroup}>
          <p className={styles.resultGroupTitle}>{it.itemNm}</p>
          <p className={styles.resultDetail}>{it.dschgMthd}</p>
        </div>
      ))}
    </>
  );
}
