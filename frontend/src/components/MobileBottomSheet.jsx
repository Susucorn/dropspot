import { useEffect, useRef, useState } from 'react';
import styles from '../styles/MobileBottomSheet.module.css';
import {
  isValid,
  buildWeeklyRows,
  formatItemList,
  getAvailability,
  getDayName,
  getScheduleCategories,
  CATEGORY_META,
} from '../utils/wasteScheduleUtils';

// 패널 높이 단계: 최소(제목만) → 기본(오늘 배출 가능 품목) → 전체(요일별 표)
const SNAPS = ['min', 'mid', 'full'];
const DRAG_THRESHOLD_PX = 40;

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

// 모바일 화면의 하단 슬라이드 패널.
// 기본 탭은 '오늘 현재 배출 가능한 품목'만 크게 보여주고, '전체 규칙 보기' 탭은 요일 × 품목 표로 보여줌.
// 손잡이를 탭하거나 위/아래로 끌면 최소 → 기본 → 전체 높이로 움직임.
//
// props
// - title: 패널 제목 (예: "부산광역시 연제구")
// - place: 선택한 쓰레기통/시설 정보 { badge, badgeClass, name, lines: [문자열] } 또는 null
// - records: 배출 규칙 목록 (여러 관리구역이면 여러 건), getRecordTitle(record): 구역 이름
// - loading, error: 배출 규칙 조회 상태
// - showSchedule: false면(재활용센터·의류수거함) 배출 규칙 탭 없이 시설 정보 + 품목 찾기 탭만 표시
// - selectionKey: 선택이 바뀔 때마다 달라지는 값 (바뀌면 패널이 최소 상태일 때 기본 높이로 올라옴)
// - onClearSelection, onReport(record)
// - itemSearchContent: '품목 찾기' 탭에 보여줄 배출품목 검색 화면
function MobileBottomSheet({
  title,
  place,
  records,
  getRecordTitle,
  loading,
  error,
  showSchedule,
  selectionKey,
  onClearSelection,
  onReport,
  itemSearchContent,
}) {
  const now = useNow();
  const [snap, setSnap] = useState('mid');
  const [tab, setTab] = useState('today');
  const [recordIdx, setRecordIdx] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(null);
  // 끌어서 높이를 바꾼 직후에 따라오는 click 이벤트로 한 번 더 움직이지 않도록 표시
  const justDragged = useRef(false);

  // 새 쓰레기통/지역을 고르면 첫 구역부터 보여주고, 패널이 내려가 있으면 기본 높이로 올림
  useEffect(() => {
    setRecordIdx(0);
    setSnap((prev) => (prev === 'min' ? 'mid' : prev));
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

  function moveSnap(step) {
    setSnap((prev) => SNAPS[Math.min(SNAPS.length - 1, Math.max(0, SNAPS.indexOf(prev) + step))]);
  }

  // 손잡이 탭: 최소 → 기본 → 전체 → 기본 … 순으로 순환
  function handleHandleClick() {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    setSnap((prev) => (prev === 'min' ? 'mid' : prev === 'mid' ? 'full' : 'mid'));
  }

  function handleTouchStart(e) {
    dragStartY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e) {
    if (dragStartY.current === null) return;
    setDragOffset(e.touches[0].clientY - dragStartY.current);
  }

  function handleTouchEnd() {
    justDragged.current = Math.abs(dragOffset) > DRAG_THRESHOLD_PX;
    if (dragOffset < -DRAG_THRESHOLD_PX) moveSnap(1);
    else if (dragOffset > DRAG_THRESHOLD_PX) moveSnap(-1);
    dragStartY.current = null;
    setDragOffset(0);
  }

  function openWeekTab() {
    setTab('week');
    setSnap('full');
  }

  return (
    <section
      className={`${styles.sheet} ${styles[`snap_${snap}`]}`}
      style={dragOffset ? { transform: `translateY(${Math.max(dragOffset, -120)}px)`, transition: 'none' } : undefined}
      aria-label="배출 규칙 안내"
    >
      <div
        className={styles.handleArea}
        onClick={handleHandleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="button"
        tabIndex={0}
        aria-label={snap === 'full' ? '패널 줄이기' : '패널 펼치기'}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleHandleClick()}
      >
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title || '지역을 찾는 중...'}</h2>
          {place && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={(e) => {
                e.stopPropagation();
                onClearSelection();
              }}
              aria-label="선택 해제"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {place && (
          <div className={styles.place}>
            <span className={place.badgeClass}>{place.badge}</span>
            <p className={styles.placeName}>{place.name}</p>
            {place.lines.filter(Boolean).map((line) => (
              <p key={line} className={styles.placeLine}>
                {line}
              </p>
            ))}
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
              onClick={() => (t.key === 'week' ? openWeekTab() : setTab(t.key))}
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
                  >
                    {getRecordTitle(r)}
                  </button>
                ))}
              </div>
            )}

            {loading && <p className={styles.message}>불러오는 중...</p>}
            {error && <p className={styles.errorMessage}>{error}</p>}
            {!loading && !error && !record && <p className={styles.message}>이 지역의 배출 규칙 정보가 없어요.</p>}

            {!loading && !error && record && (
              <>
                {activeTab === 'today' ? (
                  <TodayView record={record} now={now} />
                ) : (
                  <WeekView record={record} now={now} />
                )}

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
      </div>
    </section>
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

export default MobileBottomSheet;
