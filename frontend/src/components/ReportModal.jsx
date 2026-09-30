import { useEffect, useState } from 'react';
import styles from '../styles/ReportModal.module.css';
import { submitTrashbinReport } from '../api/reportApi';

const STATUS_OPTIONS = [
  { value: '파손', icon: '🔨', desc: '깨지거나 부서졌어요' },
  { value: '없음', icon: '❓', desc: '쓰레기통이 없어요' },
  { value: '이동됨', icon: '↔️', desc: '다른 곳으로 옮겨졌어요' },
  { value: '가득 참', icon: '🗑️', desc: '넘치도록 가득 찼어요' },
  { value: '오염', icon: '🧴', desc: '더럽거나 악취가 나요' },
  { value: '기타', icon: '✏️', desc: '그 밖의 문제' },
];
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'));
    reader.readAsDataURL(file);
  });
}

// 쓰레기통 신고 폼 (모달). location은 선택한 쓰레기통/지역에서 자동으로 채워서 넘겨받음
// location: { name, address, region, lat, lng }, manager: { name, tel }
function ReportModal({ location, manager, onClose }) {
  const [status, setStatus] = useState('');
  const [memo, setMemo] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // ESC로 닫기
  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleAddPhotos(e) {
    const files = [...e.target.files];
    e.target.value = '';
    setError('');

    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setError(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있어요.`);
    const accepted = files.slice(0, room).filter((f) => {
      if (!f.type.startsWith('image/')) {
        setError('사진 파일만 첨부할 수 있어요.');
        return false;
      }
      if (f.size > MAX_PHOTO_BYTES) {
        setError('사진 한 장은 5MB 이하만 첨부할 수 있어요.');
        return false;
      }
      return true;
    });

    try {
      const dataUrls = await Promise.all(accepted.map(readAsDataUrl));
      setPhotos((prev) => [...prev, ...dataUrls.map((url, i) => ({ url, name: accepted[i].name }))]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!status) {
      setError('쓰레기통 상태를 선택해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitTrashbinReport({ status, memo, location, manager, photos: photos.map((p) => p.url) });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 id="report-title" className={styles.title}>
            🚩 쓰레기통 신고하기
          </h3>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        {done ? (
          <div className={styles.doneBox}>
            <p className={styles.doneIcon}>✅</p>
            <p className={styles.doneTitle}>신고가 접수됐어요</p>
            <p className={styles.doneText}>
              소중한 제보 감사해요.
              {manager?.tel && (
                <>
                  <br />
                  급한 문제는 {manager.name} ({manager.tel})로 직접 연락해주세요.
                </>
              )}
            </p>
            <button type="button" className={styles.submitButton} onClick={onClose}>
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <span className={styles.label}>위치 (자동 입력)</span>
              <div className={styles.locationBox}>
                <span className={styles.locationIcon}>📍</span>
                <div>
                  {location.name && <p className={styles.locationName}>{location.name}</p>}
                  <p className={styles.locationAddress}>{location.address || location.region}</p>
                  {typeof location.lat === 'number' && typeof location.lng === 'number' && (
                    <p className={styles.locationCoords}>
                      {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <fieldset className={styles.field}>
              <legend className={styles.label}>
                쓰레기통 상태 <span className={styles.required}>*</span>
              </legend>
              <div className={styles.statusGrid}>
                {STATUS_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`${styles.statusOption} ${status === opt.value ? styles.statusOptionActive : ''}`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={opt.value}
                      checked={status === opt.value}
                      onChange={() => setStatus(opt.value)}
                      className={styles.srOnly}
                    />
                    <span className={styles.statusIcon}>{opt.icon}</span>
                    <span className={styles.statusName}>{opt.value}</span>
                    <span className={styles.statusDesc}>{opt.desc}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.field}>
              <span className={styles.label}>
                사진 첨부 <span className={styles.optional}>(선택, 최대 {MAX_PHOTOS}장)</span>
              </span>
              <div className={styles.photoRow}>
                {photos.map((p, i) => (
                  <div key={i} className={styles.photoThumb}>
                    <img src={p.url} alt={`첨부 사진 ${i + 1}`} />
                    <button
                      type="button"
                      className={styles.photoRemove}
                      onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`사진 ${i + 1} 삭제`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className={styles.photoAdd}>
                    <input type="file" accept="image/*" multiple onChange={handleAddPhotos} className={styles.srOnly} />
                    <span className={styles.photoAddIcon}>📷</span>
                    <span>사진 추가</span>
                  </label>
                )}
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>
                추가 설명 <span className={styles.optional}>(선택)</span>
              </span>
              <textarea
                className={styles.textarea}
                rows={3}
                maxLength={500}
                placeholder="예: 뚜껑이 깨져서 비가 들어가요"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </label>

            {error && <p className={styles.errorText}>{error}</p>}

            <div className={styles.actions}>
              <button type="button" className={styles.cancelButton} onClick={onClose}>
                취소
              </button>
              <button type="submit" className={styles.submitButton} disabled={submitting}>
                {submitting ? '보내는 중...' : '신고 보내기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ReportModal;
