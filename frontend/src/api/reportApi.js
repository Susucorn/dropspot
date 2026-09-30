import { BASE_URL } from './config';

// 쓰레기통 신고 접수: { status, memo, location, manager, photos(dataURL 배열) }
export async function submitTrashbinReport(report) {
  const res = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || '신고를 보내지 못했어요.');
  }
  return data;
}
