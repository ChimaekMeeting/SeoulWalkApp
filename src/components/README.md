# src/components

여러 화면에서 재사용하는 컴포넌트를 모아두는 폴더입니다. 기능별로 하위 폴더(`chat/`, `map/`, `my/`, `record/`, `walk/`)에 나눠 담고, 특정 기능에 묶이지 않는 것만 최상위에 둡니다.

```
src/components/
├─ ScreenHeader.tsx    # 뒤로가기 화살표 + 제목/부제 + 우측 버튼 헤더 (여러 화면 공통)
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
│  ├─ RouteLayer.tsx        # 경로 라인 레이어 (내부용)
│  ├─ DynamicPOILayer.tsx   # 미사용 — 어디서도 import 안 됨
│  ├─ StaticPOILayer.tsx    # 미사용 — 어디서도 import 안 됨
│  └─ index.ts
├─ my/                   # '내 정보' 탭(MyScreen)에서만 쓰는 컴포넌트
│  ├─ MyPreferenceComponent.tsx # 산책 취향 태그 선택 섹션
│  ├─ MyPreferenceItem.tsx      # 취향 태그 버튼 1개
│  └─ SettingComponent.tsx      # 설정 메뉴 한 줄(라벨 + '>' 화살표)
├─ record/               # '기록' 탭(RecordTab)에서만 쓰는 컴포넌트
│  ├─ RouteHistoryList.tsx   # 저장된 경로 목록 조회/표시 (실API 연동)
│  └─ HistoryPlaceLabel.tsx  # 경로 카드에 좌표를 역지오코딩한 장소명을 보여주는 라벨
└─ walk/                 # 산책 완료(6d) 화면에서만 쓰는 컴포넌트
   └─ ShareCard.tsx          # 화면엔 안 보이고 공유 이미지 캡처용으로만 쓰는 카드
```

---

## 1. `ScreenHeader.tsx`

`title`/`subtitle`/`onBack`/`right` props만 받는 순수 헤더. `onBack`이 있을 때만 뒤로가기 화살표가 뜹니다. 지금은 `MyScreen.tsx`, `record/RecordTab.tsx`에서 쓰고 있고, 새 화면을 추가할 때도 이 컴포넌트로 헤더를 통일하면 됩니다.

## 2. `chat/` — 챗봇 대화 UI

`HomeScreen.tsx`의 홈 탭 하단시트 안에 임베드되는 형태입니다(독립된 화면이 아님). `ChatConversation`이 `forwardRef`로 `ChatConversationHandle`을 노출해서, 부모(`HomeScreen`)가 메시지 전송 등을 직접 트리거할 수 있습니다.

```
ChatConversation (컨테이너, src/api/prewalk.ts로 백엔드와 통신)
 ├─ MyBubble        # 사용자가 보낸 메시지
 ├─ ChatBubble       # 챗봇 텍스트 응답
 ├─ LoadingBubble    # 챗봇 응답 대기 중
 └─ RouteCandidate   # 챗봇이 경로를 찾아주면 이 카드가 뜸
        │ onPress
        ▼
   onRouteReady(route) 콜백으로 상위(HomeScreen)에 전달
        │
        ▼
   HomeScreen이 activeRoute로 저장하고 realWalk(WalkFlow, 6a)로 전환
```

- `ChatInput.tsx`는 `ChatConversation`과 별개로 `HomeScreen`이 직접 배치합니다(하단시트 고정 위치에 항상 떠 있어야 해서).
- 경로 카드(`RouteCandidate`)를 누르면 `onRequestClose`가 아니라 `onRouteReady`만 호출됩니다 — 예전에 두 콜백을 같이 불러서 6a로 넘어간 화면이 곧바로 홈으로 되돌아가던 버그가 있었으니, 이 부분 건드릴 땐 주의하세요.

## 3. `map/` — 지도 컴포넌트

메인 화면(경로안내 없음)과 산책중 화면(경로안내 있음) 둘 다 `AppMapView` 하나로 처리합니다 — `mode`만 바꿔서 씁니다. 좌표 타입은 새로 만들지 않고 `src/types/prewalk.ts`의 backend 스키마(`LocationInfo`, `WalkRouteResponse`)를 그대로 씁니다.

**기본 사용 — 메인화면(경로안내 없음)**: 베이스맵 + 현재 위치(파란 점)만 보여줍니다. 코스를 선택했을 때만 `previewRoute`로 점선 미리보기 경로를 얹을 수 있습니다.

```tsx
import { AppMapView } from '../components/map';

<AppMapView
  mode="overview"
  currentLocation={locationInfo} // 없으면 서울시청 기본 좌표로 표시됨
  previewRoute={selectedCourse?.route_result?.coordinates} // 코스 선택 전에는 생략 가능
/>;
```

**산책중 화면(경로안내)**: 전체 경로 라인 + 실시간 GPS 위치를 따라가는 카메라(줌인·기울임)를 보여줍니다.

```tsx
import { AppMapView } from '../components/map';

<AppMapView
  mode="walk"
  currentLocation={locationInfo}
  route={state.route_result.coordinates} // 필수
  routeColor={course.color} // 선택, 기본값 파란색
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
| 경로 라인 | `previewRoute` 있을 때만, 점선 | `route` 항상, 실선 |
| 커스텀 POI 마커 | 없음 (지도 스타일 자체에 건물/상호 정보 포함) | 없음 |

`DynamicPOILayer.tsx`/`StaticPOILayer.tsx`는 현재 앱 어디에서도 import되지 않는 미사용 컴포넌트입니다.

## 4. `my/` — 내 정보 탭 전용

`MyScreen.tsx` 하나에서만 쓰는, 재사용 범위가 좁은 컴포넌트들입니다. `MyPreferenceComponent`가 `src/data/onboarding.ts`의 `PREFERENCE_TAGS`를 받아 `MyPreferenceItem`(태그 버튼)을 나열하고, `SettingComponent`는 설정 메뉴의 각 행(예: "알림 설정", "로그아웃")을 그리는 데 씁니다.

## 5. `record/` — 기록 탭 전용

`src/screens/record/RecordTab.tsx`가 303줄까지 커져서 분리한 것들입니다.

- **`RouteHistoryList`**: `filter`("recent" | "favorite")를 props로 받아 `GET /api/user/routes`를 직접 호출하고, 카드 목록(지도 썸네일 + 모드 라벨 + 거리/시간 + 즐겨찾기 별)을 렌더링합니다. 카드를 누르면 `routeHistoryToWalkRoute`(`src/utils/routeHistory.ts`)로 변환한 뒤 `onSelectRoute` 콜백을 호출해 6a(산책 전)로 다시 들어갈 수 있게 합니다.
- **`HistoryPlaceLabel`**: 카드 안에서 좌표(`origin_lat`/`origin_lon` 등)를 역지오코딩(`src/utils/reverseGeocode.ts`)해서 실제 장소명을 보여줍니다. 이름만으로 구분 안 되는 같은 모드(예: "순환 코스"끼리)를 구분하기 위한 용도입니다.

## 6. `walk/` — 산책 완료(6d) 화면 전용

`ShareCard`는 `WalkCompleteScreen.tsx`의 실제 화면 UI와 별개로, **화면엔 안 보이고 공유 이미지 캡처용으로만 쓰는 카드**입니다. `forwardRef`로 `ViewShotRef`를 그대로 노출해서, 부모가 `ref.current.capture()`를 호출해 PNG URI를 얻습니다.

```tsx
const shareCardRef = useRef<ViewShotRef>(null);
// ...
<ShareCard ref={shareCardRef} traveledKm={traveledKm} minutes={minutes} steps={steps} thumbnailUrl={thumbnailUrl} />
// ...
const uri = await shareCardRef.current?.capture?.();
```

실시간 지도 대신 라벨 없는 정적 지도 썸네일(`src/utils/routeThumbnail.ts`)을 써서, 캡처할 때마다 결과가 달라지지 않고 항상 일정합니다.
