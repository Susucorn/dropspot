import { BASE_URL } from './config';

export function searchWasteItems(query) {
  return fetch(`${BASE_URL}/api/waste-items/search?q=${encodeURIComponent(query)}`).then((res) =>
    res.json()
  );
}