# DropSpot

> 내 주변 쓰레기통 찾고, 올바르게 분리배출해요

DropSpot은 공공데이터를 모아 **내 주변 쓰레기통·재활용센터·의류수거함 위치**를 지도에 보여 주고,
**우리 동네 생활쓰레기 배출 규칙**과 **품목별 분리배출 방법**을 함께 안내하는 웹 서비스입니다.

## 주요 기능

- **쓰레기통 지도** — 카카오맵 위에 일반 / 재활용 / 겸용 쓰레기통, 재활용센터, 의류수거함을 종류별로 표시
  - 내 위치 주변 보기, 시도별 보기, 지도를 옮기면 화면 영역 안의 데이터를 다시 불러오기
  - 줌 아웃 시 마커 클러스터링, 종류별 필터(범례 클릭)
  - 주소·지역 검색
- **배출 규칙 안내** — 선택한 위치(또는 지도 중심)의 지역 기준으로
  - **오늘 배출**: 지금 배출 가능한 품목과 다음 배출 시간
  - **배출 시간표 보기**: 요일 × 품목 표
- **품목 찾기** — 품목 이름으로 분리배출 방법 검색 (기후에너지환경부 분리배출 정보조회 서비스)
- **쓰레기통 신고** — 파손 / 없음 / 이동됨 / 가득 참 / 오염 / 기타 상태를 사진(최대 3장)과 함께 신고
- **모바일 대응** — 모바일에서는 하단 시트(bottom sheet) UI, PWA 아이콘·매니페스트 제공

## 기술 스택

| 구분 | 사용 기술 |
| --- | --- |
| 프론트엔드 | React 19, Vite, React Router, react-kakao-maps-sdk, CSS Modules, oxlint |
| 백엔드 | Node.js 22, Express 5, @supabase/supabase-js |
| 저장소 | Supabase (신고 DB + 사진 저장공간), 로컬 파일(개발용) |
| 배포 | 프론트엔드: Vercel / 백엔드: Render |

## 프로젝트 구조

```
DropSpot/
├── backend/
│   ├── index.js            # Express API 서버 (공공 API 수집·캐싱, 신고 접수)
│   ├── data/trashbin.json  # 전국휴지통표준데이터 (서버 시작 시 메모리에 로드)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/          # TrashMap(메인 지도 화면) 등
│   │   ├── components/     # 배출 규칙 패널, 신고 모달, 모바일 하단 시트, 위치 권한 안내 등
│   │   ├── api/            # 백엔드 API 호출 함수
│   │   ├── utils/          # 지도·클러스터·배출 규칙·위치 관련 유틸
│   │   └── styles/         # CSS Modules
│   ├── vercel.json         # SPA 라우팅 설정
│   └── .env.example
└── render.yaml             # Render 백엔드 배포 설정 (Blueprint)
```

## 시작하기

### 1. 준비물

- Node.js 22 이상
- [공공데이터포털](https://www.data.go.kr/) 인증키 — 아래 [데이터 출처](#데이터-출처)의 API들을 활용신청해야 합니다
- [카카오 개발자](https://developers.kakao.com/) JavaScript 키 — 사이트 도메인에 `http://localhost:5173` 등록
- (선택) [Supabase](https://supabase.com/) 프로젝트 — 신고 내용을 저장할 때 사용

### 2. 백엔드 실행

```bash
cd backend
npm install
cp .env.example .env   # 값 채우기
npm run dev            # 또는 npm start
```

서버는 기본적으로 `http://localhost:4000`에서 실행됩니다.
시작할 때 공공 API에서 데이터를 불러오므로 몇 초 걸릴 수 있으며, 실패한 데이터는 1분 → 5분 → 15분 → 이후 30분 간격으로 자동 재시도합니다.

`backend/.env`

| 변수 | 설명 |
| --- | --- |
| `HOUSEHOLD_WASTE_SERVICE_KEY` | 공공데이터포털 인증키(Decoding). 배출 규칙·재활용센터·의류수거함·구청별 쓰레기통 API에 공통 사용 |
| `WASTE_ITEM_SERVICE_KEY` | 기후에너지환경부 분리배출 정보조회 서비스 인증키 (품목 찾기) |
| `PORT` | 서버 포트 (기본 4000, Render에서는 자동 지정) |
| `SUPABASE_URL` | Supabase 프로젝트 URL (선택) |
| `SUPABASE_SECRET_KEY` | Supabase Secret key 또는 service_role 키 (선택, **외부 노출 금지**) |

> Supabase 값을 비워 두면 신고는 `backend/data/reports.json`, 사진은 `backend/uploads/reports/`에 저장됩니다.
> 두 경로는 개인 사진이 포함될 수 있어 `.gitignore`에 등록되어 있습니다.

### 3. 프론트엔드 실행

```bash
cd frontend
npm install
cp .env.example .env   # 값 채우기
npm run dev
```

브라우저에서 `http://localhost:5173`을 열면 됩니다.

`frontend/.env`

| 변수 | 설명 |
| --- | --- |
| `VITE_KAKAO_MAP_KEY` | 카카오맵 JavaScript 키 |
| `VITE_API_BASE_URL` | 백엔드 주소 (비워 두면 `http://localhost:4000`) |

기타 스크립트: `npm run build`(빌드), `npm run preview`(빌드 결과 미리보기), `npm run lint`(oxlint)

### 4. (선택) Supabase 설정

1. Storage에 **`report-photos`** 버킷을 만듭니다.
2. 아래와 같이 **`reports`** 테이블을 만듭니다.

```sql
create table reports (
  id            text primary key,
  created_at    timestamptz not null,
  status        text not null,
  memo          text,
  location_name text,
  address       text,
  region        text,
  lat           double precision,
  lng           double precision,
  manager_name  text,
  manager_tel   text,
  photos        text[]
);
```

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/regions` | 휴지통 데이터가 있는 시도 목록 |
| GET | `/api/trashbins?sido=` | 시도별 휴지통 |
| GET | `/api/trashbins/in-bounds?swLat=&swLng=&neLat=&neLng=` | 지도 영역 안의 휴지통 |
| GET | `/api/trashbins/nearby?lat=&lng=&radius=` | 좌표 기준 반경(km) 안의 휴지통 |
| GET | `/api/district-trashbins` | 구청별 공공쓰레기통 데이터 |
| GET | `/api/recycling-centers` (`/in-bounds`, `/nearby`) | 재활용센터 |
| GET | `/api/clothing-bins` (`/in-bounds`, `/nearby`) | 의류수거함 |
| GET | `/api/waste-schedule/regions` | 배출 규칙이 있는 지역 목록 |
| GET | `/api/waste-schedule?ctpv=&sgg=` | 지역별 생활쓰레기 배출 규칙 |
| GET | `/api/waste-items?itemNm=` | 품목별 분리배출 방법 |
| GET | `/api/waste-spots?addr=` | 분리배출 장소 정보 |
| POST | `/api/reports` | 쓰레기통 신고 접수 |

`POST /api/reports` 요청 본문:

```json
{
  "status": "파손",
  "memo": "뚜껑이 부서졌어요",
  "location": { "name": "", "address": "", "region": "", "lat": 0, "lng": 0 },
  "manager": { "name": "", "tel": "" },
  "photos": ["data:image/jpeg;base64,..."]
}
```

- `status`: `파손` · `없음` · `이동됨` · `가득 참` · `오염` · `기타` 중 하나
- 사진: JPG / PNG / WEBP / GIF, 장당 5MB 이하, 최대 3장
- 남용 방지: IP당 10분에 5건까지

## 배포

- **백엔드 (Render)** — Render 대시보드 → New → Blueprint에서 이 저장소를 선택하면 `render.yaml` 설정으로 `dropspot-api` 서비스가 만들어집니다. 인증키와 Supabase 값은 Render 화면에서 직접 입력합니다.
  Render 무료 플랜은 재시작 시 파일이 지워지므로 배포 환경에서는 Supabase 설정을 권장합니다.
- **프론트엔드 (Vercel)** — Root Directory를 `frontend`로 지정하고, 환경변수 `VITE_KAKAO_MAP_KEY`, `VITE_API_BASE_URL`(Render 서버 주소)을 설정합니다. 배포 도메인을 카카오 개발자 콘솔의 사이트 도메인에 추가해야 지도가 표시됩니다.

## 데이터 출처

| 데이터 | 제공 |
| --- | --- |
| [전국휴지통표준데이터](https://www.data.go.kr/data/15129450/standard.do) | 공공데이터포털 |
| [전국재활용센터표준데이터](https://www.data.go.kr/data/15021108/standard.do) | 공공데이터포털 |
| [전국의류수거함표준데이터](https://www.data.go.kr/data/15139214/standard.do) | 공공데이터포털 |
| [생활쓰레기배출정보 조회서비스](https://www.data.go.kr/data/15155080/openapi.do) | 행정안전부 |
| [분리배출 정보조회 서비스](https://www.data.go.kr/data/15156866/openapi.do) | 기후에너지환경부 |
| [부산광역시 남구_공공쓰레기통 현황](https://www.data.go.kr/data/15087700/fileData.do) | 부산광역시 남구 |
| [대구광역시 동구_가로 쓰레기통 설치현황](https://www.data.go.kr/data/15127640/fileData.do) | 대구광역시 동구 |
| [경기도 고양시_가로변 쓰레기통 현황](https://www.data.go.kr/data/15087918/fileData.do) | 경기도 고양시 |
| [전남광주통합특별시 광산구_쓰레기통 현황](https://www.data.go.kr/data/15108027/fileData.do) | 전남광주통합특별시 광산구 |
| [카카오맵 API](https://apis.map.kakao.com/) (지도·주소/장소 검색) | Kakao |
