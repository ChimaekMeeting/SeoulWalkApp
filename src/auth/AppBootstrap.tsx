import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useKakaoAuth } from './useKakaoAuth';
import { onboardingStorage, activityPromptStorage, surveyCompletedStorage } from './onboardingStorage';
import {
  PermissionSnapshot,
  PermissionState,
  readPermissionSnapshot,
  requestLocationPermission as requestLocationPermissionOS,
} from './permissions';
import { getSurvey, SurveyStatusResponse } from '../api/survey';
import { navigationRef } from '../navigation/navigationRef';
import { useAppStateChange } from '../hooks/useAppStateChange';
import { debugLog } from '../utils/logger';
import type { RootScreenName } from '../types/navigation';

type PermissionStatus = 'checking' | PermissionState;

// 설문 완료 여부 최초 조회(로컬 캐시가 없을 때만 탐)에 쓰는 타임아웃. client.ts 기본값(20초,
// Cloud Run 콜드스타트 최악치 대비)보다 짧게 잡는다 — 사람이 로딩 화면에서 버틸 수 있는 한계는
// 그보다 훨씬 짧고(NN/g 기준 ~10초가 주의력 유지 한계), 실제 콜드스타트는 보통 8~10초 안에 끝난다.
// 이 시간 안에 응답이 없으면 일단 Home으로 통과시키고 백그라운드에서 계속 재시도한다.
const SURVEY_CHECK_TIMEOUT_MS = 8000;

const EMPTY_SNAPSHOT: PermissionSnapshot = {
  location: 'undetermined',
  pedometer: 'undetermined',
  locationGranted: false,
  pedometerGranted: false,
  pedometerUnavailable: false,
  allGranted: false,
};

interface AppBootstrapState {
  authState: 'loading' | 'loggedIn' | 'loggedOut';
  userId: string | null | undefined;
  loginError: string | null;
  signIn: () => void;
  signOut: () => void;
  onboardingDone: () => void;
  surveyDone: () => void;
  resetSurvey: () => void;
  permissionStatus: PermissionStatus;
  requestLocationPermission: () => void;
  activityStatus: PermissionStatus;
  grantActivityPermission: () => void;
  denyActivityPermission: () => void;
  skipActivityPermission: () => void;
  /** OS에 마지막으로 물어본 위치·걸음 수 권한 스냅샷 */
  locationGranted: boolean;
  pedometerGranted: boolean;
  allGranted: boolean;
  /** 위치·걸음 수 권한을 OS에 다시 물어 상태를 갱신한다(포그라운드 복귀·기능 실행 직전용). */
  refreshPermissions: () => Promise<PermissionSnapshot>;
  /**
   * 산책 경로 생성/진입 직전 최종 게이트. OS에 재확인 후 "위치 권한이 있어 진행 가능한가"를
   * 돌려준다. 위치가 없으면 permissionStatus가 바뀌며 자동으로 권한 안내 화면으로 이동한다.
   */
  ensureWalkable: () => Promise<boolean>;
}

const AppBootstrapContext = createContext<AppBootstrapState | null>(null);

export function useAppBootstrap(): AppBootstrapState {
  const ctx = useContext(AppBootstrapContext);
  if (!ctx) {
    throw new Error('useAppBootstrap은 AppBootstrapProvider 안에서만 쓸 수 있습니다.');
  }
  return ctx;
}

// App.tsx의 기존 if/else 상태분기와 완전히 같은 우선순위로 "지금 어떤 화면을 보여줘야 하는가"를
// 계산한다. 순서를 바꾸면 안 됨 — 예를 들어 showBrandSplash가 항상 최우선이어야 한다.
// 순수 함수라 유닛 테스트로 권한 상태 전이를 전부 커버한다(src/auth/__tests__/computeTargetScreen.test.ts).
export function computeTargetScreen(s: {
  showBrandSplash: boolean;
  onboardingStatus: 'checking' | 'seen' | 'unseen';
  authState: 'loading' | 'loggedIn' | 'loggedOut';
  // 'loading' : 설문 완료 여부 확인 중 · 'completed' : 완료 · 'pending' : 서버가 명시적으로 미완료 반환
  // 'unknown' : 네트워크 오류·타임아웃 등으로 확인 실패 — 이 상태로는 설문 화면으로 보내지 않는다
  //             (일시적 실패로 기존 사용자를 신규 사용자처럼 다루면 안 되므로).
  surveyStatus: 'loading' | 'completed' | 'pending' | 'unknown';
  permissionStatus: PermissionStatus;
  activityStatus: PermissionStatus;
  activityPromptStatus: 'checking' | 'done' | 'pending';
}): RootScreenName {
  const activityPromptDone = s.activityPromptStatus === 'done';
  // 초기 상태가 아직 checking이면 최종 화면을 확정하지 않고 Loading에 머문다 —
  // SecureStore 조회가 끝나기 전에 ActivityPermission으로 튕겼다가 되돌아오는 깜빡임을 막는다.
  const isCheckingPermissions =
    s.permissionStatus === 'checking' ||
    s.activityPromptStatus === 'checking' ||
    (s.activityStatus === 'checking' && !activityPromptDone);

  if (s.showBrandSplash) return 'BrandSplash';
  if (s.onboardingStatus === 'checking') return 'Loading';
  if (s.onboardingStatus === 'unseen') return 'Onboarding';
  if (s.authState === 'loading' || (s.authState === 'loggedIn' && s.surveyStatus === 'loading')) {
    return 'Loading';
  }
  // 서버가 "설문 미완료"라고 명시(pending)했을 때만 설문 화면으로. 'unknown'(조회 실패)은
  // 여기서 걸러지지 않고 아래로 흘러 Home으로 간다 — AppBootstrapProvider가 백그라운드에서
  // 재시도하며, 서버가 실제로 pending을 주면 그때 이 분기가 다시 잡는다.
  if (s.authState === 'loggedIn' && s.surveyStatus === 'pending') return 'Survey';
  if (s.authState === 'loggedIn' && isCheckingPermissions) return 'Loading';
  if (s.authState === 'loggedOut') return 'Login';
  // 위치 권한은 필수 — granted가 아니면(미결정·거부·나중에 설정에서 취소) 항상 안내 화면으로.
  // 산책은 GPS 없이는 불가능하므로 세션 중 취소돼도 여기서 다시 잡는다.
  if (s.permissionStatus !== 'granted') return 'LocationPermission';
  // 걸음 수 권한은 선택. 아직 이 화면에서 아무 선택(허용/건너뛰기)도 안 했고 granted도 아니면
  // 한 번은 안내한다. 한 번 처리했으면(activityPromptDone) 이후 설정에서 꺼도 화면을 강제로
  // 다시 띄우지 않는다 — 걸음 수는 없어도 거리 기반 추정치로 산책이 되고, 산책 도중에
  // 앱이 포그라운드로 돌아올 때마다 이 화면으로 튕기면 안 되기 때문. (pedometerGranted 값으로는 계속 노출됨)
  if (s.activityStatus !== 'granted' && !activityPromptDone) return 'ActivityPermission';
  return 'Home';
}

export function AppBootstrapProvider({ children }: { children: React.ReactNode }) {
  const { authState, userId, error, signIn, signOut } = useKakaoAuth();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');
  const [activityStatus, setActivityStatus] = useState<PermissionStatus>('checking');
  // 사용자가 걸음 수 권한 화면에서 "허용" 또는 "건너뛰기"를 한 번이라도 눌렀는지.
  // SecureStore('activity_prompt_done')에 영구 저장하므로 앱을 껐다 켜도 유지된다.
  //  - 'checking': 앱 시작 직후 SecureStore 조회 중 (이 화면으로 성급히 넘기지 않기 위해 대기)
  //  - 'done'    : 저장된 값이 'true' (허용/건너뛰기 완료 → 다시 안 보임)
  //  - 'pending' : 값이 없거나 'true'가 아님 (아직 안 보여줬거나 "거부"만 누른 상태)
  // "거부"만 한 상태에서는 저장하지 않아 'pending'으로 남는다(화면에 남아 "설정에서 허용" 재시도 가능).
  const [activityPromptStatus, setActivityPromptStatus] = useState<'checking' | 'done' | 'pending'>(
    'checking',
  );
  const [permissionSnapshot, setPermissionSnapshot] = useState<PermissionSnapshot>(EMPTY_SNAPSHOT);

  const [showBrandSplash, setShowBrandSplash] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'seen' | 'unseen'>(
    'checking',
  );
  const [surveyStatus, setSurveyStatus] = useState<
    'loading' | 'completed' | 'pending' | 'unknown'
  >('loading');

  useEffect(() => {
    // 온보딩 열람 여부 · 걸음 수 권한 안내 완료 여부를 SecureStore에서 한 번 읽어 초기화한다.
    let cancelled = false;

    // 온보딩 플래그 조회: 저장소 오류는 최대 3회 재시도한다. 끝내 실패하면 'unseen'이 아니라
    // 'seen'으로 폴백한다 — 조회 실패를 신규 사용자처럼 다뤄 기존 사용자를 온보딩으로 되돌리는
    // 것이 이 화면 반복 버그의 핵심이었기 때문. (신규 사용자가 이번 실행에서 온보딩을 한 번
    // 놓칠 수는 있으나, 온보딩 무한 반복보다 안전하다. 무한 Loading도 재시도 상한으로 방지.)
    const resolveOnboarding = async () => {
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const result = await onboardingStorage.readHasSeen();
        if (cancelled) return;
        if (result.ok) {
          if (__DEV__) {
            console.log('[App] onboarding flag read', {
              value: result.raw,
              hasSeen: result.value,
            });
          }
          setOnboardingStatus(result.value ? 'seen' : 'unseen');
          return;
        }
        console.warn(
          `[App] 온보딩 열람 기록 조회 실패 (${attempt}/${MAX_ATTEMPTS}):`,
          result.error,
        );
        if (attempt < MAX_ATTEMPTS) {
          await new Promise<void>(resolve => setTimeout(() => resolve(), 300));
          if (cancelled) return;
        }
      }
      console.warn('[App] 온보딩 열람 기록 조회 최종 실패 → seen 폴백(온보딩 재노출 방지 우선)');
      setOnboardingStatus('seen');
    };
    resolveOnboarding();

    // 걸음 수 권한 안내를 이전 실행에서 이미 처리(허용/건너뛰기)했으면 다시 띄우지 않는다.
    activityPromptStorage
      .getPromptDone()
      .then(done => {
        if (!cancelled) setActivityPromptStatus(done ? 'done' : 'pending');
      })
      .catch(e => {
        console.warn('[App] activity_prompt_done 조회 실패 → pending 폴백:', e);
        if (!cancelled) setActivityPromptStatus('pending');
      });
    const timer = setTimeout(() => setShowBrandSplash(false), 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (authState !== 'loggedIn') return;
    let cancelled = false;

    // 설문(산책 취향) 완료 여부 확인.
    //  - 온보딩 플래그와 동일하게, 로컬 완료 캐시(surveyCompletedStorage)가 있으면 서버 응답을
    //    기다리지 않고 곧장 'completed'로 통과시킨다 — 한 번 완료가 확인된 기기에서까지 매번
    //    콜드스타트를 기다리며 로딩 화면에 머물 이유가 없다. 서버 조회는 로컬 캐시가 없을 때
    //    (최초 설문 전·재설치 등)만 필요하고, 이때만 아래 타임아웃/재시도가 적용된다.
    //  - 조회 실패(네트워크 오류·타임아웃)를 'pending'(미완료)으로 처리하지 않는다 — 그게 "재시작마다
    //    설문 재노출" 버그의 핵심이었다. 실패 시엔 'unknown'으로 두고 백그라운드에서 재시도한다.
    //  - 최초 1회는 결과가 나올 때까지 Loading을 유지하고, 실패하면 Home으로 내보낸 뒤 백그라운드에서
    //    재시도해 서버와 상태를 맞춘다(서버가 실제로 'pending'을 주면 computeTargetScreen이 설문으로 보냄).
    const applyServerData = (data: SurveyStatusResponse) => {
      console.log('[App] GET /api/user/survey 응답:', data);
      // 마이그레이션 기간: survey_completed가 아직 false여도 저장된 태그가 있으면 완료로 본다.
      const completed = Boolean(
        data.survey_completed || (data.selected_tags?.length ?? 0) > 0,
      );
      setSurveyStatus(completed ? 'completed' : 'pending');
      // markCompleted(set)는 내부에서 실패를 잡아 boolean만 돌려주므로 reject되지 않는다.
      if (completed) surveyCompletedStorage.markCompleted();
    };

    const resolveSurvey = async () => {
      const locallyCompleted = await surveyCompletedStorage.get().catch(() => false);
      if (cancelled) return;
      if (locallyCompleted) {
        setSurveyStatus('completed');
        return;
      }

      try {
        const { data } = await getSurvey({ timeout: SURVEY_CHECK_TIMEOUT_MS });
        if (cancelled) return;
        applyServerData(data);
        return;
      } catch (e) {
        if (cancelled) return;
        console.warn(
          '[App] GET /api/user/survey failed → unknown, 백그라운드 재시도:',
          (e as { message?: string })?.message ?? e,
        );
        setSurveyStatus('unknown');
      }

      // 백그라운드 재시도: 이미 Home(또는 completed)인 상태로 서버 상태를 다시 맞춘다.
      for (let attempt = 1; attempt <= 3 && !cancelled; attempt++) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), attempt * 3000));
        if (cancelled) return;
        try {
          const { data } = await getSurvey();
          if (cancelled) return;
          applyServerData(data);
          return;
        } catch (e) {
          console.warn(
            `[App] 설문 백그라운드 재시도 ${attempt}/3 실패:`,
            (e as { message?: string })?.message ?? e,
          );
        }
      }
    };

    resolveSurvey();
    return () => {
      cancelled = true;
    };
  }, [authState]);

  // 위치·걸음 수 권한을 OS에 한 번에 물어 3-state와 boolean 스냅샷을 함께 갱신한다.
  // 동시에 여러 곳(포그라운드 복귀 + 경로 생성 버튼 등)에서 불려도 실제 OS 조회는 1회만
  // 하도록 진행 중인 Promise를 재사용한다.
  const refreshInFlightRef = useRef<Promise<PermissionSnapshot> | null>(null);
  const lastSnapshotRef = useRef<PermissionSnapshot>(EMPTY_SNAPSHOT);
  const refreshPermissions = useCallback((): Promise<PermissionSnapshot> => {
    if (refreshInFlightRef.current) {
      debugLog('refreshPermissions', 'dedupe: reused in-flight OS query');
      return refreshInFlightRef.current;
    }
    debugLog('refreshPermissions', 'start');
    const run = readPermissionSnapshot()
      .then(snap => {
        lastSnapshotRef.current = snap;
        setPermissionSnapshot(snap);
        setPermissionStatus(snap.location);
        setActivityStatus(snap.pedometer);
        debugLog('refreshPermissions', 'done', {
          location: snap.location,
          pedometer: snap.pedometer,
        });
        return snap;
      })
      .catch((err): PermissionSnapshot => {
        // 권한 조회 API가 던지는 일은 거의 없지만, 던지면 상태를 건드리지 않고 직전 스냅샷을
        // 돌려준다(다음 포그라운드 복귀에서 회복). 미처리 rejection 방지용.
        console.warn('[permissions] 재조회 실패:', err?.message ?? err);
        return lastSnapshotRef.current;
      })
      .finally(() => {
        refreshInFlightRef.current = null;
      });
    refreshInFlightRef.current = run;
    return run;
  }, []);

  // 로그인 직후 1회 + 앱이 백그라운드/비활성에서 포그라운드로 돌아올 때마다 두 권한 모두 재조회.
  // (설정 앱에서 권한을 켜거나 끄고 돌아온 상황을 여기서 잡는다.)
  useEffect(() => {
    if (authState !== 'loggedIn') return;
    refreshPermissions();
  }, [authState, refreshPermissions]);

  useAppStateChange({
    onForeground: () => {
      debugLog('appState', 'background/inactive → active', {
        willRefresh: authState === 'loggedIn',
      });
      if (authState === 'loggedIn') refreshPermissions();
    },
  });

  const targetScreen = computeTargetScreen({
    showBrandSplash,
    onboardingStatus,
    authState,
    surveyStatus,
    permissionStatus,
    activityStatus,
    activityPromptStatus,
  });

  // targetScreen이 바뀔 때만 navigation.replace() 호출 — 화면 컴포넌트 안이 아니라
  // 여기(Provider)에서 상태를 감시하다가 imperative하게 전환한다.
  // reset()으로 스택 전체를 새 화면 하나로 교체한다 — 예전 조건부 렌더링처럼 뒤로가기 히스토리가
  // 전혀 남지 않는 게 원래 동작이었으므로(로그인 화면으로 뒤로가기가 되면 안 됨) replace 대신 reset 사용.
  // Stack.Navigator의 initialRouteName이 이미 'BrandSplash'라, 최초 마운트 시 targetScreen도
  // 'BrandSplash'라면 reset()이 불필요하다 — 그 1회만 건너뛰면 되므로 boolean으로 충분하다.
  useEffect(() => {
    if (__DEV__) {
      // targetScreen 계산에 실제로 들어간 입력 전체를 같이 찍는다 — surveyStatus가 왜 이
      // 값인지(pending인데 왜 Survey가 아닌지 등) 이 한 줄만 보고 바로 알 수 있게.
      console.log('[App] target screen derived', {
        targetScreen,
        showBrandSplash,
        onboardingStatus,
        authState,
        surveyStatus,
        permissionStatus,
        activityStatus,
        activityPromptStatus,
      });
    }
  }, [
    targetScreen,
    showBrandSplash,
    onboardingStatus,
    authState,
    surveyStatus,
    permissionStatus,
    activityStatus,
    activityPromptStatus,
  ]);

  const hasNavigatedRef = useRef(false);
  // 마지막으로 reset한 화면 이름. computeTargetScreen이 같은 값을 다시 내놓거나(useEffect deps로도
  // 걸러지지만 StrictMode 이중 호출 대비) 초기 상태가 checking→실제값으로 바뀌며 잠깐 왕복해도
  // 동일 화면으로는 두 번 reset하지 않는다 — 스택이 반복 초기화되며 깜빡이는 걸 막는다.
  const lastResetTargetRef = useRef<RootScreenName | null>(null);
  useEffect(() => {
    if (!hasNavigatedRef.current && targetScreen === 'BrandSplash') {
      hasNavigatedRef.current = true;
      lastResetTargetRef.current = 'BrandSplash';
      return;
    }
    hasNavigatedRef.current = true;
    if (lastResetTargetRef.current === targetScreen) {
      debugLog('navigation', 'skip: same as last reset target', { targetScreen });
      return;
    }
    if (navigationRef.isReady()) {
      debugLog('navigation', 'reset to derived target screen', { targetScreen });
      navigationRef.reset({ index: 0, routes: [{ name: targetScreen }] });
      lastResetTargetRef.current = targetScreen;
    } else {
      debugLog('navigation', 'skip: navigationRef not ready', { targetScreen });
    }
  }, [targetScreen]);

  const value = useMemo<AppBootstrapState>(
    () => ({
      authState,
      userId,
      loginError: error,
      signIn,
      signOut,
      onboardingDone: () => setOnboardingStatus('seen'),
      surveyDone: () => setSurveyStatus('completed'),
      resetSurvey: () => {
        debugLog('resetSurvey', 'called: local flag clear + surveyStatus → pending');
        // clear는 내부에서 실패를 잡으므로 reject되지 않는다.
        surveyCompletedStorage.clear();
        setSurveyStatus('pending');
      },
      permissionStatus,
      requestLocationPermission: async () => {
        await requestLocationPermissionOS();
        await refreshPermissions();
      },
      activityStatus,
      // 허용/건너뛰기 모두 SecureStore 저장이 성공한 뒤에만 상태를 'done'으로 바꾼다 —
      // 저장 실패 시 다음 실행에서 화면이 다시 나오는 게, 저장 안 된 채 'done'인 것보다 안전하다.
      grantActivityPermission: async () => {
        const saved = await activityPromptStorage.markPromptDone();
        if (!saved) {
          console.warn('[App] activity_prompt_done 저장 실패 → 상태 변경 보류(다음 실행 시 재노출 가능)');
          return;
        }
        setActivityStatus('granted');
        setActivityPromptStatus('done');
      },
      // "거부"는 저장하지 않는다 — 화면에 남아 "설정에서 허용"을 재시도할 수 있어야 하므로.
      denyActivityPermission: () => setActivityStatus('denied'),
      skipActivityPermission: async () => {
        const saved = await activityPromptStorage.markPromptDone();
        if (!saved) {
          console.warn('[App] activity_prompt_done 저장 실패 → 건너뛰기 상태 변경 보류');
          return;
        }
        setActivityPromptStatus('done');
      },
      locationGranted: permissionSnapshot.locationGranted,
      pedometerGranted: permissionSnapshot.pedometerGranted,
      allGranted: permissionSnapshot.allGranted,
      refreshPermissions,
      ensureWalkable: async () => {
        const snap = await refreshPermissions();
        debugLog('ensureWalkable', 'final permission check before walk', {
          locationGranted: snap.locationGranted,
          pedometerGranted: snap.pedometerGranted,
          pedometerUnavailable: snap.pedometerUnavailable,
        });
        return snap.locationGranted;
      },
    }),
    [
      authState,
      userId,
      error,
      signIn,
      signOut,
      permissionStatus,
      activityStatus,
      permissionSnapshot,
      refreshPermissions,
    ],
  );

  return (
    <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>
  );
}
