# src/screens

스크린을 모아두는 폴더입니다. `App.tsx`와 `HomeScreen.tsx`가 로컬 `useState`로 "지금 어떤 화면을 보여줄지"를 직접 분기 처리합니다.

```
src/screens/
├─ BrandSplashScreen.tsx        # 앱 최초 실행 시 2초간 보여주는 로고 스플래시
├─ OnboardingScreen.tsx         # 최초 1회만 보여주는 온보딩 슬라이드
├─ LoginScreen.tsx              # 카카오 로그인 진입점
├─ LocationPermissionScreen.tsx # 위치 권한 요청/안내
├─ ActivityPermissionScreen.tsx # 신체 활동(만보계) 권한 요청/안내
├─ HomeScreen.tsx               # 로그인 이후 메인 셸(하단 탭 + 지도/챗봇)
├─ MyScreen.tsx                 # 하단 탭 '내 정보'
├─ record/
│  └─ RecordTab.tsx             # 하단 탭 '기록'
└─ walk/
   ├─ WalkFlow.tsx              # 산책 전/중/후 3단계를 묶는 로컬 플로우 컨트롤러
   ├─ WalkPrepScreen.tsx        # 6a. 산책 시작 전 경로 미리보기
   ├─ WalkInProgressScreen.tsx  # 6b. 산책 진행 중 실시간 화면
   ├─ WalkEndConfirmModal.tsx   # 6c. 산책 종료 확인 모달
   └─ WalkCompleteScreen.tsx    # 6d. 산책 완료 요약/공유
```

---

## 1. 전체 흐름 (`App.tsx`)

`App.tsx`는 인증/권한/온보딩 상태에 따라 이 화면들 중 하나만 렌더링해줍니다.

```
BrandSplashScreen (2초 타이머)
        │
        ▼
OnboardingScreen ──onDone──▶ 최초 1회만 노출 (SecureStore에 열람 기록 저장)
        │
        ▼
authState === 'loggedOut'
        │
        ▼
LoginScreen ──onLogin(카카오)──▶ authState 'loggedIn'
        │
        ▼
permissionStatus !== 'granted'
        │
        ▼
LocationPermissionScreen ──onRequest / onSkip──▶
        │
        ▼
activityStatus === 'undetermined'
        │
        ▼
ActivityPermissionScreen ──onGranted / onSkip──▶
        │
        ▼
HomeScreen (메인 화면)
```

- 권한 화면에서 "허용" 또는 "건너뛰기"를 누르면 `App.tsx` state가 바뀌고, 그 값에 따라 다음 화면으로 자동 전환됩니다.

---

## 2. HomeScreen 내부 탭 구조

`HomeScreen`은 `Route` 타입(`src/navigation/types.ts`)과 로컬 `useState`만으로 화면을 전환합니다.

| `route.name` | 렌더링되는 화면 | 하단 네비게이션 노출 |
|---|---|---|
| `home` | O |
| `record` | `RecordTab` | O |
| `me` | `MyScreen` | O |
| `realWalk` | `WalkFlow` | X (산책 중엔 하단 탭 숨김) |

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
onExitToHome (HomeScreen이 activeRoute를 비우고 'home' 탭으로 복귀)
```

- **`WalkPrepScreen` (6a)**: 받은 경로를 지도에 미리 보여주고 거리/예상 시간/칼로리를 계산해 표시. "산책 시작" → `stage: 'walking'`. 뒤로가기(`onBack`)는 `WalkFlow` 밖으로 나가 바로 `onExitToHome` 호출.
- **`WalkInProgressScreen` (6b)**: `useWatchLocation`으로 실시간 위치를 추적해 `calculateWalkProgress`로 진행률을 계산하고, 만보계(`Pedometer.watchStepCount`)로 걸음 수를 측정. 종료 버튼을 누르면 지금까지의 거리/시간/걸음 수를 스냅샷으로 만들어 `onRequestEnd`로 올려보냄(화면 전환은 아직 안 함).
- **`WalkEndConfirmModal` (6c)**: "정말 종료할까요?" 확인 모달. `onConfirm`을 눌러야만 `stage: 'complete'`로 넘어가고, `onCancel`이면 모달만 닫히고 6b가 계속 진행됨.
- **`WalkCompleteScreen` (6d)**: 최종 거리/시간/걸음 수 요약, 즐겨찾기 토글(`toggleFavoriteRoute`), 공유하기(`react-native-share` + `ViewShot`으로 카드 캡처 후 공유). "홈으로" → `onHome` → `WalkFlow`의 `onExitToHome` → `HomeScreen`이 `home` 탭으로 복귀.

---