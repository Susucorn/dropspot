const CATEGORY_KEY_MAP = {
  음식물쓰레기: 'food',
  일반쓰레기: 'general',
  재활용품: 'recycle',
  유해쓰레기: 'hazard',
};

export function getCategoryKey(category) {
  return CATEGORY_KEY_MAP[category] || '';
}