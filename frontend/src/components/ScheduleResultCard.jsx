import styles from '../styles/WasteSchedule.module.css';
import { isValid, buildWeeklyRows, formatItemList } from '../utils/wasteScheduleUtils';

// 품목별 아이콘/색상 (없는 카테고리는 기본값으로 대체)
const CATEGORY_META = {
  음식물쓰레기: { icon: '🍚', className: 'catFood' },
  일반쓰레기: { icon: '🗑️', className: 'catGeneral' },
  재활용품: { icon: '♻️', className: 'catRecycle' },
};

// 배출 규칙 한 건을 요일별 카드 + 대형폐기물/미수거일/문의처 박스로 보여주는 공용 카드
// (배출 규칙 안내 페이지, 지도 옆 패널 양쪽에서 재사용)
function ScheduleResultCard({ title, record }) {
  const rows = buildWeeklyRows(record);

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>{title}</p>

      <div className={styles.dayGrid}>
        {rows.map((row) => (
          <div key={row.day} className={styles.dayCard}>
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
          </div>
        ))}
      </div>

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

      {record.UNCLLT_DAY && (
        <div className={styles.infoBox}>
          <span className={styles.infoBoxIcon}>📅</span>
          <div>
            <p className={styles.infoBoxLabel}>미수거일</p>
            <p className={styles.infoBoxText}>{formatItemList(record.UNCLLT_DAY)}</p>
          </div>
        </div>
      )}

      {record.MNG_DEPT_NM && (
        <div className={styles.infoBox}>
          <span className={styles.infoBoxIcon}>📞</span>
          <div>
            <p className={styles.infoBoxLabel}>문의처</p>
            <p className={styles.infoBoxText}>
              {record.MNG_DEPT_NM} {record.MNG_DEPT_TELNO}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleResultCard;
