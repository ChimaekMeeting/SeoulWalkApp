# src/ — 전체 구조 인덱스

각 폴더의 역할과 관계를 한눈에 보여주는 루트 인덱스 문서입니다.
폴더별 상세 문서가 있는 경우 해당 링크를 참고하세요.

---

## 1. 폴더 트리

```
src/
├── api/          # 서버 통신 함수 + 공용 axios 인스턴스 (인증·에러 인터셉터 포함)
├── auth/         # 토큰·사용자 정보 로컬 저장소 + 카카오 로그인 훅 + 앱 부트스트랩 상태
├── bottomsheets/ # 바텀시트(gorhom) 화면별 설정 (스냅포인트 계산 등)
├── components/   # 여러 화면에서 재사용하는 UI 컴포넌트
├── config/       # 환경 변수·지도 설정·설문 질문 config
├── data/         # 정적 데이터 (태그 목록, 목업 JSON)
├── hooks/        # 위치·앱 상태(포그라운드/백그라운드) 관련 커스텀 훅
├── navigation/   # MainRouter 내부 탭 전환 타입 + react-navigation 컨테이너 ref
├── screens/      # 앱의 각 화면 컴포넌트
├── theme/        # 디자인 토큰 (색상·여백·반경·그림자)
├── types/        # 백엔드 스키마 및 공유 타입 (react-navigation의 RootStackParamList 포함)
└── utils/        # 순수 함수 유틸리티
```

---

## 2. 앱 전체 화면 흐름 (`App.tsx`)

> `src/screens/README.md`에 각 화면의 상세 설명이 있습니다.

`App.tsx`는 `@react-navigation/native-stack` 기반 `Stack.Navigator` 하나로 8개 화면을 관리합니다. "지금 어떤 화면을 보여줄지"를 판단하는 로직 자체는 화면 컴포넌트가 아니라 **`src/auth/AppBootstrap.tsx`**(Context Provider)가 전담합니다.

```
GestureHandlerRootView
  SafeAreaProvider
    NavigationContainer (ref: navigationRef)
      BottomSheetModalProvider
        AppBootstrapProvider   ← 상태 계산 + navigation.reset() 호출
          RootNavigator (Stack.Navigator, 8개 Stack.Screen)
```

`AppBootstrap.tsx`의 `computeTargetScreen()`이 여러 상태(스플래시 타이머·온보딩 열람 여부·로그인 상태·설문 완료 여부·위치/활동 권한)를 우선순위대로 검사해 다음에 보여줄 화면 이름 하나(`RootScreenName`)를 계산합니다. 이 값이 바뀔 때마다 화면 컴포넌트 안이 아니라 Provider 안에서 `navigationRef.reset({ index: 0, routes: [{ name: targetScreen }] })`을 호출해 imperative하게 전환합니다 — `.replace()` 대신 `.reset()`을 쓰는 이유는 뒤로가기 히스토리를 아예 안 남기기 위해서입니다(예: 로그인 화면으로 백 제스처가 되면 안 됨).

```
BrandSplash (2초 타이머)
        │
        ▼
Loading ── 온보딩 열람 기록 + 걸음 수 권한 안내 완료 여부 확인 중
        │
        ▼
Onboarding ── 최초 1회만 (SecureStore `has_seen_onboarding`='true' 저장 성공 후 통과)
        │
        ▼
Login ── 카카오 로그인
        │
        ▼  GET /api/user/survey (8초 타임아웃)
        │
        ├─ survey_completed: false ──▶ Survey
        ├─ survey_completed: true  ──▶ (스킵)
        └─ GET 실패                ──▶ Survey (pending 폴백)
        │
        ▼
LocationPermission ── onRequest (위치는 필수 — 건너뛰기 없음)
        │  · granted가 아니면 항상 이 화면. 설정에서 켜고 돌아오면 자동 통과.
        ▼
ActivityPermission ── onGranted / onDenied / onSkip (걸음 수는 선택)
        │  · 허용 또는 건너뛰기 시 SecureStore `activity_prompt_done`='true' 저장 → 이후(앱 재실행 포함) 안 나옴.
        │  · "거부"만 누르면 저장 안 함 → 화면에 남아 "설정에서 허용" 재시도 가능.
        │  · 한 번 통과한 뒤엔 설정에서 나중에 꺼도 이 화면으로 강제 이동하지 않음(거리 추정으로 진행).
        ▼
Home (메인 화면)
```

`AppBootstrap`은 로그인 직후 1회, 그리고 앱이 포그라운드로 돌아올 때마다 `refreshPermissions()`로 **위치·걸음 수 권한을 OS에 다시 확인**합니다(설정 앱에서 켜거나 끈 상황 대응). OS 조회 로직은 `src/auth/permissions.ts`에 모여 있고, 산책 진입 직전에도 `ensureWalkable()`로 위치 권한을 최종 확인합니다.

각 화면은 `App.tsx`에 `XxxScreenContainer` 함수로 정의되어 `useAppBootstrap()`으로 Provider 값을 꺼내 실제 화면 컴포넌트(`src/screens/*`)에 props로 꽂아줍니다. `RootStackParamList`(8개 화면 이름)는 `src/types/navigation.ts`에, `NavigationContainer`에 물리는 `navigationRef`는 `src/navigation/navigationRef.ts`에 있습니다.

---

## 3. screens/

앱의 각 화면 컴포넌트를 담습니다. 화면 **전환 자체**는 위에서 설명한 `Stack.Navigator`가 담당하지만, **`MainRouter.tsx` 내부**(하단 탭 home/record/me, 그리고 산책 플로우 realWalk)는 여전히 자체 `Route` 타입(`src/navigation/types.ts`)과 로컬 `useState`로 전환합니다 — 여기엔 React Navigation을 쓰지 않는 게 의도된 설계입니다(자세한 이유는 `src/screens/README.md` 참고).

→ **상세 문서:** [`src/screens/README.md`](./screens/README.md)

---

## 4. components/

여러 화면에서 재사용하는 UI 컴포넌트를 기능별 하위 폴더(`chat/` `map/` `my/` `record/`)로 나눠 담습니다. 특정 화면에만 쓰이는 컴포넌트도 화면 파일이 커지면 이 폴더로 분리합니다. 최상위엔 공통 프리미티브(`Button` `ErrorBanner` `StatRow` `ScreenHeader` `PermissionPrompt` `TabScreen`)와 `AppBottomSheet.tsx`(gorhom `BottomSheet`를 감싼 범용 래퍼, 아래 5번 참고)가 있습니다.

→ **상세 문서:** [`src/components/README.md`](./components/README.md)

---

## 5. bottomsheets/

```
src/bottomsheets/
├── ChatBottomSheet.tsx   # 홈 화면 채팅용 바텀시트 (스냅 인덱스: DOWN/HALF/UP)
└── chatSheetGeometry.ts  # 화면 높이 기준 스냅포인트(px) 계산 순수 함수
```

`components/AppBottomSheet.tsx`(범용 gorhom 래퍼)에 채팅 전용 스냅포인트 계산을 얹은 것이 `ChatBottomSheet`입니다. 이 앱에 바텀시트를 쓰는 곳이 지금은 홈 화면 채팅 하나뿐이라 폴더가 작지만, 다른 시트가 추가되면 같은 패턴으로(`AppBottomSheet` 재사용 + 이 폴더에 전용 geometry/handle 추가) 확장하면 됩니다.

`chatSheetGeometry.ts`의 `computeChatSheetHalfHeight`는 `HomeScreen`이 `AppMapView`의 카메라 `bottomPadding`을 계산할 때도 재사용합니다 — 시트 중간 스냅 높이와 지도가 가려지지 않는 영역이 항상 일치해야 하기 때문입니다.

```ts
import { ChatBottomSheet, ChatBottomSheetHandle } from '../bottomsheets/ChatBottomSheet';

const sheetRef = useRef<ChatBottomSheetHandle>(null);
// ...
<ChatBottomSheet ref={sheetRef} previewHeight={...} bottomReservedHeight={...}>
  <ChatConversation ... />
</ChatBottomSheet>;
// 필요할 때
sheetRef.current?.snapToHalf();
```

---

## 6. api/

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

### 6-1. `client.ts` 인터셉터 동작

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

`clearAuthAndNotify()`는 SecureStore의 userId·토큰·닉네임·이메일을 모두 지우고 `DeviceEventEmitter.emit('auth:forceLogout')`을 발생시킵니다. `useKakaoAuth`가 이 이벤트를 수신해 `authState: 'loggedOut'`으로 전환하면 `AppBootstrap`의 `computeTargetScreen()`이 Login 화면으로 되돌립니다.

> **refresh token 요청은 쿼리 파라미터가 아닌 Authorization 헤더로 전달합니다.**
> 쿼리 파라미터로 보내면 서버가 인식하지 못합니다.

---

### 6-2. [DEV] 전용 테스트 버튼

마이페이지(`src/screens/MyPageScreen.tsx`) 하단에 `__DEV__` 블록으로 감싼 두 개의 버튼이 있습니다. **프로덕션 빌드에는 포함되지 않습니다.**

#### [DEV] 토큰 강제 만료

```ts
// MyPageScreen.tsx
await authStorage.setAccessToken('invalid_token_for_test');
```

SecureStore의 `accessToken`을 유효하지 않은 값으로 덮어씁니다. 이후 아무 API 호출이 일어나면 서버가 401을 반환하고 `client.ts` 인터셉터의 refresh 흐름이 실제로 타는지 확인할 수 있습니다.

**재테스트 순서:**
1. 마이페이지 → `[DEV] 토큰 강제 만료` 버튼 클릭
2. 홈 탭 이동 → 챗봇 메시지 전송 (API 호출 트리거)
3. Metro 로그에서 401 → refresh 시도 → 재시도 성공/실패 확인

#### [DEV] 설문 화면 다시 보기

```ts
// AppBootstrap.tsx가 MainRouter로 전달한 콜백
resetSurvey: () => setSurveyStatus('pending')
```

서버 DB(`user_preferences.survey_completed`)를 건드리지 않고 `AppBootstrap`의 `surveyStatus`만 `'pending'`으로 강제 전환합니다. `computeTargetScreen()`이 곧바로 Survey 화면을 가리키게 되어 즉시 전환됩니다. 재로그인·DB 수정 없이 설문 UI를 반복 테스트할 수 있습니다.

콜백 전달 경로: `AppBootstrap` → `App.tsx`(`MainRouterContainer`) → `MainRouter` (prop) → `MyPageScreen` (prop) → 버튼 `onPress`

**재테스트 순서:**
1. 마이페이지 → `[DEV] 설문 화면 다시 보기` 버튼 클릭
2. SurveyScreen이 즉시 뜨는지 확인
3. 태그 선택 후 "완료" → Metro 로그에서 POST 응답의 weights 값 확인

---

## 7. auth/

```
src/auth/
├── AppBootstrap.tsx     # 앱 전체 부트스트랩 상태(Context) + 다음 화면 계산 + navigation.reset() 호출
├── permissions.ts       # 위치·걸음 수 권한을 OS에 직접 조회/요청하는 함수 모음
├── authStorage.ts       # SecureStore 기반 토큰·사용자 정보 저장소
├── onboardingStorage.ts # SecureStore 기반 1회성 플래그 저장소 (온보딩 열람 여부 · 걸음 수 권한 안내 완료 여부)
└── useKakaoAuth.ts      # 카카오 로그인/로그아웃 + authState 관리 훅
```

**`AppBootstrap.tsx`** 는 예전에 `App.tsx`가 직접 들고 있던 상태 분기 로직(스플래시 타이머·온보딩·로그인·설문·위치/활동 권한)을 전부 Context Provider로 옮긴 것입니다. `useAppBootstrap()` 훅으로 각 화면 컨테이너에 필요한 값·콜백만 꺼내 씁니다. 자세한 흐름은 위 "2. 앱 전체 화면 흐름" 참고.

**`permissions.ts`** 는 위치(`expo-location`)·걸음 수(`expo-sensors` `Pedometer`) 권한을 OS에 물어보는 로직을 한 곳에 모은 모듈입니다. `readPermissionSnapshot()`(3-state + boolean 스냅샷), `requestLocationPermission()` / `requestPedometerPermission()`(이미 허용됐으면 다이얼로그 없이 즉시 반환)을 노출합니다. 위치는 필수(`EXPO_PUBLIC_DEBUG_FIXED_LOCATION` 설정 시 granted 취급), 걸음 수는 선택(센서 없는 기기는 denied 취급, 거부돼도 거리 기반 추정치로 대체). `AppBootstrap`이 로그인 직후·포그라운드 복귀·산책 진입 직전에 이걸 호출해 캐시가 아닌 실제 권한을 확인합니다.

**`authStorage`** 는 다섯 가지 키(`kakao_user_id`, `app_access_token`, `app_refresh_token`, `user_nickname`, `user_email`)를 `expo-secure-store`에 저장합니다. 앱을 삭제하기 전까지는 기기에 남아 있어 재실행 시 자동 로그인이 가능합니다.

**`useKakaoAuth`** 는 마운트 시 `getUserId()` 로 저장된 userId 유무를 확인해 `authState`를 `'loggedIn'` 또는 `'loggedOut'`으로 초기화합니다. `DeviceEventEmitter`의 `'auth:forceLogout'` 이벤트를 구독해, `client.ts` 인터셉터가 refresh 실패를 감지했을 때 자동으로 로그아웃 상태로 전환됩니다.

```ts
// AppBootstrap.tsx에서 사용
const { authState, userId, error, signIn, signOut } = useKakaoAuth();
```

---

## 8. config/

```
src/config/
├── env.ts              # process.env에서 환경 변수를 읽어 단일 객체로 내보냄
├── mapConfig.ts        # Mapbox 지도 스타일 URL 상수
└── surveyQuestions.ts  # 설문 화면 태그 목록 + 카테고리 구조
```

**`env.ts`** — `EXPO_PUBLIC_` prefix 환경 변수를 중앙 관리합니다. 환경 변수를 직접 `process.env`로 읽지 말고 이 파일을 import해서 쓰세요.

```ts
import { env } from '../config/env';
// env.API_BASE_URL / env.MAPBOX_PUBLIC_ACCESS_TOKEN / env.DEBUG_FIXED_LOCATION 등
```

**`surveyQuestions.ts`** — 설문에 표시할 태그를 카테고리별로 분류합니다. 태그 문자열은 직접 하드코딩하지 않고 `src/data/onboarding.ts`의 `PREFERENCE_TAGS`에서 타입(`PreferenceTag`)을 파생해 사용합니다. `tagValue`에 오타가 있으면 `tsc`가 즉시 에러를 냅니다.

```ts
// 태그 추가/수정은 이 파일만 건드리면 됩니다
import { surveyQuestions } from '../config/surveyQuestions';
const allTags = surveyQuestions.flatMap(q => q.options);
```

---

## 9. data/

```
src/data/
└── onboarding.ts    # PREFERENCE_TAGS — 취향 태그 문자열 배열 (as const)
```

**`PREFERENCE_TAGS`** 는 백엔드 `TAG_WEIGHT_MAP`의 키와 1:1 대응하는 문자열 목록입니다. `as const`로 선언되어 있어 `typeof PREFERENCE_TAGS[number]`로 리터럴 유니온 타입을 파생할 수 있습니다. 이 배열이 태그 문자열의 **Single Source of Truth**입니다.

- `src/config/surveyQuestions.ts`가 이 타입을 import해 설문 config의 타입 안전성을 보장합니다.
- `src/components/my/MyPreferenceSection.tsx`가 이 배열을 직접 import해 전부 렌더링합니다.

태그를 추가하거나 이름을 바꾸려면 백엔드 `TAG_WEIGHT_MAP`과 이 파일을 함께 수정해야 합니다.

---

## 10. hooks/

```
src/hooks/
├── useAppStateChange.ts # 앱이 포그라운드/백그라운드로 전환되는 시점 감지 (공용)
├── useLocation.ts       # 1회성 현재 위치 조회 (메인 화면용)
└── useWatchLocation.ts  # 실시간 위치 추적 (산책 진행 중 6b용)
```

`useLocation`/`useWatchLocation`은 `src/types/location.ts`의 `Coordinates` 타입(`{ latitude, longitude }`)을 반환합니다.

**`useAppStateChange`** 는 `{ onForeground?, onBackground? }` 콜백을 받아 `AppState` 전환을 감지하는 공용 훅입니다. 콜백을 ref로 감싸서 넘겨받으므로 호출하는 쪽에서 `useCallback`으로 감쌀 필요가 없습니다. 지금은 `AppBootstrap.tsx`(설정 앱에서 돌아왔을 때 위치 권한 재확인)에서 씁니다.

**`useLocation`** 은 컴포넌트 마운트 시 한 번만 위치를 읽습니다. `.env`의 `EXPO_PUBLIC_DEBUG_FIXED_LOCATION`이 설정되어 있으면 실제 GPS 대신 고정 좌표를 반환합니다 (서울 외부에서 개발할 때 유용).

```ts
// 서울 서비스 구역 밖 개발 시 .env에 추가
EXPO_PUBLIC_DEBUG_FIXED_LOCATION=37.5665,126.9780
```

**`useWatchLocation`** 은 `Location.watchPositionAsync`로 5m 이상 이동할 때마다 좌표를 갱신합니다. 위치 권한이 이미 허용된 상태에서만 사용합니다.

---

## 11. navigation/

```
src/navigation/
├── navigationRef.ts # react-navigation의 NavigationContainer ref (화면 밖에서 imperative 전환용)
└── types.ts          # Route · TabName 타입 정의 (MainRouter 내부 탭 전환 전용)
```

이 폴더엔 서로 다른 두 계층의 네비게이션 관련 코드가 같이 있습니다 — 헷갈리지 않도록 구분:

- **`navigationRef.ts`**: 앱 전체 화면(스플래시/온보딩/로그인/…/홈) 전환용. `createNavigationContainerRef<RootStackParamList>()`로 만든 ref이고, `App.tsx`의 `NavigationContainer`에 물려 `AppBootstrap.tsx`가 화면 컴포넌트 밖(Provider)에서 `navigationRef.reset(...)`을 호출할 수 있게 해줍니다. `RootStackParamList` 타입 자체는 `src/types/navigation.ts`에 있습니다.
- **`types.ts`**: `MainRouter.tsx` **내부** 탭(home/record/me)과 산책 플로우(realWalk) 전환 전용 타입입니다. `MainRouter`가 React Navigation을 쓰지 않고 이 타입 + 로컬 `useState`로 직접 화면을 분기하는 건 의도된 설계입니다(이유는 `src/screens/README.md` 참고).

```ts
// navigation/types.ts — MainRouter 내부용
type Route =
  | { name: 'home' }
  | { name: 'realWalk' }
  | { name: 'record' }
  | { name: 'me' };

type TabName = 'home' | 'record' | 'me';
```

---

## 12. theme/

```
src/theme/
└── tokens.ts    # colors · spacing · radii · shadows
```

| 토큰 | 내용 |
|---|---|
| `colors` | 흑백 UI(`ink`/`inkMuted`/`inkFaint`/`card`/`surfaceAlt`/`line`/`lineStrong`) · 피드백(`danger`/`dangerBg`/`dangerBorder`) · 채팅 민트 계열(`accent`/`mintDeep`/`containerBackground`/`line2`) |
| `spacing` | `xs(4)` `sm(8)` `md(12)` `lg(16)` `xl(20)` `xxl(28)` |
| `radii` | `sm(8)` `md(12)` `lg(16)` `xl(24)` |
| `shadows` | `soft` (카드용) · `map` (지도 위 플로팅 UI용) |

스타일시트에서 직접 숫자를 쓰지 말고 이 토큰을 import해서 씁니다.

```ts
import { colors, spacing, radii } from '../theme/tokens';
```

---

## 13. types/

백엔드 스키마를 그대로 반영하는 타입과 앱 내부 공유 타입을 담습니다.

```
src/types/
├── location.ts   # Coordinates (기기 GPS 좌표 — useLocation/useWatchLocation 공용)
├── navigation.ts # RootStackParamList · RootScreenName (App.tsx의 react-navigation 화면 타입)
├── prewalk.ts    # 챗봇·경로 관련 스키마 (InitRequest, WalkRouteResponse, WalkMode 등 — route_result는 배열)
├── routes.ts     # 산책 기록 스키마 (RouteHistoryItem, RouteHistoryQuery 등)
└── walk.ts       # WalkEndSnapshot (산책 종료 시 6b→6c로 넘기는 스냅샷)
```

> `src/api/` 폴더의 요청·응답 타입은 각 API 파일(`survey.ts` 등) 안에 인라인으로 정의합니다.
> 백엔드 스키마와 공유하거나 여러 파일에서 쓰이는 타입만 이 폴더에 둡니다.

---

## 14. utils/

순수 함수 모음입니다. React에 의존하지 않고 단독으로 테스트 가능합니다.

```
src/utils/
├── geo.ts              # 좌표 변환·bounding box 계산 + 경로 위 투영/거리 계산 (haversineDistanceKm,
│                        # projectOntoRoute, sliceRouteAtDistanceKm — walkProgress.ts와 지도 레이어가 공유)
├── reverseGeocode.ts   # 좌표 → 장소명 역지오코딩 (Mapbox Geocoding API, 메모리 캐시)
├── routeHistory.ts     # RouteHistoryItem → WalkRouteResponse 변환 (기록 → 재산책)
├── routeThumbnail.ts   # 경로 좌표 → Mapbox Static Images URL 생성 (기록 탭 경로 썸네일용)
├── walkEstimate.ts     # km → 소요시간·칼로리·걸음수 추정 (평균 보행 속도 기준)
├── walkMode.ts         # WalkMode enum → 한글 라벨 (순환 코스, 편도 코스)
└── walkProgress.ts     # WalkProgressTracker — 실시간 GPS + 경로 좌표로 진행률(traveledKm)을 계산
```

**`walkProgress.ts`의 `WalkProgressTracker`** 는 산책 한 번(화면 마운트~종료) 동안 상태(누적 거리·직전 GPS 지점/시각)를 들고 있는 클래스입니다. GPS 업데이트마다 세 가지를 확인합니다: ① 직전 지점 대비 도보로 불가능한 속도(15km/h 초과)면 무시, ② 경로에서 50m 넘게 벗어나 있으면 그 측정치는 진행률에 반영하지 않고 보류(엉뚱한 구간에 잘못 매칭될 수 있어서), ③ 진행률은 지금까지의 최댓값 아래로 내려가지 않음(역행 방지). 순환 코스 자기교차 대응을 위해 직전 매칭 지점 근처(±150m)를 우선 탐색하는 윈도우 매칭도 `geo.ts`의 `projectOntoRoute`에 함께 구현되어 있습니다.

---

## 15. 주의할 점

**건드리기 전에 확인이 필요한 영역**

- **`src/api/client.ts`** — 인터셉터 로직을 수정하면 모든 API 호출의 인증 흐름이 바뀝니다. refresh token 요청 방식(현재 Authorization 헤더)은 쿼리 파라미터로 되돌리지 마세요 (서버가 인식 불가).
- **`src/auth/AppBootstrap.tsx`의 `computeTargetScreen()`** — 화면 우선순위 판단 함수입니다. 조건 순서를 바꾸면 화면 흐름 자체가 바뀝니다(예: `showBrandSplash`는 항상 최우선이어야 함).
- **`src/data/onboarding.ts`** — `PREFERENCE_TAGS` 문자열은 백엔드 `TAG_WEIGHT_MAP` 키와 정확히 일치해야 합니다. 이름을 바꾸거나 추가하려면 백엔드와 반드시 동기화하세요.
- **`src/config/surveyQuestions.ts`** — `tagValue`는 `PreferenceTag` 타입으로 강제되므로 `PREFERENCE_TAGS`에 없는 문자열을 넣으면 `tsc`에서 에러가 납니다. 의도된 동작입니다.
- **`__DEV__` 버튼 (`MyPageScreen.tsx`)** — 프로덕션 빌드에는 포함되지 않습니다. 버튼을 추가할 때는 반드시 `{__DEV__ && ( ... )}` 블록 안에 넣으세요.
