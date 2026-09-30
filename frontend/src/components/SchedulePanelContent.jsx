import { useEffect, useState } from 'react';
import styles from '../styles/SchedulePanel.module.css';
import {
  isValid,
  buildWeeklyRows,
  formatItemList,
  getAvailability,
  getDayName,
  getScheduleCategories,
  CATEGORY_META,
} from '../utils/wasteScheduleUtils';

// 1분마다 현재 시각을 갱신해서 '지금 배출 가능' 품목이 시간에 맞게 바뀌도록 함
function useNow(intervalMs = 60 * 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 배출 규칙 패널 내용 (모바일 하단 패널과 데스크톱 오른쪽 패널에서 공통으로 사용).
// 선택한 쓰레기통/시설 정보 + 탭 3개: 오늘 배출(지금 배출 가능 품목) / 전체 규칙 보기(요일 × 품목 표) / 품목 찾기
//
// props
// - place: 선택한 쓰레기통/시설 정보 { badge, badgeClass, name, lines: [문자열], note } 또는 null
// - records: 배출 규칙 목록 (여러 관리구역이면 여러 건), getRecordTitle(record): 구역 이름
// - loading, error: 배출 규칙 조회 상태
// - showSchedule: false면(재활용센터·의류수거함) 배출 규칙 탭 없이 시설 정보 + 품목 찾기 탭만 표시
// - selectionKey: 선택이 바뀔 때마다 달라지는 값 (바뀌면 첫 관리구역부터 보여줌)
// - onReport(record): 쓰레기통 신고 (없으면 신고 버튼 숨김)
// - itemSearchContent: '품목 찾기' 탭에 보여줄 배출품목 검색 화면
// - onOpenWeek: '전체 규칙 보기' 탭을 눌렀을 때 추가로 할 일 (모바일은 패널을 끝까지 올림)
// - emptyMessage: 보여줄 배출 규칙이 없을 때 문구
function SchedulePanelContent({
  place,
  records,
  getRecordTitle,
  loading,
  error,
  showSchedule,
  selectionKey,
  onReport,
  itemSearchContent,
  onOpenWeek,
  emptyMessage = '이 지역의 배출 규칙 정보가 없어요.',
}) {
  const now = useNow();
  const [tab, setTab] = useState('today');
  const [recordIdx, setRecordIdx] = useState(0);

  // 새 쓰레기통/지역을 고르면 첫 관리구역부터 보여줌
  useEffect(() => {
    setRecordIdx(0);
  }, [selectionKey]);

  const record = records[recordIdx] || records[0] || null;

  // 재활용센터·의류수거함처럼 배출 규칙이 없는 선택이면 '품목 찾기' 탭만 둠
  const tabs = [
    ...(showSchedule
      ? [
          { key: 'today', label: '오늘 배출' },
          { key: 'week', label: '전체 규칙 보기' },
        ]
      : []),
    { key: 'item', label: '품목 찾기' },
  ];
  const activeTab = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  function handleTabClick(key) {
    setTab(key);
    if (key === 'week') onOpenWeek?.();
  }

  return (
    <>
      {place && (
        <div className={styles.place}>
          <span className={place.badgeClass}>{place.badge}</span>
          <p className={styles.placeName}>{place.name}</p>
          {place.lines.filter(Boolean).map((line) => (
            <p key={line} className={styles.placeLine}>
              {line}
            </p>
          ))}
          {place.note && <p className={styles.placeNote}>{place.note}</p>}
        </div>
      )}

      <div className={styles.tabs} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            className={activeTab === t.key ? styles.tabActive : styles.tab}
            onClick={() => handleTabClick(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'item' && <div className={styles.itemSearch}>{itemSearchContent}</div>}

      {activeTab !== 'item' && (
        <>
          {/* 관리구역이 여러 개면 구역을 골라서 볼 수 있게 가로 칩으로 표시 */}
          {records.length > 1 && (
            <div className={styles.zoneChips}>
              {records.map((r, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={idx === recordIdx ? styles.zoneChipActive : styles.zoneChip}
                  onClick={() => setRecordIdx(idx)}
                  title={getRecordTitle(r)}
                >
                  {getRecordTitle(r)}
                </button>
              ))}
            </div>
          )}

          {loading && <p className={styles.message}>불러오는 중...</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}
          {!loading && !error && !record && <p className={styles.message}>{emptyMessage}</p>}

          {!loading && !error && record && (
            <>
              {activeTab === 'today' ? <TodayView record={record} now={now} /> : <WeekView record={record} now={now} />}

              <div className={styles.footer}>
                {(record.MNG_DEPT_NM || record.MNG_DEPT_TELNO) && (
                  <p className={styles.contact}>
                    관리 {record.MNG_DEPT_NM}
                    {record.MNG_DEPT_TELNO && (
                      <>
                        {' · '}
                        <a href={`tel:${record.MNG_DEPT_TELNO.replace(/[^0-9+]/g, '')}`}>{record.MNG_DEPT_TELNO}</a>
                      </>
                    )}
                  </p>
                )}
                {onReport && (
                  <button type="button" className={styles.reportButton} onClick={() => onReport(record)}>
                    🚩 쓰레기통 신고
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

// 기본 탭: 지금 배출 가능한 품목을 크게, 나머지는 다음 배출 시간만 작게
function TodayView({ record, now }) {
  const availability = getAvailability(record, now);
  const availableNow = availability.filter((a) => a.status === 'now');
  const others = availability.filter((a) => a.status !== 'now');

  return (
    <div className={styles.today}>
      <p className={styles.todayLabel}>
        지금 배출 가능 <span className={styles.todayTime}>{getDayName(now)} {formatTime(now)}</span>
      </p>

      {availableNow.length > 0 ? (
        <ul className={styles.nowList}>
          {availableNow.map((a) => {
            const meta = CATEGORY_META[a.name] || { icon: '❔' };
            return (
              <li key={a.name} className={styles.nowItem}>
                <span className={styles.nowIcon} aria-hidden="true">
                  {meta.icon}
                </span>
                <span className={styles.nowName}>{a.name}</span>
                <span className={styles.nowUntil}>{a.text}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.nowEmpty}>지금은 배출할 수 있는 품목이 없어요.</p>
      )}

      {others.length > 0 && (
        <ul className={styles.nextList}>
          {others.map((a) => (
            <li key={a.name} className={styles.nextItem}>
              <span>
                {(CATEGORY_META[a.name] || { icon: '❔' }).icon} {a.name}
              </span>
              <span className={a.status === 'today' ? styles.nextToday : styles.nextLater}>{a.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// '전체 규칙 보기' 탭: 요일(행) × 품목(열) 표. 오늘 요일은 강조
function WeekView({ record, now }) {
  const categories = getScheduleCategories(record).map((c) => c.name);
  const rows = buildWeeklyRows(record);
  const today = getDayName(now);

  if (categories.length === 0) return <p className={styles.message}>요일별 배출 정보가 없어요.</p>;

  return (
    <div className={styles.week}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">요일</th>
            {categories.map((name) => (
              <th key={name} scope="col">
                {(CATEGORY_META[name] || { icon: '' }).icon} {name.replace('쓰레기', '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day} className={row.day === today ? styles.todayRow : undefined}>
              <th scope="row">{row.day}</th>
              {categories.map((name) => {
                const item = row.items.find((i) => i.name === name);
                return <td key={name}>{item ? item.time : <span className={styles.none}>–</span>}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.note}>끝 시간이 시작보다 이르면 다음 날 아침까지예요.</p>

      <dl className={styles.details}>
        {isValid(record.EMSN_PLC) && (
          <>
            <dt>배출 장소</dt>
            <dd>{formatItemList(record.EMSN_PLC)}</dd>
          </>
        )}
        {record.UNCLLT_DAY && (
          <>
            <dt>미수거일</dt>
            <dd>{formatItemList(record.UNCLLT_DAY)}</dd>
          </>
        )}
        {isValid(record.TMPRY_BULK_WASTE_EMSN_MTHD) && (
          <>
            <dt>대형폐기물</dt>
            <dd>{record.TMPRY_BULK_WASTE_EMSN_MTHD}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

export default SchedulePanelContent;
