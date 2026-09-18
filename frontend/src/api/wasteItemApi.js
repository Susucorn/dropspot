const BASE_URL = 'http://localhost:4000';

export function searchWasteItems(query) {
  return fetch(`${BASE_URL}/api/waste-items/search?q=${encodeURIComponent(query)}`).then((res) =>
    res.json()
  );
}