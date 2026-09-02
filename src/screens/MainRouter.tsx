import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Alert,
  BackHandler,
  StatusBar,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocation } from '../hooks/useLocation';
import { useAppStateChange } from '../hooks/useAppStateChange';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { debugLog } from '../utils/logger';
import { snapWalkRoute } from '../utils/mapMatchRoute';
import { markRouteWalked } from '../utils/recentRouteUsage';
import { LocationInfo, WalkRouteResponse } from '../types/prewalk';
import { colors } from '../theme/tokens';
import { authStorage } from '../auth/authStorage';
import { Route, TabName } from '../navigation/types';
import { BottomNav } from '../components/BottomNav';
import { HomeScreen, HomeScreenHandle } from './HomeScreen';
import { WalkFlow } from './walk/WalkFlow';
import { RecordTab } from './record/RecordTab';
import { HistoryFilter } from '../components/record/RouteHistoryList';
import { MyPageScreen } from './MyPageScreen';

// 앱이 30분 넘게 백그라운드/비활성 상태였다가 돌아오면 챗봇 세션(대화 내역)을 리셋한다.
// (실제 산책을 시작한 뒤 종료하면 시간과 무관하게 리셋 — WalkExitEvent.actualWalkingStarted 참고.)
const INACTIVITY_RESET_THRESHOLD_MS = 30 * 60 * 1000;

// 홈에서 뒤로가기를 이 시간 안에 두 번 누르면 앱을 종료한다(안드로이드 표준 "한 번 더 누르면 종료").
const EXIT_CONFIRM_WINDOW_MS = 2000;

// 도로 스냅이 이 시간 안에 안 끝나면 원본 경로로 산책을 시작할 수 있게 한다.
const SNAP_GUARD_MS = 7000;

const TAB_ROUTES: Record<TabName, Route> = {
  home: { name: 'home' },
  record: { name: 'record' },
  me: { name: 'me' },
};

interface MainRouterProps {
  onLogout?: () => void;
  userId?: string | null;
  onResetSurvey?: () => void;
  /** 산책 진입 직전 OS 권한 재확인. false면 진입을 막는다(권한 화면으로 자동 이동됨). */
  ensureWalkable: () => Promise<boolean>;
  /** AppBootstrap의 위치 권한 단일 기준. useLocation은 이 값으로만 좌표 조회 여부를 정한다. */
  locationGranted: boolean;
}

/**
 * 로그인 이후의 앱 셸. `Route` 타입 + 로컬 useState만으로 하단 탭(home/record/me)과 산책
 * 플로우(realWalk)를 전환한다 — 화면 스택에 남길 필요 없는 잦은 전환이라 react-navigation을
 * 쓰지 않는 게 의도된 설계다. App.tsx의 Stack 라우트 이름은 여전히 'Home'.
 */
export function MainRouter({
  onLogout,
  userId,
  onResetSurvey,
  ensureWalkable,
  locationGranted,
}: MainRouterProps) {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  // 기록 탭 필터('최근 경로'/'즐겨찾기'). 탭을 벗어났다 돌아와도 유지되도록 RecordTab이 아닌
  // 여기서 소유한다 — 안드로이드 뒤로가기로 '즐겨찾기'→'최근 경로'로 한 단계 되돌리기도 처리.
  const [recordFilter, setRecordFilter] = useState<HistoryFilter>('recent');
  const [nickname, setNickname] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const homeScreenRef = useRef<HomeScreenHandle>(null);
  // 홈에서 뒤로가기를 마지막으로 누른 시각(2초 내 재입력이면 앱 종료).
  const backPressedAtRef = useRef(0);
  // 산책 플로우(realWalk)에 진입하기 직전 탭. prep 단계에서 취소하고 나갈 때 이 탭으로
  // 되돌린다 — 기록 탭에서 코스를 골라 들어왔으면 홈이 아니라 기록 탭으로 복귀시킨다.
  const walkOriginTabRef = useRef<TabName>('home');

  useEffect(() => {
    Promise.all([authStorage.getNickname(), authStorage.getEmail()]).then(
      ([n, e]) => {
        setNickname(n);
        setEmail(e);
      },
    );
  }, [userId]);
  const {
    coords,
    isLoading: locationLoading,
    error: locationError,
    retry: retryLocation,
  } = useLocation({ enabled: locationGranted });
  const currentLocation: LocationInfo = {
    lat: coords?.latitude ?? null,
    lon: coords?.longitude ?? null,
    address: null,
    place_name: null,
  };
  const [activeRoute, setActiveRoute] = useState<WalkRouteResponse | null>(
    null,
  );
  // 도로 스냅(Map Matching)이 진행 중인 동안 prep의 "산책 시작"을 잠근다 — 산책 시작 후
  // 경로 좌표가 바뀌면 진행률 트래커 기준이 흔들리므로, 스냅을 시작 전에 끝낸다.
  const [routeSnapPending, setRouteSnapPending] = useState(false);

  // key가 바뀌면 ChatConversation이 통째로 리마운트되면서 대화 내역(메시지/threadId)이
  // 초기화된다. ChatConversation 내부(팀원 코드)를 직접 건드리지 않는 안전한 리셋 방법.
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const resetChatSession = () => setChatSessionKey(key => key + 1);

  // 앱이 30분 넘게 백그라운드/비활성 상태였다가 다시 돌아오면 대화를 리셋한다.
  // 단, realWalk 진행 중에는 산책 상태를 보존해야 하므로 리셋하지 않는다.
  const backgroundedAtRef = useRef<number | null>(null);
  useAppStateChange({
    onBackground: () => {
      backgroundedAtRef.current = Date.now();
    },
    onForeground: () => {
      if (
        backgroundedAtRef.current != null &&
        Date.now() - backgroundedAtRef.current >= INACTIVITY_RESET_THRESHOLD_MS &&
        route.name !== 'realWalk'
      ) {
        resetChatSession();
      }
      backgroundedAtRef.current = null;
      // 백그라운드 동안 사용자가 이동했을 수 있으니 현재 위치를 다시 잡는다(지도 파란 점 + 다음 대화 출발지).
      if (route.name !== 'realWalk') retryLocation();
    },
  });

  const go = (next: Route | TabName) => {
    setRoute(typeof next === 'string' ? TAB_ROUTES[next] : next);
  };

  // 경로 카드를 눌러 산책을 시작하기 직전, 캐시가 아닌 최신 상태를 다시 확인한다.
  // 1) OS 위치 권한 — 세션 중 설정에서 껐다면 여기서 걸러지고(ensureWalkable→false)
  //    AppBootstrap이 권한 화면으로 보낸다.
  // 2) 실제 좌표 — 없으면 재획득을 시도하고, 그래도 못 얻으면 진입을 막는다(좌표 없이 산책 시작 방지).
  const startWalk = async (selected: WalkRouteResponse) => {
    const walkable = await ensureWalkable();
    debugLog('startWalk', 'gate: ensureWalkable', { walkable });
    if (!walkable) return;

    let current = coords;
    if (!current) {
      current = await retryLocation();
    }
    if (!current) {
      debugLog('startWalk', 'blocked: no coords');
      Alert.alert(
        '위치를 확인할 수 없어요',
        'GPS와 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      );
      return;
    }

    walkOriginTabRef.current = route.name === 'record' ? 'record' : 'home';
    setActiveRoute(selected);
    setRouteSnapPending(true);
    go({ name: 'realWalk' });

    // 도로 스냅(Mapbox Map Matching)은 prep 화면에서 끝낸다 — realWalk엔 원본으로 즉시 진입하되
    // "산책 시작" 버튼을 스냅이 끝날 때까지 잠그고, 끝나면 경로 선을 교체한다. 실패하면 원본 유지.
    // 가드 타임아웃: 스냅이 너무 늦으면 원본으로 진행하도록 pending을 푼다.
    const guard = new Promise<WalkRouteResponse>(resolve =>
      setTimeout(() => resolve(selected), SNAP_GUARD_MS),
    );
    Promise.race([snapWalkRoute(selected), guard])
      .then(snapped => {
        if (snapped !== selected) {
          setActiveRoute(prev => (prev === selected ? snapped : prev));
        }
      })
      .finally(() => setRouteSnapPending(false));
  };

  // 안드로이드 하드웨어 뒤로가기. realWalk 단계는 WalkFlow가 직접 처리하므로 여기선 구독하지 않는다.
  const handleAndroidBack = useCallback(() => {
    // record/me 탭 → 홈 탭으로. 단 기록 탭에서 '즐겨찾기'를 보고 있으면 먼저 '최근 경로'로 되돌린다.
    if (route.name === 'record' || route.name === 'me') {
      if (route.name === 'record' && recordFilter !== 'recent') {
        setRecordFilter('recent');
        return true;
      }
      go('home');
      return true;
    }
    if (route.name === 'home') {
      // 채팅 시트가 꽉 펼쳐져 있으면 먼저 절반으로 접는다.
      if (homeScreenRef.current?.collapseSheetIfExpanded()) return true;
      // "한 번 더 누르면 종료" — 2초 내 재입력이면 앱 종료.
      const now = Date.now();
      if (now - backPressedAtRef.current < EXIT_CONFIRM_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }
      backPressedAtRef.current = now;
      ToastAndroid.show('한 번 더 누르면 종료돼요', ToastAndroid.SHORT);
      return true;
    }
    return false;
  }, [route.name, recordFilter]);
  useAndroidBackHandler(handleAndroidBack, route.name !== 'realWalk');

  const activeTab = route.name as TabName;
  const showNav = ['home', 'record', 'me'].includes(route.name);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />
      <View style={styles.appShell}>
        {/* 다른 탭으로 이동했다 돌아와도 챗봇 대화 내역이 초기화되지 않도록, 언마운트하지 않고
            숨기기만 한다(display:'none') — home 라우트가 아닐 때만 화면에서 감춘다. */}
        <View style={[styles.fill, route.name !== 'home' && styles.hidden]}>
          <HomeScreen
            ref={homeScreenRef}
            currentLocation={currentLocation}
            activeRoute={activeRoute}
            chatSessionKey={chatSessionKey}
            onRouteReady={startWalk}
            locationLoading={locationLoading}
            locationError={locationError}
            onRetryLocation={retryLocation}
            onRefreshLocation={retryLocation}
          />
        </View>
        {route.name === 'realWalk' && activeRoute ? (
          <WalkFlow
            routeResult={activeRoute}
            currentLocation={currentLocation}
            routeSnapPending={routeSnapPending}
            onExitToHome={event => {
              // 실제 산책을 시작했다면(조기종료·완주 무관) 새 prewalk 세션을 준비한다.
              // prep에서 취소한 경우(cancelled_before_start)엔 기존 대화를 유지한다.
              if (event.actualWalkingStarted) {
                resetChatSession();
                // 저장된 경로로 다시 걸었으면 기록 탭 "최근 경로" 정렬에 반영한다 —
                // 재산책은 서버에 아무 기록도 남기지 않으므로 로컬에 시각을 남긴다.
                if (activeRoute?.id != null) markRouteWalked(activeRoute.id);
              }
              setActiveRoute(null);
              setRouteSnapPending(false);
              // prep에서 취소(cancelled_before_start)한 경우엔 들어온 탭으로 되돌린다.
              // 실제로 걷고 나온 경우(완주·조기종료)엔 새 세션이므로 홈으로.
              go(
                event.reason === 'cancelled_before_start'
                  ? walkOriginTabRef.current
                  : 'home',
              );
              // 산책 중 이동한 위치로 홈 지도/다음 대화 출발지를 맞춘다.
              retryLocation();
            }}
          />
        ) : null}
        {route.name === 'record' ? (
          <RecordTab
            filter={recordFilter}
            onFilterChange={setRecordFilter}
            onSelectRoute={startWalk}
          />
        ) : null}
        {route.name === 'me' ? (
          <MyPageScreen
            onLogout={onLogout}
            nickname={nickname}
            email={email}
            onResetSurvey={onResetSurvey}
          />
        ) : null}
        {showNav ? <BottomNav active={activeTab} onChange={go} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.card,
  },
  hidden: {
    display: 'none',
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.bgSoft,
  },
  fill: {
    flex: 1,
  },
});
