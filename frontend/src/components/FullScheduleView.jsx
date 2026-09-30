import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '../styles/WasteSchedule.module.css';
import {
  isValid,
  buildWeeklyRows,
  formatItemList,
  getDayName,
  getScheduleCategories,
  CATEGORY_META,
} from '../utils/wasteScheduleUtils';

// '전체 시간표 보기'를 눌렀을 때 화면 전체를 덮는 새 화면.
// 월~일 요일별 배출 시간표(오늘 강조) + 품목별 배출 방법/장소를 보여주고, '돌아가기'나 ESC로 닫음
// 지도 옆 패널 안에서 열려도 화면 전체를 덮도록 body에 포털로 렌더링
function FullScheduleView({ title, record, now, onClose }) {
  const rows = buildWeeklyRows(record);
  const today = getDayName(now);
  const categories = getScheduleCategories(record);

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.fullView} role="dialog" aria-modal="true" aria-labelledby="full-schedule-title">
      <div className={styles.fullHeader}>
        <button type="button" className={styles.backButton} onClick={onClose}>
          ← 돌아가기
        </button>
        <div className={styles.fullHeaderText}>
          <h2 id="full-schedule-title" className={styles.fullTitle}>
            전체 배출 시간표
          </h2>
          <p className={styles.fullSubtitle}>
            {record.CTPV_NM} {record.SGG_NM} · {title}
          </p>
        </div>
      </div>

      <div className={styles.fullBody}>
        <section className={styles.fullSection}>
          <h3 className={styles.fullSectionTitle}>요일별 배출 시간</h3>
          <div className={styles.dayGrid}>
            {rows.map((row) => (
              <div key={row.day} className={`${styles.dayCard} ${row.day === today ? styles.dayCardToday : ''}`}>
                <span className={styles.dayLabel}>{row.day}</span>
                {row.items.length > 0 ? (
                  <div className={styles.itemBadgeList}>
                    {row.items.map((item, i) => {
                      const meta = CATEGORY_META[item.name] || { icon: '❔', className: '' };
                      return (
                        <div key={i} className={`${styles.itemBadge} ${styles[meta.className] || ''}`}>
                          <span className={styles.itemHeader}>
                            <span className={styles.itemIcon}>{meta.icon}</span>
                            <span className={styles.itemName}>{item.name}</span>
                          </span>
                          <span className={styles.itemTime}>{item.time}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.noItemBadge}>
                    <span className={styles.noItemIcon}>🚫</span>
                    배출 없음
                  </div>
                )}
                {row.day === today && <span className={styles.todayTag}>오늘</span>}
              </div>
            ))}
          </div>
          <p className={styles.fullNote}>
            ※ 끝나는 시간이 시작 시간보다 이르면(예: 20:00~06:00) 다음 날 아침까지 배출할 수 있어요.
          </p>
        </section>

        {categories.length > 0 && (
          <section className={styles.fullSection}>
            <h3 className={styles.fullSectionTitle}>품목별 배출 방법</h3>
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat.name] || { icon: '❔' };
              return (
                <div key={cat.name} className={styles.infoBox}>
                  <span className={styles.infoBoxIcon}>{meta.icon}</span>
                  <div>
                    <p className={styles.infoBoxLabel}>{cat.name}</p>
                    <p className={styles.infoBoxText}>{cat.method}</p>
                  </div>
                </div>
              );
            })}
            {isValid(record.EMSN_PLC) && (
              <div className={styles.infoBox}>
                <span className={styles.infoBoxIcon}>📍</span>
                <div>
                  <p className={styles.infoBoxLabel}>배출 장소</p>
                  <p className={styles.infoBoxText}>{formatItemList(record.EMSN_PLC)}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {(record.UNCLLT_DAY || isValid(record.TMPRY_BULK_WASTE_EMSN_MTHD)) && (
          <section className={styles.fullSection}>
            <h3 className={styles.fullSectionTitle}>미수거일 · 대형폐기물</h3>
            {record.UNCLLT_DAY && (
              <div className={styles.infoBox}>
                <span className={styles.infoBoxIcon}>📅</span>
                <div>
                  <p className={styles.infoBoxLabel}>미수거일</p>
                  <p className={styles.infoBoxText}>{formatItemList(record.UNCLLT_DAY)}</p>
                </div>
              </div>
            )}
            {isValid(record.TMPRY_BULK_WASTE_EMSN_MTHD) && (
              <div className={styles.infoBox}>
                <span className={styles.infoBoxIcon}>🛋️</span>
                <div>
                  <p className={styles.infoBoxLabel}>대형폐기물</p>
                  <p className={styles.infoBoxText}>
                    {record.TMPRY_BULK_WASTE_EMSN_MTHD}
                    {isValid(record.TMPRY_BULK_WASTE_EMSN_PLC) &&
                      ` (배출 장소: ${formatItemList(record.TMPRY_BULK_WASTE_EMSN_PLC)})`}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>,
    document.body
  );
}

export default FullScheduleView;
