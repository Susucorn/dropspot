export function isValid(text) {
  return text && text !== '해당없음' && text !== '없음';
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
        dayMap[d].push(`${cat.name} (${timeText})`);
      }
    });
  });

  return DAYS.map((d) => ({ day: d, items: dayMap[d] }));
}