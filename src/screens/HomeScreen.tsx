import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocation } from '../hooks/useLocation';
import { AppMapView } from '../components/map/AppMapView';
import { LocationInfo, WalkRouteResponse } from '../types/prewalk';
import { colors, shadows, spacing } from '../theme/tokens';
import { authStorage } from '../auth/authStorage';
import { Route, TabName, Navigate } from '../navigation/types';
import {
  ChatConversation,
  ChatConversationHandle,
} from '../components/chat/ChatConversation';
import { ChatInput } from '../components/chat/ChatInput';
import { WalkFlow } from './walk/WalkFlow';
import { RecordTab } from './record/RecordTab';
import { MyScreen } from './MyScreen';

const { height: SCREEN_H } = Dimensions.get('window');
// 바텀시트 스냅 위치 (fill 컨테이너 기준 top 좌표)
const SHEET_TOP_UP = 40; // 위: 채팅 가득 (지도 거의 가려짐)
const SHEET_TOP_DOWN_MAX = 550; // 아래 스냅의 기본(최대) 위치 — 대화가 짧을 때 기준

// translateY 기준값 (= 각 top - SHEET_TOP_UP). 0 = 맨 위, 값이 클수록 아래로 내려감
const SNAP_UP = 0;
const BOTTOM_NAV_HEIGHT = 76;
const CHAT_INPUT_HEIGHT = 140;

const navItems: { name: TabName; label: string; icon: string }[] = [
  { name: 'home', label: '홈', icon: '⌂' },
  { name: 'record', label: '기록', icon: '♧' },
  { name: 'me', label: '내 정보', icon: '♙' },
];

interface HomeScreenProps {
  onLogout?: () => void;
  userId?: string | null;
  activityPermission?: 'granted' | 'denied';
  onResetSurvey?: () => void;
}

export function HomeScreen({ onLogout, userId, onResetSurvey }: HomeScreenProps) {
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

  const go = (next: Route | TabName) => {
    if (typeof next === 'string') {
      if (next === 'home') {
        setRoute({ name: 'home' });
      } else if (next === 'record') {
        setRoute({ name: 'record' });
      } else {
        setRoute({ name: next });
      }
      return;
    }
    setRoute(next);
  };

  const activeTab = getTab(route);
  const showNav = ['home', 'record', 'me'].includes(route.name);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.card} />
      <View style={styles.appShell}>
        {route.name === 'home' || route.name === 'chat' ? (
          <HomeTab
            currentLocation={currentLocation}
            activeRoute={activeRoute}
            onRouteReady={route => {
              setActiveRoute(route);
              go({ name: 'realWalk' });
            }}
            chatOpen={route.name === 'chat'}
            go={go}
          />
        ) : null}
        {route.name === 'realWalk' && activeRoute ? (
          <WalkFlow
            routeResult={activeRoute}
            currentLocation={currentLocation}
            onExitToHome={() => {
              setActiveRoute(null);
              go('home');
            }}
          />
        ) : null}
        {route.name === 'record' ? (
          <RecordTab
            onSelectRoute={selected => {
              setActiveRoute(selected);
              go({ name: 'realWalk' });
            }}
          />
        ) : null}
        {route.name === 'me' ? (
          <MyScreen
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

function HomeTab({
  currentLocation,
  activeRoute,
  onRouteReady,
  chatOpen,
  go,
}: {
  currentLocation: LocationInfo;
  activeRoute: WalkRouteResponse | null;
  onRouteReady: (route: WalkRouteResponse) => void;
  chatOpen: boolean;
  go: Navigate;
}) {
  const chatRef = useRef<ChatConversationHandle>(null);
  const [chatDone, setChatDone] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(50);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // 화면 하단에 떠 있는 ChatInput의 위치/높이. 바텀내비게이션 바로 위에 여백 없이 붙이고,
  // 키보드가 열려있으면 그 높이만큼 더 띄운다.
  // ChatConversation에도 같은 값을 여백(bottomInset)으로 전달해 대화 목록이 가리지 않게 한다.
  const chatInputBottom = (chatOpen ? 0 : BOTTOM_NAV_HEIGHT) + keyboardHeight;
  const chatBottomInset = chatInputBottom + CHAT_INPUT_HEIGHT;

  // "아래로 완전히 접기"는 대화 길이와 무관하게 항상 같은 고정 위치.
  const downTop = SHEET_TOP_DOWN_MAX;
  // "중간"은 말풍선 미리보기(2~3개)가 ChatInput 위에 딱 맞게 다 보이는 위치로 계산한다.
  // 말풍선 묶음 단위로 측정한 값이라, 중간에 잘려 보이는 일이 없다.
  const halfTop = Math.max(
    SHEET_TOP_UP,
    Math.min(downTop, SCREEN_H - chatBottomInset - previewHeight),
  );
  const snapDown = downTop - SHEET_TOP_UP;
  const snapHalf = halfTop - SHEET_TOP_UP;

  // 바텀시트 위치 애니메이션: 0 = 맨 위, 값이 클수록 아래. 시작은 계산된 중간 스냅 위치.
  const translateY = useRef(new Animated.Value(snapHalf)).current;
  const restingY = useRef(snapHalf); // 손을 뗐을 때의 현재 스냅 위치

  const snapTo = (target: number) => {
    restingY.current = target;
    Animated.spring(translateY, {
      toValue: target,
      useNativeDriver: true,
      bounciness: 3,
      speed: 14,
    }).start();
  };

  // 키보드가 열리면 그 높이를 chatInputBottom에 반영해 입력창/시트가 가려지지 않게 하고,
  // 채팅에 집중하는 상황이니 시트도 맨 위(SNAP_UP)로 펼친다.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
      snapTo(SNAP_UP);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PanResponder의 클로저는 최초 생성 시점의 값을 캡처하므로, 매 렌더 최신값을 ref에 담아 읽는다.
  const snapDownRef = useRef(snapDown);
  const snapHalfRef = useRef(snapHalf);
  const prevSnapHalfRef = useRef(snapHalf);
  useEffect(() => {
    snapDownRef.current = snapDown;
    snapHalfRef.current = snapHalf;
    // 말풍선 실측치가 (추정값에서) 갱신되면서 half 위치가 바뀌었는데, 마침 시트가
    // 이전 half 위치에 머물러 있었다면 새 half 위치로 다시 맞춰준다.
    if (Math.abs(restingY.current - prevSnapHalfRef.current) < 1) {
      snapTo(snapHalf);
    }
    prevSnapHalfRef.current = snapHalf;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapDown, snapHalf]);

  const panResponder = useRef(
    PanResponder.create({
      // 세로로 4px 이상 움직일 때만 드래그로 인식 (탭/가로스크롤과 구분)
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        let next = restingY.current + g.dy;
        if (next < SNAP_UP) next = SNAP_UP; // 위 한계
        if (next > snapDownRef.current) next = snapDownRef.current; // 아래 한계
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        // 놓는 순간 위치에 속도를 살짝 반영해, 가장 가까운 스냅 포인트로 이동
        const projected = restingY.current + g.dy + g.vy * 100;
        const points = [SNAP_UP, snapHalfRef.current, snapDownRef.current];
        const target = points.reduce((best, p) =>
          Math.abs(projected - p) < Math.abs(projected - best) ? p : best,
        );
        snapTo(target);
      },
    }),
  ).current;

  return (
    <View style={styles.fill}>
      <View style={styles.homeMap}>
        <AppMapView
          mode="overview"
          currentLocation={currentLocation}
          previewRoute={activeRoute?.coordinates ?? undefined}
        />
      </View>

      <Animated.View
        style={[styles.homeSheet, { transform: [{ translateY }] }]}
      >
        <View style={styles.sheetGrabZone} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>
        <ChatConversation
          ref={chatRef}
          currentLocation={currentLocation}
          go={go}
          onRouteReady={onRouteReady}
          onDoneChange={setChatDone}
          onSendingChange={setChatSending}
          onPreviewHeightChange={setPreviewHeight}
          bottomInset={chatBottomInset}
          onRequestClose={() => {
            snapTo(snapDown);
            go('home');
          }}
        />
      </Animated.View>

      <View style={[styles.chatInputBar, { bottom: chatInputBottom }]}>
        <ChatInput
          onSend={text => {
            chatRef.current?.submitAnswer(text);
            // 메시지를 보내는 순간, 3단계 스와이프 중 가장 위(꽉 찬) 상태로 올려준다.
            snapTo(SNAP_UP);
          }}
          disabled={chatDone || chatSending}
        />
      </View>
    </View>
  );
}

function BottomNav({
  active,
  onChange,
}: {
  active: TabName;
  onChange: (tab: TabName) => void;
}) {
  return (
    <View style={styles.bottomNav}>
      {navItems.map(item => {
        const isActive = active === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => onChange(item.name)}
            style={styles.navItem}
          >
            <Text style={[styles.navIcon, isActive && styles.navActiveText]}>
              {item.icon}
            </Text>
            <Text style={[styles.navLabel, isActive && styles.navActiveText]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.card,
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.bgSoft,
  },
  fill: {
    flex: 1,
  },
  homeMap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
  },
  homeSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SHEET_TOP_UP,
    height: SCREEN_H, // 접혔을 때도 화면 아래를 항상 덮도록 넉넉하게
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingBottom: spacing.lg,
    ...shadows.soft,
  },
  chatInputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sheetGrabZone: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillActive: {
    backgroundColor: colors.mintDeep,
    borderColor: colors.mintDeep,
  },
  pillText: {
    color: colors.ink2,
    fontSize: 13,
    fontWeight: '800',
  },
  pillTextActive: {
    color: colors.card,
  },
  filterStrip: {
    gap: spacing.sm,
  },
  tagStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagFilter: {
    color: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  courseRow: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  courseRowBody: {
    flex: 1,
    justifyContent: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loopText: {
    fontSize: 10,
    fontWeight: '900',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  courseTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  courseSub: {
    color: colors.ink3,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  courseMeta: {
    color: colors.ink2,
    fontSize: 11,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  detailPage: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  detailMapWrap: {
    height: 280,
  },
  backCircle: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  heartCircle: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  circleIcon: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  detailSheet: {
    marginTop: -16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  detailBlurb: {
    color: colors.ink2,
    fontSize: 14,
    lineHeight: 21,
  },
  blockTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  waypointList: {
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.line2,
    gap: spacing.sm,
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waypointDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: colors.card,
    marginLeft: -21,
  },
  waypointText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  startText: {
    fontSize: 10,
    fontWeight: '900',
  },
  moodTag: {
    color: colors.ink2,
    backgroundColor: colors.bgSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 12,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  startButton: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.mintDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '900',
  },
  scheduleButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButtonText: {
    color: colors.mintDeep,
    fontSize: 14,
    fontWeight: '900',
  },
  walkPage: {
    flex: 1,
    backgroundColor: '#0a0f12',
  },
  walkTop: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  weatherDark: {
    borderRadius: 14,
    backgroundColor: 'rgba(20,28,28,0.75)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weatherDarkText: {
    color: colors.card,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  modeButton: {
    marginLeft: 'auto',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modeButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(20,28,28,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.card,
    fontSize: 24,
    fontWeight: '500',
  },
  nextTip: {
    position: 'absolute',
    top: 82,
    left: 52,
    right: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    padding: spacing.md,
    ...shadows.soft,
  },
  nextTipMeta: {
    color: colors.mintDeep,
    fontSize: 11,
    fontWeight: '900',
  },
  nextTipTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  walkPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: 'rgba(15,22,22,0.94)',
    padding: spacing.lg,
    paddingBottom: 28,
  },
  dragHandleDark: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  walkInfoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  walkInfoBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  walkMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
  },
  walkTitle: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  pointsBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  pointsBadgeText: {
    color: '#251706',
    fontSize: 11,
    fontWeight: '900',
  },
  progressLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  progressLineFill: {
    height: 6,
    borderRadius: 3,
  },
  walkStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  darkMetric: {
    flex: 1,
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  darkMetricLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
  },
  darkMetricValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  walkControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  roundDark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDarkText: {
    color: colors.card,
    fontSize: 20,
    fontWeight: '900',
  },
  pauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseText: {
    color: '#0a0f12',
    fontSize: 24,
    fontWeight: '900',
  },
  doneButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#b4463f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: colors.card,
    fontSize: 22,
    fontWeight: '900',
  },
  completedCard: {
    borderRadius: 18,
    padding: spacing.lg,
  },
  completedMeta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  completedTitle: {
    color: colors.card,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  completedStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  lightMetric: {
    flex: 1,
  },
  lightMetricLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
  },
  lightMetricValue: {
    color: colors.card,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  previewMap: {
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  starRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  star: {
    color: colors.line2,
    fontSize: 36,
  },
  starActive: {
    color: colors.gold,
  },
  reviewTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reviewTagActive: {
    borderColor: colors.mint,
    backgroundColor: colors.accentSoft,
  },
  reviewTagText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '800',
  },
  reviewTagTextActive: {
    color: colors.mintDeep,
  },
  aiLearnCard: {
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#b7eadc',
    padding: spacing.lg,
  },
  aiLearnTitle: {
    color: colors.mintDeep,
    fontSize: 13,
    fontWeight: '900',
  },
  aiLearnBody: {
    color: colors.ink2,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.mintDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '900',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_NAV_HEIGHT,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navIcon: {
    color: colors.ink3,
    fontSize: 22,
    fontWeight: '900',
  },
  navLabel: {
    color: colors.ink3,
    fontSize: 10,
    fontWeight: '800',
  },
  navActiveText: {
    color: colors.black,
  },
});
