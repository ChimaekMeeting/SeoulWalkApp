# src/components/map

메인화면(경로안내 없음)과 산책중 화면(경로안내 있음)에서 공통으로 쓰는 지도 컴포넌트 모음입니다.
화면 두 곳 모두 `AppMapView` 하나만 `mode`를 바꿔서 사용하면 됩니다.

```
src/components/map/
├─ AppMapView.tsx   # mode="overview" | "walk" 로 분기하는 공용 지도 컴포넌트 (이걸 import해서 쓰면 됨)
├─ RouteLayer.tsx    # 경로 라인 레이어 (AppMapView 내부에서 사용, 직접 쓸 일은 거의 없음)
└─ index.ts          # export { AppMapView } from './AppMapView'
```

> 좌표 타입은 새로 만들지 않고 `src/types/prewalk.ts`의 backend 스키마(`LocationInfo`, `WalkRouteResponse`)를 그대로 씁니다.

---

### 1. 메인화면 (경로안내 없음)

베이스맵 + 현재 위치(파란 점)만 기본으로 보여줍니다. 카카오맵/네이버맵 첫 화면과 같은 느낌입니다.
코스를 선택했을 때만 `previewRoute`로 점선 미리보기 경로를 얹을 수 있습니다.

```tsx
import { AppMapView } from '../components/map';

<AppMapView
  mode="overview"
  currentLocation={locationInfo} // 없으면 서울시청 기본 좌표로 표시됨
  previewRoute={selectedCourse?.route_result?.coordinates} // 코스 선택 전에는 생략 가능
/>;
```

### 2. 산책중 화면 (경로안내)

전체 경로 라인 + 실시간 GPS 위치를 따라가는 카메라(줌인·기울임)를 보여줍니다.

```tsx
import { AppMapView } from '../components/map';

<AppMapView
  mode="walk"
  currentLocation={locationInfo}
  route={state.route_result.coordinates} // 필수
  routeColor={course.color} // 선택, 기본값 파란색
/>;
```

---

### 3. `currentLocation` 채우는 법

`AppMapView`는 backend `LocationInfo` 타입(`lat`/`lon`/`address`/`place_name`)을 그대로 받습니다.
기기 GPS(`useLocation` 훅, `{latitude, longitude}`)에서 값을 가져온 경우 아래처럼 한 줄로 감싸서 넘기세요.

```tsx
const { coords } = useLocation();
const locationInfo: LocationInfo | null = coords
  ? { lat: coords.latitude, lon: coords.longitude, address: null, place_name: null }
  : null;
```

### 4. 좌표 순서 주의

- `WalkRouteResponse.coordinates`는 `[위도, 경도]`(`[lat, lon]`) 순서의 튜플 배열입니다.
- Mapbox 네이티브는 `[경도, 위도]`(`[lng, lat]`) 순서를 요구합니다.
- 이 순서 변환은 `AppMapView` 내부(`src/utils/geo.ts`)에서만 처리하므로, `AppMapView`를 쓰는 쪽에서는 항상 backend가 내려주는 `[lat, lon]` 순서 그대로 넘기면 됩니다. 직접 `[lng, lat]`로 뒤집지 마세요.

### 5. 두 모드가 실제로 다른 점

| | overview (메인화면) | walk (산책중) |
|---|---|---|
| 지도 스타일 | streets (밝은 기본 지도) | dark (야간용) |
| 카메라 | 최초 1회만 현재 위치로 이동, 이후 자유 팬/줌 | `followUserLocation`으로 계속 사용자 위치를 따라가며 근접·기울임 |
| 경로 라인 | `previewRoute` 있을 때만, 점선 | `route` 항상, 실선 |
| 커스텀 POI 마커 | 없음 (지도 스타일 자체에 건물/상호 정보 포함) | 없음 |
