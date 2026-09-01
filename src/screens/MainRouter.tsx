import React, { useState, useRef, useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocation } from '../hooks/useLocation';
import { useAppStateChange } from '../hooks/useAppStateChange';
import { LocationInfo, WalkRouteResponse } from '../types/prewalk';
import { colors } from '../theme/tokens';
import { authStorage } from '../auth/authStorage';
import { Route, TabName } from '../navigation/types';
import { BottomNav } from '../components/BottomNav';
import { HomeScreen } from './HomeScreen';
import { WalkFlow } from './walk/WalkFlow';
import { RecordTab } from './record/RecordTab';
import { MyPageScreen } from './MyPageScreen';

// 챗봇 세션(대화 내역)을 자동으로 리셋하는 두 가지 기준.
const WALK_RESET_THRESHOLD_MS = 10 * 60 * 1000; // 산책 시작 후 10분 넘게 지나서 홈으로 돌아오면
const INACTIVITY_RESET_THRESHOLD_MS = 30 * 60 * 1000; // 앱이 30분 넘게 백그라운드/비활성 상태였다가 돌아오면

const TAB_ROUTES: Record<TabName, Route> = {
  home: { name: 'home' },
  record: { name: 'record' },
  me: { name: 'me' },
};

interface MainRouterProps {
  onLogout?: () => void;
  userId?: string | null;
  onResetSurvey?: () => void;
}

/**
 * 로그인 이후의 앱 셸. `Route` 타입 + 로컬 useState만으로 하단 탭(home/record/me)과 산책
 * 플로우(realWalk)를 전환한다 — 화면 스택에 남길 필요 없는 잦은 전환이라 react-navigation을
 * 쓰지 않는 게 의도된 설계다. App.tsx의 Stack 라우트 이름은 여전히 'Home'.
 */
export function MainRouter({ onLogout, userId, onResetSurvey }: MainRouterProps) {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [nickname, setNickname] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([authStorage.getNickname(), authStorage.getEmail()]).then(
      ([n, e]) => {
        setNickname(n);
        setEmail(e);
      },
    );
  }, [userId]);
  const { coords } = useLocation();
  const currentLocation: LocationInfo = {
    lat: coords?.latitude ?? null,
    lon: coords?.longitude ?? null,
    address: null,
    place_name: null,
  };
  const [activeRoute, setActiveRoute] = useState<WalkRouteResponse | null>(
    null,
  );

  // key가 바뀌면 ChatConversation이 통째로 리마운트되면서 대화 내역(메시지/threadId)이
  // 초기화된다. ChatConversation 내부(팀원 코드)를 직접 건드리지 않는 안전한 리셋 방법.
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const resetChatSession = () => setChatSessionKey(key => key + 1);
  const realWalkEnteredAtRef = useRef<number | null>(null);

  // 앱이 30분 넘게 백그라운드/비활성 상태였다가 다시 돌아오면 대화를 리셋한다.
  const backgroundedAtRef = useRef<number | null>(null);
  useAppStateChange({
    onBackground: () => {
      backgroundedAtRef.current = Date.now();
    },
    onForeground: () => {
      if (
        backgroundedAtRef.current != null &&
        Date.now() - backgroundedAtRef.current >= INACTIVITY_RESET_THRESHOLD_MS
      ) {
        resetChatSession();
      }
      backgroundedAtRef.current = null;
    },
  });

  const go = (next: Route | TabName) => {
    setRoute(typeof next === 'string' ? TAB_ROUTES[next] : next);
  };

  const activeTab = getTab(route);
  const showNav = ['home', 'record', 'me'].includes(route.name);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />
      <View style={styles.appShell}>
        {/* 다른 탭으로 이동했다 돌아와도 챗봇 대화 내역이 초기화되지 않도록, 언마운트하지 않고
            숨기기만 한다(display:'none') — home/chat 라우트가 아닐 때만 화면에서 감춘다. */}
        <View
          style={[
            styles.fill,
            route.name !== 'home' && route.name !== 'chat' && styles.hidden,
          ]}
        >
          <HomeScreen
            currentLocation={currentLocation}
            activeRoute={activeRoute}
            chatSessionKey={chatSessionKey}
            onRouteReady={walkRoute => {
              setActiveRoute(walkRoute);
              realWalkEnteredAtRef.current = Date.now();
              go({ name: 'realWalk' });
            }}
            chatOpen={route.name === 'chat'}
          />
        </View>
        {route.name === 'realWalk' && activeRoute ? (
          <WalkFlow
            routeResult={activeRoute}
            currentLocation={currentLocation}
            onExitToHome={() => {
              const enteredAt = realWalkEnteredAtRef.current;
              if (enteredAt != null && Date.now() - enteredAt >= WALK_RESET_THRESHOLD_MS) {
                resetChatSession();
              }
              realWalkEnteredAtRef.current = null;
              setActiveRoute(null);
              go('home');
            }}
          />
        ) : null}
        {route.name === 'record' ? (
          <RecordTab
            onSelectRoute={selected => {
              setActiveRoute(selected);
              realWalkEnteredAtRef.current = Date.now();
              go({ name: 'realWalk' });
            }}
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

function getTab(route: Route): TabName {
  if (route.name === 'postwalk') {
    return 'record';
  }
  return route.name as TabName;
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
