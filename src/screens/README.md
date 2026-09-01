# src/screens

스크린을 모아두는 폴더입니다. 앱 전체 화면(스플래시~홈까지)은 `App.tsx`의 `Stack.Navigator`(react-navigation)가 전환하고, `MainRouter.tsx` **내부**(하단 탭 + 산책 플로우)는 로컬 `useState`로 직접 분기합니다.

```
src/screens/
├─ BrandSplashScreen.tsx        # 앱 최초 실행 시 2초간 보여주는 로고 스플래시
├─ OnboardingScreen.tsx         # 최초 1회만 보여주는 온보딩 슬라이드
├─ SurveyScreen.tsx             # 산책 취향 설문
├─ LoginScreen.tsx              # 카카오 로그인 진입점
├─ LocationPermissionScreen.tsx # 위치 권한 요청/안내
├─ ActivityPermissionScreen.tsx # 신체 활동(만보계) 권한 요청/안내
├─ MainRouter.tsx               # 로그인 이후 앱 셸 — 하단 탭/산책 플로우 전환 (Stack 라우트 이름은 'Home')
├─ HomeScreen.tsx               # 하단 탭 '홈' — 지도 + 채팅 바텀시트
├─ MyPageScreen.tsx             # 하단 탭 '마이페이지'
├─ record/
│  └─ RecordTab.tsx             # 하단 탭 '기록'
└─ walk/
   ├─ WalkFlow.tsx              # 산책 전/중/후 3단계를 묶는 로컬 플로우 컨트롤러
   ├─ WalkPrepScreen.tsx        # 6a. 산책 시작 전 경로 미리보기
   ├─ WalkInProgressScreen.tsx  # 6b. 산책 진행 중 실시간 화면
   ├─ WalkEndConfirmModal.tsx   # 6c. 산책 종료 확인 모달
   └─ WalkCompleteScreen.tsx    # 6d. 산책 완료 요약
```

---

## 1. 전체 흐름 (`App.tsx`)

`App.tsx`는 `@react-navigation/native-stack`의 `Stack.Navigator`로 아래 8개 화면 중 하나만 렌더링합니다. "지금 어떤 화면을 보여줄지" 판단하는 로직은 화면 안이 아니라 `src/auth/AppBootstrap.tsx`(Context Provider)의 `computeTargetScreen()`에 있습니다 — 상태가 바뀌면 Provider가 `navigationRef.reset(...)`을 호출해 imperative하게 전환합니다.

```
BrandSplash (2초 타이머)
        │
        ▼
Loading ── 온보딩 열람 기록 확인 중
        │
        ▼
Onboarding ── 최초 1회만 (SecureStore에 열람 기록 저장)
        │
        ▼
Login ── 카카오 로그인 → authState 'loggedIn'
        │
        ▼  GET /api/user/survey
        │
        ├─ survey_completed: false ──▶ Survey
        └─ survey_completed: true  ──▶ (스킵)
        │
        ▼
LocationPermission ── onRequest / onSkip
        │
        ▼
ActivityPermission ── onGranted / onSkip
        │
        ▼
Home (앱 셸 — MainRouter.tsx)
```

각 화면 이름의 타입(`RootStackParamList`)은 `src/types/navigation.ts`에, 계산 로직과 상세 흐름은 `src/README.md`의 "2. 앱 전체 화면 흐름"에 정리돼 있습니다. 이 문서는 그 아래 단계, 즉 `Home` 라우트 안쪽(`MainRouter.tsx`와 산책 플로우)에 집중합니다.

---

## 2. MainRouter 내부 탭 구조

`MainRouter`는 `Route` 타입(`src/navigation/types.ts`)과 로컬 `useState`만으로 화면을 전환합니다. 앱 전체 화면 전환에 쓰는 react-navigation과는 별개의, 의도적으로 분리된 계층입니다 — 하단 탭 전환처럼 화면 스택에 남길 필요 없는 잦은 전환에 굳이 네비게이션 라이브러리를 쓰지 않기 위함입니다. (하단 탭 바 자체는 `src/components/BottomNav.tsx`.)

| `route.name` | 렌더링되는 화면 | 하단 네비게이션 노출 |
|---|---|---|
| `home` | `HomeScreen` (지도 + 채팅 바텀시트) | O |
| `record` | `RecordTab` | O |
| `me` | `MyPageScreen` | O |
| `realWalk` | `WalkFlow` | X (산책 중엔 하단 탭 숨김) |

`HomeScreen`(홈 탭)은 `src/bottomsheets/ChatBottomSheet.tsx`로 감싼 바텀시트 안에 `ChatConversation`이 임베드되는 구조입니다. 자세한 내용은 [`src/README.md`의 "5. bottomsheets/"](../README.md)와 [`src/components/README.md`의 "2. chat/"](../components/README.md) 참고.

---

## 3. WalkFlow (산책 전/중/후, `walk/` 폴더)

`WalkFlow.tsx`는 산책 관련 4개 화면(기획 문서 기준 6a~6d)을 하나의 로컬 상태 머신으로 묶습니다 (`stage: 'prep' | 'walking' | 'complete'`).

```
WalkPrepScreen (6a)
   │ onStart
   ▼
WalkInProgressScreen (6b)
   │ 종료 버튼 → onRequestEnd(snapshot)
   ▼
WalkEndConfirmModal (6c)  ← 6b 위에 겹쳐서 뜨는 모달
   │ onConfirm                 │ onCancel → 6b로 복귀(모달만 닫힘)
   ▼
WalkCompleteScreen (6d)
   │ onHome
   ▼
onExitToHome (MainRouter가 activeRoute를 비우고 'home' 탭으로 복귀)
```

- **`WalkPrepScreen` (6a)**: 받은 경로를 지도에 미리 보여주고 거리/예상 시간/칼로리를 계산해 표시. "산책 시작" → `stage: 'walking'`. 뒤로가기(`onBack`)는 `WalkFlow` 밖으로 나가 바로 `onExitToHome` 호출.
- **`WalkInProgressScreen` (6b)**: `useWatchLocation`으로 실시간 위치를 추적해 `WalkProgressTracker`(`src/utils/walkProgress.ts`)로 진행률을 계산하고, 만보계(`Pedometer.watchStepCount`)로 걸음 수를 측정. 지도(`RouteMapView`)엔 진행률(`traveledKm`)을 넘겨 지나온 구간/남은 구간을 다른 색으로, 방향 화살표와 출발·도착 마커도 함께 표시합니다(순환 코스에서 방향을 알기 쉽게). 종료 버튼을 누르면 지금까지의 거리/시간/걸음 수를 스냅샷으로 만들어 `onRequestEnd`로 올려보냄(화면 전환은 아직 안 함).
- **`WalkEndConfirmModal` (6c)**: "정말 종료할까요?" 확인 모달. `onConfirm`을 눌러야만 `stage: 'complete'`로 넘어가고, `onCancel`이면 모달만 닫히고 6b가 계속 진행됨.
- **`WalkCompleteScreen` (6d)**: 최종 거리/시간/걸음 수 요약, 즐겨찾기 토글(`toggleFavoriteRoute`). "홈으로" → `onHome` → `WalkFlow`의 `onExitToHome` → `MainRouter`가 `home` 탭으로 복귀.

> **`WalkInProgressScreen`의 진행률 계산 상세**는 `src/README.md`의 "14. utils/" 항목과 `src/utils/walkProgress.ts`의 클래스 주석을 참고하세요 — GPS 튐 필터링, 경로 이탈 시 갱신 보류, 역행 방지 세 가지를 처리합니다.
