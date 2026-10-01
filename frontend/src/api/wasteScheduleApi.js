import { BASE_URL } from './config';

export function fetchRegions() {
  return fetch(`${BASE_URL}/api/waste-schedule/regions`).then((res) => res.json());
}

// sgg는 비어 있을 수 있음 (세종특별자치시처럼 시군구가 없는 시도)
export function fetchSchedule(ctpv, sgg = '') {
  return fetch(
    `${BASE_URL}/api/waste-schedule?ctpv=${encodeURIComponent(ctpv)}&sgg=${encodeURIComponent(sgg || '')}`
  ).then((res) => res.json());
}