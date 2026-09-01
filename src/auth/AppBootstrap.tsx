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
import { onboardingStorage } from './onboardingStorage';
import {
  PermissionSnapshot,
  PermissionState,
  readPermissionSnapshot,
  requestLocationPermission as requestLocationPermissionOS,
} from './permissions';
import { getSurvey } from '../api/survey';
import { navigationRef } from '../navigation/navigationRef';
import { useAppStateChange } from '../hooks/useAppStateChange';
import type { RootScreenName } from '../types/navigation';

type PermissionStatus = 'checking' | PermissionState;

const EMPTY_SNAPSHOT: PermissionSnapshot = {
  location: 'undetermined',
  pedometer: 'undetermined',
  locationGranted: false,
  pedometerGranted: false,
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
function computeTargetScreen(s: {
  showBrandSplash: boolean;
  onboardingStatus: 'checking' | 'seen' | 'unseen';
  authState: 'loading' | 'loggedIn' | 'loggedOut';
  surveyStatus: 'checking' | 'completed' | 'pending';
  permissionStatus: PermissionStatus;
  activityStatus: PermissionStatus;
  activityPromptDone: boolean;
}): RootScreenName {
  const isCheckingPermissions =
    s.permissionStatus === 'checking' ||
    (s.activityStatus === 'checking' && !s.activityPromptDone);

  if (s.showBrandSplash) return 'BrandSplash';
  if (s.onboardingStatus === 'checking') return 'Loading';
  if (s.onboardingStatus === 'unseen') return 'Onboarding';
  if (s.authState === 'loading' || (s.authState === 'loggedIn' && s.surveyStatus === 'checking')) {
    return 'Loading';
  }
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
  if (s.activityStatus !== 'granted' && !s.activityPromptDone) return 'ActivityPermission';
  return 'Home';
}

export function AppBootstrapProvider({ children }: { children: React.ReactNode }) {
  const { authState, userId, error, signIn, signOut } = useKakaoAuth();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');
  const [activityStatus, setActivityStatus] = useState<PermissionStatus>('checking');
  // 사용자가 걸음 수 권한 화면에서 "허용" 또는 "건너뛰기"를 한 번이라도 눌렀는지.
  // "거부"만 한 상태에서는 아직 false(화면에 남아 "설정에서 허용"을 시도할 수 있어야 함).
  const [activityPromptDone, setActivityPromptDone] = useState(false);
  const [permissionSnapshot, setPermissionSnapshot] = useState<PermissionSnapshot>(EMPTY_SNAPSHOT);

  const [showBrandSplash, setShowBrandSplash] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'seen' | 'unseen'>(
    'checking',
  );
  const [surveyStatus, setSurveyStatus] = useState<'checking' | 'completed' | 'pending'>(
    'checking',
  );

  useEffect(() => {
    onboardingStorage.getHasSeen().then(value => {
      setOnboardingStatus(value === 'true' ? 'seen' : 'unseen');
    });
    const timer = setTimeout(() => setShowBrandSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authState !== 'loggedIn') return;
    getSurvey({ timeout: 8000 })
      .then(({ data }) => {
        console.log('[App] GET /api/user/survey 응답:', data);
        setSurveyStatus(data.survey_completed ? 'completed' : 'pending');
      })
      .catch(e => {
        console.warn('[App] GET /api/user/survey 실패 → pending 폴백:', e?.message ?? e);
        setSurveyStatus('pending');
      });
  }, [authState]);

  // 위치·걸음 수 권한을 OS에 한 번에 물어 3-state와 boolean 스냅샷을 함께 갱신한다.
  // 동시에 여러 곳(포그라운드 복귀 + 경로 생성 버튼 등)에서 불려도 실제 OS 조회는 1회만
  // 하도록 진행 중인 Promise를 재사용한다.
  const refreshInFlightRef = useRef<Promise<PermissionSnapshot> | null>(null);
  const lastSnapshotRef = useRef<PermissionSnapshot>(EMPTY_SNAPSHOT);
  const refreshPermissions = useCallback((): Promise<PermissionSnapshot> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const run = readPermissionSnapshot()
      .then(snap => {
        lastSnapshotRef.current = snap;
        setPermissionSnapshot(snap);
        setPermissionStatus(snap.location);
        setActivityStatus(snap.pedometer);
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
    activityPromptDone,
  });

  // targetScreen이 바뀔 때만 navigation.replace() 호출 — 화면 컴포넌트 안이 아니라
  // 여기(Provider)에서 상태를 감시하다가 imperative하게 전환한다.
  // reset()으로 스택 전체를 새 화면 하나로 교체한다 — 예전 조건부 렌더링처럼 뒤로가기 히스토리가
  // 전혀 남지 않는 게 원래 동작이었으므로(로그인 화면으로 뒤로가기가 되면 안 됨) replace 대신 reset 사용.
  // Stack.Navigator의 initialRouteName이 이미 'BrandSplash'라, 최초 마운트 시 targetScreen도
  // 'BrandSplash'라면 reset()이 불필요하다 — 그 1회만 건너뛰면 되므로 boolean으로 충분하다.
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (!hasNavigatedRef.current && targetScreen === 'BrandSplash') {
      hasNavigatedRef.current = true;
      return;
    }
    hasNavigatedRef.current = true;
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: targetScreen }] });
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
      resetSurvey: () => setSurveyStatus('pending'),
      permissionStatus,
      requestLocationPermission: async () => {
        await requestLocationPermissionOS();
        await refreshPermissions();
      },
      activityStatus,
      grantActivityPermission: () => {
        setActivityStatus('granted');
        setActivityPromptDone(true);
      },
      denyActivityPermission: () => setActivityStatus('denied'),
      skipActivityPermission: () => setActivityPromptDone(true),
      locationGranted: permissionSnapshot.locationGranted,
      pedometerGranted: permissionSnapshot.pedometerGranted,
      allGranted: permissionSnapshot.allGranted,
      refreshPermissions,
      ensureWalkable: async () => {
        const snap = await refreshPermissions();
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
