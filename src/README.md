# src/ — 전체 구조 인덱스

각 폴더의 역할과 관계를 한눈에 보여주는 루트 인덱스 문서입니다.
폴더별 상세 문서가 있는 경우 해당 링크를 참고하세요.

---

## 1. 폴더 트리

```
src/
├── api/          # 서버 통신 함수 + 공용 axios 인스턴스 (인증·에러 인터셉터 포함)
├── auth/         # 토큰·사용자 정보 로컬 저장소 + 카카오 로그인 훅
├── components/   # 여러 화면에서 재사용하는 UI 컴포넌트
├── config/       # 환경 변수·지도 설정·설문 질문 config
├── data/         # 정적 데이터 (태그 목록, 목업 JSON)
├── hooks/        # 위치 관련 커스텀 훅
├── navigation/   # 화면 라우팅 타입 정의
├── screens/      # 앱의 각 화면 컴포넌트
├── theme/        # 디자인 토큰 (색상·여백·반경·그림자)
├── types/        # 백엔드 스키마 및 공유 타입
└── utils/        # 순수 함수 유틸리티
```

---

## 2. 앱 전체 화면 흐름 (`App.tsx`)

> `src/screens/README.md`에 각 화면의 상세 설명이 있습니다.
> 아래는 `App.tsx`가 관리하는 **상태 분기 흐름**입니다 (최신 기준, SurveyScreen 포함).

```
BrandSplashScreen (2초 타이머)
        │
        ▼
OnboardingScreen ── 최초 1회만 (SecureStore에 열람 기록 저장)
        │
        ▼
LoginScreen ── 카카오 로그인 → authState: 'loggedIn'
        │
        ▼  GET /api/user/survey (8초 타임아웃)
        │
        ├─ survey_completed: false ──▶ SurveyScreen ── "완료" → 다음 단계
        ├─ survey_completed: true  ──▶ (스킵)
        └─ GET 실패                ──▶ SurveyScreen (pending 폴백)
        │
        ▼
LocationPermissionScreen ── onRequest / onSkip
        │
        ▼
ActivityPermissionScreen ── onGranted / onSkip
        │
        ▼
HomeScreen (메인 화면)
```

`App.tsx`가 보유한 주요 상태:

| 상태 | 타입 | 역할 |
|---|---|---|
| `showBrandSplash` | `boolean` | 스플래시 2초 타이머 |
| `onboardingStatus` | `'checking' \| 'seen' \| 'unseen'` | 온보딩 노출 여부 |
| `authState` | `'loading' \| 'loggedIn' \| 'loggedOut'` | 로그인 상태 (`useKakaoAuth`) |
| `surveyStatus` | `'checking' \| 'pending' \| 'completed'` | 설문 완료 여부 |
| `permissionStatus` | `'checking' \| 'granted' \| 'denied' \| 'undetermined'` | 위치 권한 |
| `activityStatus` | `'checking' \| 'granted' \| 'denied' \| 'undetermined'` | 활동 권한 |

---

## 3. screens/

앱의 각 화면 컴포넌트를 담습니다. `App.tsx`와 `HomeScreen.tsx`가 `useState`만으로 화면을 분기합니다. React Navigation 같은 라우팅 라이브러리를 쓰지 않습니다.

→ **상세 문서:** [`src/screens/README.md`](./screens/README.md)

---

## 4. components/

여러 화면에서 재사용하는 UI 컴포넌트를 기능별 하위 폴더(`chat/` `map/` `my/` `record/` `walk/`)로 나눠 담습니다. 특정 화면에만 쓰이는 컴포넌트도 화면 파일이 커지면 이 폴더로 분리합니다.

→ **상세 문서:** [`src/components/README.md`](./components/README.md)

---

## 5. api/

```
src/api/
├── client.ts    # 공용 axios 인스턴스 — 인터셉터로 토큰 자동 부착 + 401 처리
├── prewalk.ts   # 챗봇 세션 관련 API (initMessage, sendMessage 등)
├── routes.ts    # 산책 기록 API (getRouteHistories, toggleFavoriteRoute)
├── survey.ts    # 설문 API (getSurvey, postSurvey)
└── README.md
```

모든 API 함수는 `axios`를 직접 import하지 않고 `client`를 import해서 씁니다.

```ts
import { client } from './client';

export const getRouteHistories = async () => {
  const { data } = await client.get('/api/user/routes');
  return data;
};
```

---

### 5-1. `client.ts` 인터셉터 동작

`client.ts`는 두 개의 인터셉터를 붙여 인증을 자동화합니다.

**요청 인터셉터** — 모든 요청 직전에 실행:
- `authStorage`에서 `accessToken`을 읽어 `Authorization: Bearer <token>` 헤더를 자동으로 붙입니다.
- 쿠키 인증도 병행 지원(`Cookie: access_token=<token>`)합니다.

**응답 인터셉터 — 401 처리 흐름:**

```
API 응답 401 수신
        │
        ▼
이미 재시도한 요청? (_retry: true)
  YES ──▶ reject (로그아웃 처리)
        │
        ▼ NO
refreshToken을 SecureStore에서 꺼냄
        │
  없음 ──▶ clearAuthAndNotify() → 강제 로그아웃
        │
        ▼ 있음
GET /api/auth/check/refresh_token
  Authorization: Bearer <refreshToken>
        │
  실패 / status !== 'success'
        ──▶ clearAuthAndNotify() → 강제 로그아웃
        │
        ▼ status: 'success'
새 accessToken을 SecureStore에 저장
원래 요청 헤더를 새 토큰으로 교체 후 재시도 (_retry: true)
```

`clearAuthAndNotify()`는 SecureStore의 userId·토큰·닉네임·이메일을 모두 지우고 `DeviceEventEmitter.emit('auth:forceLogout')`을 발생시킵니다. `useKakaoAuth`가 이 이벤트를 수신해 `authState: 'loggedOut'`으로 전환하면 `App.tsx`가 LoginScreen을 렌더링합니다.

> **refresh token 요청은 쿼리 파라미터가 아닌 Authorization 헤더로 전달합니다.**
> 쿼리 파라미터로 보내면 서버가 인식하지 못합니다.

---

### 5-2. [DEV] 전용 테스트 버튼

마이페이지(`src/screens/MyScreen.tsx`) 하단에 `__DEV__` 블록으로 감싼 두 개의 버튼이 있습니다. **프로덕션 빌드에는 포함되지 않습니다.**

#### [DEV] 토큰 강제 만료

```ts
// MyScreen.tsx
await authStorage.setAccessToken('invalid_token_for_test');
```

SecureStore의 `accessToken`을 유효하지 않은 값으로 덮어씁니다. 이후 아무 API 호출이 일어나면 서버가 401을 반환하고 `client.ts` 인터셉터의 refresh 흐름이 실제로 타는지 확인할 수 있습니다.

**재테스트 순서:**
1. 마이페이지 → `[DEV] 토큰 강제 만료` 버튼 클릭
2. 홈 탭 이동 → 챗봇 메시지 전송 (API 호출 트리거)
3. Metro 로그에서 401 → refresh 시도 → 재시도 성공/실패 확인

#### [DEV] 설문 화면 다시 보기

```ts
// App.tsx에서 HomeScreen으로 전달한 콜백
onResetSurvey={() => setSurveyStatus('pending')}
```

서버 DB(`user_preferences.survey_completed`)를 건드리지 않고 클라이언트의 `surveyStatus`만 `'pending'`으로 강제 전환합니다. 즉시 `SurveyScreen`이 렌더링됩니다. 재로그인·DB 수정 없이 설문 UI를 반복 테스트할 수 있습니다.

콜백 전달 경로: `App.tsx` → `HomeScreen` (prop) → `MyScreen` (prop) → 버튼 `onPress`

**재테스트 순서:**
1. 마이페이지 → `[DEV] 설문 화면 다시 보기` 버튼 클릭
2. SurveyScreen이 즉시 뜨는지 확인
3. 태그 선택 후 "완료" → Metro 로그에서 POST 응답의 weights 값 확인

---

## 6. auth/

```
src/auth/
├── authStorage.ts       # SecureStore 기반 토큰·사용자 정보 저장소
├── onboardingStorage.ts # SecureStore 기반 온보딩 열람 기록 저장소
└── useKakaoAuth.ts      # 카카오 로그인/로그아웃 + authState 관리 훅
```

**`authStorage`** 는 다섯 가지 키(`kakao_user_id`, `app_access_token`, `app_refresh_token`, `user_nickname`, `user_email`)를 `expo-secure-store`에 저장합니다. 앱을 삭제하기 전까지는 기기에 남아 있어 재실행 시 자동 로그인이 가능합니다.

**`useKakaoAuth`** 는 마운트 시 `getUserId()` 로 저장된 userId 유무를 확인해 `authState`를 `'loggedIn'` 또는 `'loggedOut'`으로 초기화합니다. `DeviceEventEmitter`의 `'auth:forceLogout'` 이벤트를 구독해, `client.ts` 인터셉터가 refresh 실패를 감지했을 때 자동으로 로그아웃 상태로 전환됩니다.

```ts
// App.tsx에서 사용
const { authState, userId, signIn, signOut } = useKakaoAuth();
```

---

## 7. config/

```
src/config/
├── env.ts              # process.env에서 환경 변수를 읽어 단일 객체로 내보냄
├── mapConfig.ts        # Mapbox 지도 스타일 URL 상수
└── surveyQuestions.ts  # 설문 화면 태그 목록 + 카테고리 구조
```

**`env.ts`** — `EXPO_PUBLIC_` prefix 환경 변수 5개를 중앙 관리합니다. 환경 변수를 직접 `process.env`로 읽지 말고 이 파일을 import해서 쓰세요.

```ts
import { env } from '../config/env';
// env.API_BASE_URL / env.MAPBOX_PUBLIC_ACCESS_TOKEN / env.DEBUG_FIXED_LOCATION 등
```

**`surveyQuestions.ts`** — 설문에 표시할 15개 태그를 4개 카테고리(자연/지형·안전/분위기/동반자)로 분류합니다. 태그 문자열은 직접 하드코딩하지 않고 `src/data/onboarding.ts`의 `PREFERENCE_TAGS`에서 타입(`PreferenceTag`)을 파생해 사용합니다. `tagValue`에 오타가 있으면 `tsc`가 즉시 에러를 냅니다.

```ts
// 태그 추가/수정은 이 파일만 건드리면 됩니다
import { surveyQuestions } from '../config/surveyQuestions';
const allTags = surveyQuestions.flatMap(q => q.options);
```

---

## 8. data/

```
src/data/
├── onboarding.ts    # PREFERENCE_TAGS — 취향 태그 27개 문자열 배열 (as const)
├── mockRoute.json   # 목업 경로 좌표 데이터
└── mockPois.json    # 목업 POI(관심 장소) 데이터
```

**`PREFERENCE_TAGS`** 는 백엔드 `TAG_WEIGHT_MAP`의 키와 1:1 대응하는 27개 문자열 목록입니다. `as const`로 선언되어 있어 `typeof PREFERENCE_TAGS[number]`로 리터럴 유니온 타입을 파생할 수 있습니다. 이 배열이 태그 문자열의 **Single Source of Truth**입니다.

- `src/config/surveyQuestions.ts`가 이 타입을 import해 설문 config의 타입 안전성을 보장합니다.
- `src/components/my/MyPreferenceComponent.tsx`가 이 배열을 직접 import해 27개 태그를 전부 렌더링합니다.

태그를 추가하거나 이름을 바꾸려면 백엔드 `TAG_WEIGHT_MAP`과 이 파일을 함께 수정해야 합니다.

---

## 9. hooks/

```
src/hooks/
├── useLocation.ts       # 1회성 현재 위치 조회 (메인 화면용)
└── useWatchLocation.ts  # 실시간 위치 추적 (산책 진행 중 6b용)
```

두 훅 모두 `src/types/location.ts`의 `Coordinates` 타입(`{ latitude, longitude }`)을 반환합니다.

**`useLocation`** 은 컴포넌트 마운트 시 한 번만 위치를 읽습니다. `.env`의 `EXPO_PUBLIC_DEBUG_FIXED_LOCATION`이 설정되어 있으면 실제 GPS 대신 고정 좌표를 반환합니다 (서울 외부에서 개발할 때 유용).

```ts
// 서울 서비스 구역 밖 개발 시 .env에 추가
EXPO_PUBLIC_DEBUG_FIXED_LOCATION=37.5665,126.9780
```

**`useWatchLocation`** 은 `Location.watchPositionAsync`로 5m 이상 이동할 때마다 좌표를 갱신합니다. 위치 권한이 이미 허용된 상태(App.tsx 권한 플로우 통과 후)에서만 사용합니다.

---

## 10. navigation/

```
src/navigation/
└── types.ts    # Route · TabName · Navigate 타입 정의
```

React Navigation 같은 라이브러리를 쓰지 않기 때문에, 화면 전환 타입을 직접 정의해서 씁니다.

```ts
type Route =
  | { name: 'home' }
  | { name: 'chat' }
  | { name: 'walk'; id: string }
  | { name: 'realWalk' }
  | { name: 'postwalk'; id: string }
  | { name: 'record' }
  | { name: 'me' };

type Navigate = (route: Route | TabName) => void;
```

`HomeScreen`이 `Route` 상태를 들고 `go(next)` 함수로 탭 전환과 화면 이동을 모두 처리합니다.

---

## 11. theme/

```
src/theme/
└── tokens.ts    # colors · spacing · radii · shadows
```

| 토큰 | 내용 |
|---|---|
| `colors` | 배경·텍스트·강조색·지도색 등 30개 이상의 색상 변수 |
| `spacing` | `xs(4)` `sm(8)` `md(12)` `lg(16)` `xl(20)` `xxl(28)` |
| `radii` | `sm(8)` `md(12)` `lg(16)` `xl(24)` |
| `shadows` | `soft` (카드용) · `map` (지도 위 플로팅 UI용) |

스타일시트에서 직접 숫자를 쓰지 말고 이 토큰을 import해서 씁니다.

```ts
import { colors, spacing, radii } from '../theme/tokens';
```

---

## 12. types/

백엔드 스키마를 그대로 반영하는 타입과 앱 내부 공유 타입을 담습니다.

```
src/types/
├── location.ts   # Coordinates (기기 GPS 좌표 — useLocation/useWatchLocation 공용)
├── map.ts        # LatLng (lat/lng 키 기반 좌표)
├── prewalk.ts    # 챗봇·경로 관련 스키마 (InitRequest, WalkRouteResponse, WalkMode 등)
├── routes.ts     # 산책 기록 스키마 (RouteHistoryItem, RouteHistoryQuery 등)
└── walk.ts       # WalkEndSnapshot (산책 종료 시 6b→6c로 넘기는 스냅샷)
```

> `src/api/` 폴더의 요청·응답 타입은 각 API 파일(`survey.ts` 등) 안에 인라인으로 정의합니다.
> 백엔드 스키마와 공유하거나 여러 파일에서 쓰이는 타입만 이 폴더에 둡니다.

---

## 13. utils/

순수 함수 모음입니다. React에 의존하지 않고 단독으로 테스트 가능합니다.

```
src/utils/
├── geo.ts              # [lat,lon] → [lng,lat] 변환, Mapbox 카메라 bounding box 계산
├── geoProjection.ts    # 목업 경로에서 진행률(0~1)에 해당하는 GPS 좌표 계산
├── reverseGeocode.ts   # 좌표 → 장소명 역지오코딩 (Mapbox Geocoding API, 메모리 캐시)
├── routeHistory.ts     # RouteHistoryItem → WalkRouteResponse 변환 (기록 → 재산책)
├── routeThumbnail.ts   # 경로 좌표 → Mapbox Static Images URL 생성 (공유 카드용)
├── walkEstimate.ts     # km → 소요시간·칼로리·걸음수 추정 (평균 보행 속도 기준)
├── walkMode.ts         # WalkMode enum → 한글 라벨 (순환 코스, 편도 코스)
└── walkProgress.ts     # 실시간 GPS + 경로 좌표 → 진행률·이동 거리 계산
```

`geoProjection.ts`는 `mockRoute.json` 목업 데이터를 직접 import합니다. 실제 경로 데이터로 전환하면 이 파일을 교체해야 합니다.

---

## 14. 주의할 점

**미사용 파일**
- `src/components/map/DynamicPOILayer.tsx` — 앱 어디서도 import되지 않음
- `src/components/map/StaticPOILayer.tsx` — 동일

**건드리기 전에 확인이 필요한 영역**

- **`src/api/client.ts`** — 인터셉터 로직을 수정하면 모든 API 호출의 인증 흐름이 바뀝니다. refresh token 요청 방식(현재 Authorization 헤더)은 쿼리 파라미터로 되돌리지 마세요 (서버가 인식 불가).
- **`src/data/onboarding.ts`** — `PREFERENCE_TAGS` 문자열은 백엔드 `TAG_WEIGHT_MAP` 키와 정확히 일치해야 합니다. 이름을 바꾸거나 추가하려면 백엔드와 반드시 동기화하세요.
- **`src/config/surveyQuestions.ts`** — `tagValue`는 `PreferenceTag` 타입으로 강제되므로 `PREFERENCE_TAGS`에 없는 문자열을 넣으면 `tsc`에서 에러가 납니다. 의도된 동작입니다.
- **`__DEV__` 버튼 (`MyScreen.tsx`)** — 프로덕션 빌드에는 포함되지 않습니다. 버튼을 추가할 때는 반드시 `{__DEV__ && ( ... )}` 블록 안에 넣으세요.
