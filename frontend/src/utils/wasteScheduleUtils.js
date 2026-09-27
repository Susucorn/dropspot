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

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

function parseDays(dowStr) {
  if (!dowStr) return [];
  return dowStr.split('+').map((d) => d.trim()).filter(Boolean);
}

// 카테고리별(음식물/일반/재활용) 데이터를 "요일별" 데이터로 뒤집어주는 함수
export function buildWeeklyRows(r) {
  const categories = [
    {
      name: '음식물쓰레기',
      dow: r.FOD_WST_EMSN_DOW,
      begin: r.FOD_WST_EMSN_BGNG_TM,
      end: r.FOD_WST_EMSN_END_TM,
      method: r.FOD_WST_EMSN_MTHD,
    },
    {
      name: '일반쓰레기',
      dow: r.LF_WST_EMSN_DOW,
      begin: r.LF_WST_EMSN_BGNG_TM,
      end: r.LF_WST_EMSN_END_TM,
      method: r.LF_WST_EMSN_MTHD,
    },
    {
      name: '재활용품',
      dow: r.RCYCL_EMSN_DOW,
      begin: r.RCYCL_EMSN_BGNG_TM,
      end: r.RCYCL_EMSN_END_TM,
      method: r.RCYCL_EMSN_MTHD,
    },
  ];

  const dayMap = {};
  DAYS.forEach((d) => {
    dayMap[d] = [];
  });

  categories.forEach((cat) => {
    if (!isValid(cat.method)) return;
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