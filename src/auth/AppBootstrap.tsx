import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { useKakaoAuth } from './useKakaoAuth';
import { onboardingStorage } from './onboardingStorage';
import { getSurvey } from '../api/survey';
import { navigationRef } from '../navigation/navigationRef';
import { useAppStateChange } from '../hooks/useAppStateChange';
import type { RootScreenName } from '../types/navigation';

type PermissionStatus = 'checking' | 'granted' | 'denied' | 'undetermined';

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
  skipLocationPermission: () => void;
  activityStatus: PermissionStatus;
  grantActivityPermission: () => void;
  skipActivityPermission: () => void;
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
}): RootScreenName {
  const isCheckingPermissions =
    s.permissionStatus === 'checking' ||
    (s.permissionStatus === 'granted' && s.activityStatus === 'checking');

  if (s.showBrandSplash) return 'BrandSplash';
  if (s.onboardingStatus === 'checking') return 'Loading';
  if (s.onboardingStatus === 'unseen') return 'Onboarding';
  if (s.authState === 'loading' || (s.authState === 'loggedIn' && s.surveyStatus === 'checking')) {
    return 'Loading';
  }
  if (s.authState === 'loggedIn' && s.surveyStatus === 'pending') return 'Survey';
  if (s.authState === 'loggedIn' && isCheckingPermissions) return 'Loading';
  if (s.authState === 'loggedOut') return 'Login';
  if (s.permissionStatus === 'undetermined' || s.permissionStatus === 'denied') {
    return 'LocationPermission';
  }
  if (s.activityStatus === 'undetermined') return 'ActivityPermission';
  return 'Home';
}

export function AppBootstrapProvider({ children }: { children: React.ReactNode }) {
  const { authState, userId, error, signIn, signOut } = useKakaoAuth();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');
  const [activityStatus, setActivityStatus] = useState<PermissionStatus>('checking');

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

  const checkLocationPermission = useCallback(async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionStatus('granted');
    } else if (status === 'denied') {
      setPermissionStatus('denied');
    } else {
      setPermissionStatus('undetermined');
    }
  }, []);

  useEffect(() => {
    if (authState !== 'loggedIn') return;
    checkLocationPermission();
  }, [authState, checkLocationPermission]);

  // 설정 앱에서 돌아왔을 때 권한 상태 재확인
  useAppStateChange({
    onForeground: () => {
      if (authState === 'loggedIn' && permissionStatus === 'denied') {
        checkLocationPermission();
      }
    },
  });

  // 위치 권한이 확정된 뒤 신체 활동 권한을 확인합니다.
  useEffect(() => {
    if (authState !== 'loggedIn' || permissionStatus !== 'granted') return;
    Pedometer.getPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setActivityStatus('granted');
      } else if (status === 'denied') {
        setActivityStatus('denied');
      } else {
        setActivityStatus('undetermined');
      }
    });
  }, [authState, permissionStatus]);

  const targetScreen = computeTargetScreen({
    showBrandSplash,
    onboardingStatus,
    authState,
    surveyStatus,
    permissionStatus,
    activityStatus,
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
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
      },
      skipLocationPermission: () => setPermissionStatus('granted'),
      activityStatus,
      grantActivityPermission: () => setActivityStatus('granted'),
      skipActivityPermission: () => setActivityStatus('denied'),
    }),
    [authState, userId, error, signIn, signOut, permissionStatus, activityStatus],
  );

  return (
    <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>
  );
}
