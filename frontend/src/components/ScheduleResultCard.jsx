import { useEffect, useState } from 'react';
import styles from '../styles/WasteSchedule.module.css';
import { getAvailability, getDayName, CATEGORY_META } from '../utils/wasteScheduleUtils';
import FullScheduleView from './FullScheduleView';

// 1분마다 현재 시각을 갱신해서, 화면을 켜 둔 채로 시간이 지나도 '지금 배출 가능' 품목이 맞게 바뀌도록 함
function useNow(intervalMs = 60 * 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// 배출 규칙 한 건을 보여주는 카드.
// 상단에 현재 요일/시간 기준으로 '지금 배출 가능한 품목'을 강조하고, 요일별 전체 시간표와
// 대형폐기물/미수거일 같은 상세 정보는 '전체 시간표 보기'를 누르면 새 화면(FullScheduleView)으로 보여줌.
// onReport를 넘기면 '쓰레기통 신고하기' 버튼을 보여주고, 관리 부서 연락처는 카드 맨 아래에 따로 표시
function ScheduleResultCard({ title, record, onReport }) {
  const now = useNow();
  const [showFull, setShowFull] = useState(false);

  const availability = getAvailability(record, now);
  const availableNow = availability.filter((a) => a.status === 'now');
  const upcoming = availability.filter((a) => a.status !== 'now');
  const nowLabel = `${getDayName(now)}요일 ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>{title}</p>

      <div className={`${styles.nowBox} ${availableNow.length === 0 ? styles.nowBoxEmpty : ''}`}>
        <p className={styles.nowHeading}>
          <span className={styles.nowDot} aria-hidden="true" />
          지금 배출 가능 <span className={styles.nowTime}>{nowLabel} 기준</span>
        </p>
        {availableNow.length > 0 ? (
          <div className={styles.nowItemList}>
            {availableNow.map((a) => {
              const meta = CATEGORY_META[a.name] || { icon: '❔', className: '' };
              return (
                <div key={a.name} className={`${styles.nowItem} ${styles[meta.className] || ''}`}>
                  <span className={styles.nowItemIcon}>{meta.icon}</span>
                  <span className={styles.nowItemName}>{a.name}</span>
                  <span className={styles.nowItemTime}>{a.text}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.nowEmptyText}>지금은 배출할 수 있는 품목이 없어요.</p>
        )}
      </div>

      {upcoming.length > 0 && (
        <ul className={styles.upcomingList}>
          {upcoming.map((a) => {
            const meta = CATEGORY_META[a.name] || { icon: '❔' };
            return (
              <li key={a.name} className={styles.upcomingItem}>
                <span className={styles.upcomingName}>
                  {meta.icon} {a.name}
                </span>
                <span className={a.status === 'today' ? styles.upcomingToday : styles.upcomingLater}>
                  {a.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.cardActions}>
        <button type="button" className={styles.fullScheduleButton} onClick={() => setShowFull(true)}>
          <span aria-hidden="true">📅</span> 전체 시간표 보기
        </button>
        {onReport && (
          <button type="button" className={styles.reportButton} onClick={() => onReport(record)}>
            <span aria-hidden="true">🚩</span> 쓰레기통 신고하기
          </button>
        )}
      </div>

      {(record.MNG_DEPT_NM || record.MNG_DEPT_TELNO) && (
        <div className={styles.managerContact}>
          <span className={styles.managerLabel}>관리자 연락처</span>
          <span className={styles.managerText}>
            {record.MNG_DEPT_NM}
            {record.MNG_DEPT_TELNO && (
              <>
                {' · '}
                <a className={styles.managerTel} href={`tel:${record.MNG_DEPT_TELNO.replace(/[^0-9+]/g, '')}`}>
                  {record.MNG_DEPT_TELNO}
                </a>
              </>
            )}
          </span>
        </div>
      )}

      {showFull && (
        <FullScheduleView title={title} record={record} now={now} onClose={() => setShowFull(false)} />
      )}
    </div>
  );
}

export default ScheduleResultCard;
