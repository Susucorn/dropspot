const BASE_URL = 'http://localhost:4000';

export function fetchRegions() {
  return fetch(`${BASE_URL}/api/regions`).then((res) => res.json());
}

export function fetchTrashbinsByRegion(sido) {
  return fetch(`${BASE_URL}/api/trashbins?sido=${encodeURIComponent(sido)}`).then((res) => res.json());
}

export function fetchNearbyTrashbins(lat, lng, radius = 1) {
  return fetch(`${BASE_URL}/api/trashbins/nearby?lat=${lat}&lng=${lng}&radius=${radius}`).then((res) =>
    res.json()
  );
}