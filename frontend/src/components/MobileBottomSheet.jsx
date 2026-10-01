import { useEffect, useRef, useState } from 'react';
import styles from '../styles/MobileBottomSheet.module.css';
import SchedulePanelContent from './SchedulePanelContent';

// 패널 높이 단계: 최소(제목만) → 기본(오늘 배출 가능 품목) → 전체(요일별 표)
const SNAPS = ['min', 'mid', 'full'];
const DRAG_THRESHOLD_PX = 40;

// 모바일 화면의 하단 슬라이드 패널. 내용(탭 3개)은 데스크톱 오른쪽 패널과 같은 SchedulePanelContent를 사용.
// 손잡이를 탭하거나 위/아래로 끌면 최소 → 기본 → 전체 높이로 움직임.
//
// props
// - title: 패널 제목 (예: "부산광역시 연제구")
// - onClearSelection: 선택 해제 (× 버튼, 선택한 쓰레기통/시설이 있을 때만 표시)
// - 나머지(place, records, …)는 SchedulePanelContent로 그대로 전달
function MobileBottomSheet({ title, onClearSelection, ...contentProps }) {
  const { place, selectionKey } = contentProps;
  const [snap, setSnap] = useState('mid');
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(null);
  // 끌어서 높이를 바꾼 직후에 따라오는 click 이벤트로 한 번 더 움직이지 않도록 표시
  const justDragged = useRef(false);

  // 새 쓰레기통/지역을 고르면 패널이 내려가 있을 때 기본 높이로 올림
  useEffect(() => {
    setSnap((prev) => (prev === 'min' ? 'mid' : prev));
  }, [selectionKey]);

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
        {/* '배출 시간표 보기' 탭을 누르면 표가 잘 보이도록 패널을 끝까지 올림 */}
        <SchedulePanelContent {...contentProps} onOpenWeek={() => setSnap('full')} />
      </div>
    </section>
  );
}

export default MobileBottomSheet;
