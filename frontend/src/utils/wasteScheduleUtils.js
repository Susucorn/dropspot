export function isValid(text) {
  return text && text !== '해당없음' && text !== '없음';
}

// MNG_ZONE_TRGT_RGN_NM은 지역마다 구분자가 "+" 또는 ","로 다르고, 괄호 안에도
// ","가 섞여있어(예: "석남1동(456~467, 480~484)") 괄호 밖의 구분자만 기준으로 쪼갬
export function splitZoneNames(text) {
  const zones = [];
  let current = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);

    if ((ch === '+' || ch === ',') && depth === 0) {
      zones.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) zones.push(current);
  return zones.map((z) => z.trim()).filter(Boolean);
}

// "석남1동(456~467, 480~484)" -> "석남1동" 처럼 끝에 붙은 부연설명 괄호를 제거
export function normalizeZoneName(zone) {
  let name = zone.trim();
  while (/\([^()]*\)\s*$/.test(name)) {
    name = name.replace(/\s*\([^()]*\)\s*$/, '').trim();
  }
  return name;
}

// 관리구역 칸에 구역 이름 대신 배출 방법 설명문이 통째로 들어간 경우 (원본 데이터 입력 오류, 백엔드와 같은 기준)
// 예: 대구 북구 "북구 전역(배출방법) 1. 스티커 구입하여 ... (여기로, www.yeogiro24.co.kr) ..."
export function isDescriptiveZoneName(name) {
  return name.length > 40 || /https?:|www\.|\d{2,4}-\d{3,4}|(^|\s)\d+\.\s/.test(name);
}

// 화면에 보여줄 구역 이름: 설명문형이면 괄호 앞부분(예: "북구 전역")만 남기고, 그것도 없으면 null
export function zoneDisplayName(zone) {
  const name = normalizeZoneName(zone);
  if (!isDescriptiveZoneName(name)) return name;
  const head = name.split('(')[0].trim();
  return head && !isDescriptiveZoneName(head) ? head : null;
}

// API 원본 데이터에서 종종 끝이 잘려서 들어오는 항목명을 정상 형태로 되돌림
const TRUNCATED_TEXT_FIXES = {
  재활용쓰: '재활용쓰레기',
  음식물쓰: '음식물쓰레기',
  일반쓰: '일반쓰레기',
};

// "집앞+상가 앞", "일요일+설명절+추석명절+공휴일" 처럼 "+"로 여러 항목이 붙어서 오는
// 텍스트를 ", "로 구분해 보여주고, 잘린 채로 들어오는 항목명은 정상 형태로 보정
export function formatItemList(text) {
  if (!text) return text;
  return text
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => TRUNCATED_TEXT_FIXES[s] || s)
    .join(', ');
}

export const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

// 품목별 아이콘 (없는 카테고리는 화면에서 기본 아이콘으로 대체)
export const CATEGORY_META = {
  음식물쓰레기: { icon: '🍚' },
  일반쓰레기: { icon: '🗑️' },
  재활용품: { icon: '♻️' },
};

function parseDays(dowStr) {
  if (!dowStr) return [];
  return dowStr.split('+').map((d) => d.trim()).filter(Boolean);
}

// 배출 규칙 한 건의 품목별(음식물/일반/재활용) 요일·시간·방법 정보 (시간은 "HH:MM"으로 통일, 알 수 없으면 null)
export function getScheduleCategories(r) {
  return [
    {
      name: '음식물쓰레기',
      dow: r.FOD_WST_EMSN_DOW,
      begin: normalizeTime(r.FOD_WST_EMSN_BGNG_TM),
      end: normalizeTime(r.FOD_WST_EMSN_END_TM),
      method: r.FOD_WST_EMSN_MTHD,
    },
    {
      name: '일반쓰레기',
      dow: r.LF_WST_EMSN_DOW,
      begin: normalizeTime(r.LF_WST_EMSN_BGNG_TM),
      end: normalizeTime(r.LF_WST_EMSN_END_TM),
      method: r.LF_WST_EMSN_MTHD,
    },
    {
      name: '재활용품',
      dow: r.RCYCL_EMSN_DOW,
      begin: normalizeTime(r.RCYCL_EMSN_BGNG_TM),
      end: normalizeTime(r.RCYCL_EMSN_END_TM),
      method: r.RCYCL_EMSN_MTHD,
    },
  ].filter((cat) => isValid(cat.method));
}

// Date의 요일을 DAYS 표기('월'~'일')로 변환 (getDay()는 일요일이 0)
export function getDayName(date) {
  return DAYS[(date.getDay() + 6) % 7];
}

// "20:00" → 1200(분). 형식이 다르면 null
function toMinutes(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// 배출 시간을 "HH:MM"으로 통일. 원본 데이터는 대부분 "20:00"이지만 일부(예: 경기 광명시)는
// "2400", "2000"처럼 콜론 없이 들어와서, 그대로 두면 '오늘 배출'에서 시간 정보 없음으로 보였음.
// 알아볼 수 없는 값이면 null
export function normalizeTime(value) {
  const text = String(value ?? '').trim();
  const match = /^(\d{1,2}):?(\d{2})$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// 현재 시각 기준으로 품목별 배출 가능 여부를 계산.
// 반환: [{ name, status: 'now' | 'today' | 'later', text }] (지금 가능 → 오늘 이따가 → 다른 날 순)
// "20:00~06:00"처럼 끝 시간이 시작보다 이르면 다음 날 아침까지 이어지는 것으로 봄
// (예: 월요일 20:00~06:00이면 화요일 새벽 5시에도 배출 가능)
export function getAvailability(record, now = new Date()) {
  const todayIdx = DAYS.indexOf(getDayName(now));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const STATUS_ORDER = { now: 0, today: 1, later: 2 };

  return getScheduleCategories(record)
    .map((cat) => {
      const days = parseDays(cat.dow);
      const allowed = days.length >= 7 ? DAYS : days;
      const has = (offset) => allowed.includes(DAYS[(todayIdx + offset + 7) % 7]);
      const begin = toMinutes(cat.begin);
      const end = toMinutes(cat.end);

      // 시간 정보가 없으면 요일만 보고 판단
      if (begin === null || end === null) {
        if (has(0)) return { name: cat.name, status: 'now', text: '오늘 배출 (시간 정보 없음)' };
      } else {
        const overnight = end <= begin;
        const inTodayWindow = has(0) && nowMin >= begin && (overnight || nowMin < end);
        const inYesterdayWindow = overnight && has(-1) && nowMin < end;
        if (inTodayWindow || inYesterdayWindow) {
          const endsTomorrow = inTodayWindow && overnight;
          return { name: cat.name, status: 'now', text: `${endsTomorrow ? '내일 ' : ''}${cat.end}까지` };
        }
        if (has(0) && nowMin < begin) {
          return { name: cat.name, status: 'today', text: `오늘 ${cat.begin}부터` };
        }
      }

      for (let offset = 1; offset <= 7; offset += 1) {
        if (has(offset)) {
          const dayLabel = offset === 1 ? '내일' : `${DAYS[(todayIdx + offset) % 7]}요일`;
          return {
            name: cat.name,
            status: 'later',
            text: begin === null ? `${dayLabel} 배출` : `${dayLabel} ${cat.begin}부터`,
          };
        }
      }
      return { name: cat.name, status: 'later', text: '배출 요일 정보 없음' };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

// 카테고리별(음식물/일반/재활용) 데이터를 "요일별" 데이터로 뒤집어주는 함수
export function buildWeeklyRows(r) {
  const categories = getScheduleCategories(r);

  const dayMap = {};
  DAYS.forEach((d) => {
    dayMap[d] = [];
  });

  categories.forEach((cat) => {
    const days = parseDays(cat.dow);
    const timeText = cat.begin && cat.end ? `${cat.begin}~${cat.end}` : '시간 정보 없음';
    const targetDays = days.length >= 7 ? DAYS : days;
    targetDays.forEach((d) => {
      if (dayMap[d]) {
        dayMap[d].push({ name: cat.name, time: timeText });
      }
    });
  });

  return DAYS.map((d) => ({ day: d, items: dayMap[d] }));
}

// 화면에 실제로 보여지는 내용(제목/요일별 표/대형폐기물 안내 등)이 완전히 같은 레코드는
// 수거 지점만 다른 중복으로 보고 하나만 남김
export function dedupeScheduleResults(results) {
  const seen = new Set();
  return results.filter((r) => {
    const key = JSON.stringify({
      title: isValid(r.MNG_ZONE_TRGT_RGN_NM) ? r.MNG_ZONE_TRGT_RGN_NM : `${r.CTPV_NM} ${r.SGG_NM}`,
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
}