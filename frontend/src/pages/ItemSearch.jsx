import { useState } from 'react';
import styles from '../styles/ItemSearch.module.css';
import { searchWasteItems } from '../api/wasteItemApi';
import { getCategoryKey } from '../utils/wasteItemUtils';

function ItemSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    searchWasteItems(query)
      .then((data) => {
        setResults(data);
        setSearched(true);
      })
      .catch(console.error);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className={styles.container}>
      <h2>품목 검색</h2>
      <p className={styles.desc}>버릴 물건 이름을 입력하면 어떤 쓰레기로 분류되는지 알려드려요.</p>

      <div className={styles.searchRow}>
        <input
          type="text"
          placeholder="예: 바나나 껍질"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleSearch}>검색</button>
      </div>

      {searched && results.length === 0 && (
        <p className={styles.empty}>"{query}"에 대한 정보를 찾지 못했어요.</p>
      )}

      {results.map((r, idx) => (
        <div key={idx} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.itemName}>{r.item}</span>
            <span className={`${styles.badge} ${styles[getCategoryKey(r.category)] || ''}`}>
              {r.category}
            </span>
          </div>
          {r.note && <p className={styles.note}>{r.note}</p>}
        </div>
      ))}
    </div>
  );
}

export default ItemSearch;