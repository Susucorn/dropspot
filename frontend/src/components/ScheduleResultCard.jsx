import { useEffect, useState } from 'react';
import styles from '../styles/WasteSchedule.module.css';
import { getAvailability, CATEGORY_META } from '../utils/wasteScheduleUtils';
import FullScheduleView from './FullScheduleView';

// 1분마다 현재 시각을 갱신해서, 화면을 켜 둔 채로 시간이 지나도 품목별 배출 시간 안내가 맞게 바뀌도록 함
function useNow(intervalMs = 60 * 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// 품목별 안내 문구 색: 지금 가능(초록) / 오늘 이따가(주황) / 다른 날(회색)
const STATUS_CLASS = { now: 'upcomingNow', today: 'upcomingToday', later: 'upcomingLater' };

// 배출 규칙 한 건을 보여주는 카드.
// 품목별로 현재 시각 기준 배출 시간("지금 가능 · 06:00까지", "오늘 20:00부터" 등)을 한 줄씩 보여주고,
// 요일별 전체 시간표와 대형폐기물/미수거일 같은 상세 정보는 '전체 시간표 보기'를 누르면 새 화면(FullScheduleView)으로 보여줌.
// onReport를 넘기면 '쓰레기통 신고하기' 버튼을 보여주고, 관리 부서 연락처는 카드 맨 아래에 따로 표시
function ScheduleResultCard({ title, record, onReport }) {
  const now = useNow();
  const [showFull, setShowFull] = useState(false);

  const availability = getAvailability(record, now);

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>{title}</p>

      {availability.length > 0 && (
        <ul className={styles.upcomingList}>
          {availability.map((a) => {
            const meta = CATEGORY_META[a.name] || { icon: '❔' };
            return (
              <li key={a.name} className={styles.upcomingItem}>
                <span className={styles.upcomingName}>
                  {meta.icon} {a.name}
                </span>
                <span className={styles[STATUS_CLASS[a.status]]}>
                  {a.status === 'now' ? `지금 가능 · ${a.text}` : a.text}
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
