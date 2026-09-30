export function getCurrentLocation(options = { enableHighAccuracy: true, timeout: 10000 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 브라우저는 위치 정보를 지원하지 않아요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      (err) => reject(err),
      options
    );
  });
}

// 위치 권한 상태: 'granted'(허용) | 'denied'(거절) | 'prompt'(아직 안 정함) | 'unknown'(브라우저가 알려주지 않음)
export async function getGeolocationPermission() {
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'unknown';
  }
}

// 위치 권한 상태가 바뀌면(예: 권한 창에서 뒤늦게 '허용'을 누름) onChange(state)를 호출.
// 구독 해제 함수를 돌려줌 (브라우저가 지원하지 않으면 아무것도 하지 않음)
export function watchGeolocationPermission(onChange) {
  let status = null;
  let cancelled = false;
  const handleChange = () => onChange(status.state);

  navigator.permissions
    ?.query({ name: 'geolocation' })
    .then((s) => {
      if (cancelled) return;
      status = s;
      status.addEventListener('change', handleChange);
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    status?.removeEventListener('change', handleChange);
  };
}
