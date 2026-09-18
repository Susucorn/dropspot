const BASE_URL = 'http://localhost:4000';

export function fetchRegions() {
  return fetch(`${BASE_URL}/api/waste-schedule/regions`).then((res) => res.json());
}

export function fetchSchedule(ctpv, sgg) {
  return fetch(
    `${BASE_URL}/api/waste-schedule?ctpv=${encodeURIComponent(ctpv)}&sgg=${encodeURIComponent(sgg)}`
  ).then((res) => res.json());
}