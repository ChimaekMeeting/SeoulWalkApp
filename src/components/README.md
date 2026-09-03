# src/components

여러 화면에서 재사용하는 컴포넌트를 모아두는 폴더입니다. 기능별로 하위 폴더(`chat/`, `map/`, `my/`, `record/`)에 나눠 담고, 특정 기능에 묶이지 않는 것만 최상위에 둡니다.

```
src/components/
├─ ScreenHeader.tsx    # 뒤로가기 화살표 + 제목/부제 + 우측 버튼 헤더 (여러 화면 공통, plain·align 옵션)
├─ Button.tsx          # 하단 액션 버튼 (variant: primary=검정 채움 / secondary=아웃라인), loading/disabled 지원
├─ ErrorBanner.tsx     # 붉은 인라인 에러 박스 (로그인·설문 등), message 없으면 렌더 안 함
├─ PermissionPrompt.tsx # 권한 요청 화면 공통 레이아웃 (아이콘/제목/본문/뱃지 + 버튼 2개)
├─ StatRow.tsx         # 거리·시간·칼로리 같은 수치를 가로로 나열 (variant: summary / detail)
├─ TabScreen.tsx       # 하단 탭(기록·마이페이지) 공통 셸: 헤더 + 스크롤 목록
├─ AppBottomSheet.tsx  # gorhom BottomSheet를 감싼 범용 래퍼 (src/bottomsheets/의 화면별 시트가 이걸 씀)
├─ BottomNav.tsx       # 하단 탭 바(홈/기록/마이페이지) — MainRouter가 렌더링
├─ DevChip.tsx         # 개발 빌드 전용 주황 칩 버튼 (화면 상태 강제용) — __DEV__ 게이팅은 쓰는 쪽에서
├─ chat/                # 홈 화면 하단시트에 들어가는 AI 챗봇 대화 UI
│  ├─ ChatConversation.tsx  # 대화 흐름 전체를 관리하는 컨테이너 (이걸 import해서 쓰면 됨)
│  ├─ ChatInput.tsx         # 하단 입력창
│  ├─ ChatBubble.tsx        # 챗봇 말풍선
│  ├─ MyBubble.tsx          # 사용자 말풍선
│  ├─ LoadingBubble.tsx     # 챗봇 응답 대기 중 말풍선
│  └─ RouteCandidate.tsx    # 챗봇이 찾아준 경로를 보여주는 카드
├─ map/                  # 지도 컴포넌트
│  ├─ AppMapView.tsx        # mode="overview" | "walk" 공용 지도 (기본)
│  ├─ RouteMapView.tsx      # AppMapView + 줌 버튼 + "경로 전체 보기"
│  ├─ RouteLayer.tsx        # 경로 라인 레이어 (내부용, id prop으로 같은 지도에 중복 렌더 가능)
│  ├─ RouteDirectionArrows.tsx # 경로 선 위에 방향 화살표(▶)를 일정 간격으로 표시 (내부용)
│  ├─ RouteEndpointMarkers.tsx # 출발·도착 마커 — 순환 코스면 하나로 합쳐서 표시 (내부용)
│  └─ index.ts
├─ my/                   # '마이페이지' 탭(MyPageScreen)에서만 쓰는 컴포넌트
│  ├─ ProfileCard.tsx          # 상단 프로필 요약 카드 (아바타 + 닉네임 + 이메일)
│  ├─ MyPreferenceSection.tsx  # 산책 취향 태그 선택 섹션 (토글 시 즉시 저장)
│  ├─ MyPreferenceItem.tsx     # 취향 태그 버튼 1개
│  ├─ SettingRow.tsx           # 설정 메뉴 한 줄 (라벨 + '>' 화살표, danger·showChevron 옵션)
│  └─ DevMenu.tsx              # 개발 빌드 전용 디버그 버튼 (프로덕션에선 null)
└─ record/               # '기록' 탭(RecordTab)에서만 쓰는 컴포넌트
   ├─ RouteHistoryList.tsx   # 저장된 경로 목록 조회/표시 (실API 연동)
   └─ HistoryPlaceLabel.tsx  # 경로 카드에 좌표를 역지오코딩한 장소명을 보여주는 라벨
```

---

## 1. `ScreenHeader.tsx`

`title`/`onBack` props를 받는 순수 헤더. `onBack`이 있을 때만 뒤로가기 화살표가 뜹니다. `plain`이면 배경/하단 보더가 없는 투명 헤더(전체화면 플로우용, `WalkPrepScreen`), `align="center"`면 제목을 가운데 정렬합니다. `MyPageScreen`·`RecordTab`은 `TabScreen`을 통해 간접적으로 씁니다.

## 1-2. `Button.tsx` / `ErrorBanner.tsx` / `PermissionPrompt.tsx` / `StatRow.tsx` / `TabScreen.tsx`

화면마다 복붙되던 하단 버튼·에러 박스·권한 화면 뼈대·수치 행·탭 셸을 한 곳으로 모은 것들입니다.

- **`Button`**: 높이 52 · `radii.lg` 고정. `variant="primary"`(검정 채움, 기본) / `"secondary"`(흰 배경 + `colors.lineStrong` 아웃라인). `loading`이면 스피너를 보여주고 눌리지 않으며, `disabled`면 흐려집니다(opacity 0.4). 바깥 여백이나 `flex: 1`은 `style` prop으로, 글자 크기 조정은 `textStyle`로 넘깁니다. 카카오 로그인 버튼처럼 색/레이아웃이 완전히 다른 건 각 화면이 직접 그립니다.
- **`ErrorBanner`**: `message`가 falsy면 `null`을 반환하므로 `{cond ? ... : null}` 없이 `<ErrorBanner message={errorMsg} />`만 두면 됩니다.
- **`PermissionPrompt`**: `LocationPermissionScreen`·`ActivityPermissionScreen`이 공유하는 레이아웃(중앙 아이콘/제목/본문/뱃지 + 하단 버튼). `secondaryLabel`/`onSecondary`는 선택 — 위치 권한처럼 필수라 "건너뛰기"가 없으면 primary 버튼만 렌더됩니다. 권한 상태 확인·요청 로직은 각 화면(또는 `src/auth/permissions.ts`)에 있고 여기서는 UI만 그립니다. `body`는 여러 줄이면 `'\n'` 포함 문자열로 넘깁니다.
- **`StatRow`**: `items`(값/단위/라벨 배열)를 가로로 나열. `variant="summary"`는 큰 값 + 아래 단위(완료 화면), `"detail"`은 값+단위 한 줄 + 아래 라벨(준비 화면).
- **`TabScreen`**: `title` + `children`만 받아 `ScreenHeader` + 하단 탭바 여백이 잡힌 `ScrollView`를 그립니다. `RecordTab`·`MyPageScreen`이 사용.

## 1-1. `AppBottomSheet.tsx`

`@gorhom/bottom-sheet`의 `BottomSheet`(비-모달, 항상 화면에 떠 있는 시트)를 감싼 범용 래퍼입니다. `snapToIndex`만 노출하는 얇은 컴포넌트라 화면별 스냅포인트 계산 같은 로직은 담지 않습니다 — 그건 `src/bottomsheets/`(예: `ChatBottomSheet.tsx`)에 화면별로 따로 둡니다. 완전히 닫히는(dismiss) 모달형 시트가 필요해지면 `BottomSheetModal` 기반의 별도 컴포넌트를 추가하세요(지금은 쓰는 곳이 없어 만들지 않았습니다).

## 2. `chat/` — 챗봇 대화 UI

홈 탭(`HomeScreen.tsx`)의 하단시트 안에 임베드되는 형태입니다(독립된 화면이 아님). `ChatConversation`이 `forwardRef`로 `ChatConversationHandle`을 노출해서, 부모(`HomeScreen`)가 메시지 전송 등을 직접 트리거할 수 있습니다.

```
ChatConversation (컨테이너, src/api/prewalk.ts로 백엔드와 통신)
 ├─ MyBubble        # 사용자가 보낸 메시지
 ├─ ChatBubble       # 챗봇 텍스트 응답
 ├─ LoadingBubble    # 챗봇 응답 대기 중
 └─ RouteCandidate   # state.route_result(배열)의 후보 1개를 카드로 보여줌 — 후보 개수만큼 렌더링됨
        │ onPress (카드 자체가 버튼 — 누르면 바로 그 후보가 선택됨)
        ▼
   onRouteReady(route) 콜백으로 상위(HomeScreen→MainRouter)에 전달
        │
        ▼
   MainRouter가 activeRoute로 저장하고 realWalk(WalkFlow, 6a)로 전환
```

- `ChatInput.tsx`는 `ChatConversation`과 별개로 `HomeScreen`이 직접 배치합니다(하단시트 고정 위치에 항상 떠 있어야 해서).
- `state.route_result`는 배열(`WalkRouteResponse[] | null`)입니다. 후보가 여러 개면 `ChatConversation`이 `✳` 아이콘 하나에 `RouteCandidate` 카드 여러 개(순번대로 "코스 1", "코스 2" …)를 세로로 나열합니다. 빈 배열 케이스는 없다고 가정하며(백엔드가 못 찾으면 `null`), `null`일 때만 카드 영역을 아예 렌더링하지 않습니다.
- 경로 카드(`RouteCandidate`)를 누르면 `onRequestClose`가 아니라 `onRouteReady`만 호출됩니다 — 예전에 두 콜백을 같이 불러서 6a로 넘어간 화면이 곧바로 홈으로 되돌아가던 버그가 있었으니, 이 부분 건드릴 땐 주의하세요. 카드에는 별도의 "산책하기"/"다시 묻기" 버튼이 없고, 카드를 누르는 것 자체가 곧 그 후보를 선택하는 동작입니다.

## 3. `map/` — 지도 컴포넌트

메인 화면(경로안내 없음)과 산책중 화면(경로안내 있음) 둘 다 `AppMapView` 하나로 처리합니다 — `mode`만 바꿔서 씁니다. 좌표 타입은 새로 만들지 않고 `src/types/prewalk.ts`의 backend 스키마(`LocationInfo`, `WalkRouteResponse`)를 그대로 씁니다.

**기본 사용 — 메인화면(경로안내 없음)**: 베이스맵 + 현재 위치(파란 점)만 보여줍니다. 코스를 선택했을 때만 `previewRoute`로 점선 미리보기 경로를 얹을 수 있습니다(점선이 눈에 잘 안 띄면 `previewRouteSolid`로 실선으로). 출발·도착 마커(`RouteEndpointMarkers`)는 이 모드엔 안 그립니다 — `WalkPrepScreen`(산책 준비)·`WalkCompleteScreen`(완료 화면)의 작은 미리보기 지도에는 배지가 오히려 복잡해 보여서, walk 모드(실제 산책 중)에서만 표시합니다. `showDirectionArrows`(기본 꺼짐)를 켜면 방향 화살표(`RouteDirectionArrows`, `size="large"`로 밝은 지도에서도 잘 보이게)만 얹을 수 있습니다 — `WalkPrepScreen`이 순환·편도 모두 켜서 진행 방향을 보여줍니다.

```tsx
import { AppMapView } from '../components/map';

<AppMapView
  mode="overview"
  currentLocation={locationInfo} // 없으면 서울시청 기본 좌표로 표시됨
  previewRoute={selectedCourse?.route_result?.coordinates} // 코스 선택 전에는 생략 가능
  previewRouteSolid // 선택 — 점선 대신 실선으로
  showDirectionArrows // 선택 — 진행 방향을 보여줄 때만
/>;
```

**산책중 화면(경로안내)**: 전체 경로 라인 + 실시간 GPS 위치를 따라가는 카메라(줌인·기울임)를 보여줍니다. `routeProgressKm`(경로 시작점부터의 진행 거리)을 같이 넘기면 지나온 구간(원래 경로색)/남은 구간(옅은 회색)을 다른 색으로 나눠 그리고, 방향 화살표(`RouteDirectionArrows`)와 출발·도착 마커(`RouteEndpointMarkers`)도 자동으로 함께 표시됩니다 — 순환 코스에서 시작·끝·진행 방향이 헷갈리지 않도록 하기 위함입니다(순환 코스는 시작점≈끝점이라 마커 두 개 대신 "출발·도착" 하나로 합쳐서 보여줍니다). 순환 코스 진행 방향은 `WalkPrepScreen`(산책 준비 화면)에서 시작 전에만 고르고 — `route`는 산책 중엔 안 바뀝니다.

```tsx
import { AppMapView } from '../components/map';

<AppMapView
  mode="walk"
  currentLocation={locationInfo}
  route={state.route_result.coordinates} // 필수
  routeColor={course.color} // 선택, 기본값 파란색
  routeProgressKm={progress.routeProgressKm} // 선택 — 생략하면 경로 전체를 단일 색으로만 그림(마커/화살표는 항상 표시됨)
/>;
```

**줌 버튼/경로 전체 보기가 필요하면(`RouteMapView`, 6a·6d에서 사용)**: `AppMapView`를 감싸서 줌 +/- 버튼과 `fitRouteOnMount`(경로 bounding box에 카메라 맞추기)를 추가한 컴포넌트입니다. props는 `AppMapView`와 동일 + `fitRouteOnMount`/`zoomControlBottomOffset`/`showZoomControls`.

```tsx
import { RouteMapView } from '../components/map';

<RouteMapView
  mode="overview"
  previewRoute={routeResult.coordinates}
  fitRouteOnMount
  showZoomControls={false} // 완료 화면처럼 작은 요약 썸네일이면 끄기
/>;
```

**`currentLocation` 채우는 법**: `AppMapView`/`RouteMapView`는 backend `LocationInfo` 타입(`lat`/`lon`/`address`/`place_name`)을 그대로 받습니다. 기기 GPS(`useLocation` 훅, `{latitude, longitude}`)에서 값을 가져온 경우 아래처럼 한 줄로 감싸서 넘기세요.

```tsx
const { coords } = useLocation();
const locationInfo: LocationInfo | null = coords
  ? { lat: coords.latitude, lon: coords.longitude, address: null, place_name: null }
  : null;
```

**좌표 순서 주의**: `WalkRouteResponse.coordinates`는 `[위도, 경도]`(`[lat, lon]`) 순서의 튜플 배열인데, Mapbox 네이티브는 `[경도, 위도]`(`[lng, lat]`) 순서를 요구합니다. 이 변환은 `AppMapView` 내부(`src/utils/geo.ts`)에서만 처리하므로, 쓰는 쪽에서는 항상 backend가 내려주는 `[lat, lon]` 순서 그대로 넘기면 됩니다 — 직접 `[lng, lat]`로 뒤집지 마세요.

**두 모드가 실제로 다른 점**

| | overview (메인화면) | walk (산책중) |
|---|---|---|
| 지도 스타일 | streets (밝은 기본 지도) | dark (야간용) |
| 카메라 | 최초 1회만 현재 위치로 이동, 이후 자유 팬/줌 | `followUserLocation`으로 계속 사용자 위치를 따라가며 근접·기울임 |
| 경로 라인 | `previewRoute` 있을 때만, 점선 | `route` 항상, 실선 (`routeProgressKm` 넘기면 지나온/남은 구간 이색) |
| 출발도착 마커 | 없음 | `route` 있으면 항상 표시 |
| 방향 화살표 | `showDirectionArrows` 켰을 때만 | `route` 있으면 항상 표시 |
| 커스텀 POI 마커 | 없음 (지도 스타일 자체에 건물/상호 정보 포함) | 없음 |

## 4. `my/` — 내 정보 탭 전용

`MyPageScreen.tsx` 하나에서만 쓰는, 재사용 범위가 좁은 컴포넌트들입니다.

- **`ProfileCard`**: 닉네임/이메일을 받아 아바타 + 이름 + 카카오 이메일 카드를 그립니다.
- **`MyPreferenceSection`**: `src/data/onboarding.ts`의 `PREFERENCE_TAGS`를 `MyPreferenceItem`(태그 버튼)으로 나열하고, 토글할 때마다 `postSurvey`로 즉시 저장합니다(실패 시 롤백).
- **`SettingRow`**: 설정 메뉴의 각 행. `danger`로 빨간 텍스트(로그아웃), `showChevron={false}`로 오른쪽 화살표를 끕니다.
- **`DevMenu`**: `__DEV__`일 때만 렌더되는 디버그 버튼 모음(토큰 강제 만료, 설문 다시 보기). 프로덕션에선 `null`.

## 5. `record/` — 기록 탭 전용

`src/screens/record/RecordTab.tsx`가 303줄까지 커져서 분리한 것들입니다.

- **`RouteHistoryList`**: `filter`("recent" | "favorite")를 props로 받아 `GET /api/user/routes`를 직접 호출하고, 카드 목록(지도 썸네일 + 모드 라벨 + 거리/시간 + 즐겨찾기 별)을 렌더링합니다. 카드를 누르면 `routeHistoryToWalkRoute`(`src/utils/routeHistory.ts`)로 변환한 뒤 `onSelectRoute` 콜백을 호출해 6a(산책 전)로 다시 들어갈 수 있게 합니다. 같은 경로로 여러 번 걸어 서버에 중복 저장된 기록은 `dedupeRouteHistories`(`src/utils/routeHistory.ts`)로 카드 하나로 합치고, "최근에 걸은 순"으로 정렬합니다. 저장된 경로를 골라 다시 산책하는 건 서버에 아무 기록도 남기지 않으므로(챗봇 플로우에서만 RouteHistory가 생성됨), `MainRouter`가 산책 종료 시 `markRouteWalked`(`src/utils/recentRouteUsage.ts`)로 route id별 마지막 산책 시각을 이 기기에 저장하고, 정렬은 서버 `created_at`과 이 로컬 시각 중 나중 값을 씁니다 — 그 경로로 다시 걸으면 목록 맨 위로 올라옵니다.
- **`HistoryPlaceLabel`**: 카드 안에서 좌표(`origin_lat`/`origin_lon` 등)를 역지오코딩(`src/utils/reverseGeocode.ts`)해서 실제 장소명을 보여줍니다. 이름만으로 구분 안 되는 같은 모드(예: "순환 코스"끼리)를 구분하기 위한 용도입니다.
