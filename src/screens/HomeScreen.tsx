import React, { useState, useRef, useEffect } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocation } from '../hooks/useLocation';
import { useAppStateChange } from '../hooks/useAppStateChange';
import { AppMapView } from '../components/map/AppMapView';
import { ChatBottomSheet, ChatBottomSheetHandle } from '../bottomsheets/ChatBottomSheet';
import { computeChatSheetHalfHeight } from '../bottomsheets/chatSheetGeometry';
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
const BOTTOM_NAV_HEIGHT = 76;
const CHAT_INPUT_HEIGHT = 140;

// 챗봇 세션(대화 내역)을 자동으로 리셋하는 두 가지 기준.
const WALK_RESET_THRESHOLD_MS = 10 * 60 * 1000; // 산책 시작 후 10분 넘게 지나서 홈으로 돌아오면
const INACTIVITY_RESET_THRESHOLD_MS = 30 * 60 * 1000; // 앱이 30분 넘게 백그라운드/비활성 상태였다가 돌아오면

const navItems: { name: TabName; label: string; icon: string }[] = [
  { name: 'home', label: '홈', icon: '⌂' },
  { name: 'record', label: '기록', icon: '♧' },
  { name: 'me', label: '마이페이지', icon: '♙' },
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
        {/* 다른 탭으로 이동했다 돌아와도 챗봇 대화 내역이 초기화되지 않도록, 언마운트하지 않고
            숨기기만 한다(display:'none') — home/chat 라우트가 아닐 때만 화면에서 감춘다. */}
        <View
          style={[
            styles.fill,
            route.name !== 'home' && route.name !== 'chat' && styles.hidden,
          ]}
        >
          <HomeTab
            currentLocation={currentLocation}
            activeRoute={activeRoute}
            chatSessionKey={chatSessionKey}
            onRouteReady={route => {
              setActiveRoute(route);
              realWalkEnteredAtRef.current = Date.now();
              go({ name: 'realWalk' });
            }}
            chatOpen={route.name === 'chat'}
            go={go}
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
  chatSessionKey,
  onRouteReady,
  chatOpen,
  go,
}: {
  currentLocation: LocationInfo;
  activeRoute: WalkRouteResponse | null;
  chatSessionKey: number;
  onRouteReady: (route: WalkRouteResponse) => void;
  chatOpen: boolean;
  go: Navigate;
}) {
  const chatRef = useRef<ChatConversationHandle>(null);
  const sheetRef = useRef<ChatBottomSheetHandle>(null);
  const insets = useSafeAreaInsets();
  const [chatDone, setChatDone] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(50);

  // chatSessionKey가 바뀌면(대화 리셋) ChatConversation은 key로 리마운트되지만, 시트 자체는
  // 리마운트 대상이 아니라서 리셋 직전 스냅 위치(꽉 펼친 상태 등)가 그대로 남는다. 리셋될 때마다
  // 시트도 기본(절반) 위치로 되돌린다. chatSessionKey는 0에서 시작해 리셋될 때만 증가하므로,
  // 0일 때(최초 마운트)는 이미 절반에서 시작하니 건너뛴다.
  useEffect(() => {
    if (chatSessionKey === 0) return;
    sheetRef.current?.snapToHalf();
  }, [chatSessionKey]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // 화면 하단에 떠 있는 ChatInput의 위치/높이. 바텀내비게이션 바로 위에 여백 없이 붙이고,
  // 키보드가 열려있으면 키보드 바로 위에 딱 붙인다 — 이때는 바텀내비게이션 자리(BOTTOM_NAV_HEIGHT)를
  // 더 안 띄운다. 키보드가 이미 그 영역을 덮고 있어서, 같이 더하면 키보드와 입력창 사이에
  // 불필요한 빈 간격이 생긴다. 키보드가 닫혀있을 땐 폰 자체 제스처 바에 안 가리도록 하단
  // 안전영역(insets.bottom)만큼 띄운다 — 키보드가 열려있을 땐 키보드가 이미 그 영역을 덮으므로 안 더한다.
  // position:'absolute'인 바라 KeyboardAvoidingView가 제대로 안 먹어서(바텀 오프셋이 안 밀림) 직접 계산한다.
  // ChatConversation에도 같은 값을 여백(bottomInset)으로 전달해 대화 목록이 가리지 않게 한다.
  //
  // 안드로이드에서 keyboardDidShow의 endCoordinates.height는 하단 안전영역(제스처 바)만큼
  // 덜 측정된다(실측: height=254.9, insets.bottom=47.27일 때 실제 키보드 상단까지 거리는
  // height+insets.bottom=302.18). 그래서 keyboardHeight에도 insets.bottom을 더해줘야
  // 입력창이 키보드 속으로 파고들지 않는다. 여기에 더해 안드로이드가 텍스트 입력창 위에
  // 띄우는 복사/붙여넣기 팝업 같은 시스템 오버레이와 안 겹치도록 약간의 여백(spacing.sm)도 둔다.
  const chatInputBase =
    keyboardHeight > 0 ? keyboardHeight + spacing.sm : chatOpen ? 0 : BOTTOM_NAV_HEIGHT;
  const chatInputBottom = chatInputBase + insets.bottom;
  const chatBottomInset = chatInputBottom + CHAT_INPUT_HEIGHT;

  // 채팅 시트가 "절반" 스냅으로 떠 있을 때 지도 하단이 가려지는 만큼, 카메라 중심을 위로 밀어서
  // 가려지지 않은 윗부분 안에서 현재 위치(GPS 점)가 보이게 한다. ChatBottomSheet의 절반 높이
  // 계산과 정확히 같은 값을 써야 해서 같은 공용 함수를 쓴다.
  const mapBottomPadding = computeChatSheetHalfHeight({
    screenHeight: SCREEN_H,
    bottomReservedHeight: chatBottomInset,
    previewHeight,
  });

  // 키보드가 열리면 그 높이를 chatInputBottom에 반영해 입력창이 가려지지 않게 하고,
  // 채팅에 집중하는 상황이니 시트도 맨 위로 펼친다.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
      sheetRef.current?.expand();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View style={styles.fill}>
      <View style={styles.homeMap}>
        <AppMapView
          mode="overview"
          currentLocation={currentLocation}
          previewRoute={activeRoute?.coordinates ?? undefined}
          bottomPadding={mapBottomPadding}
        />
      </View>

      <ChatBottomSheet
        ref={sheetRef}
        previewHeight={previewHeight}
        bottomReservedHeight={chatBottomInset}
      >
        <ChatConversation
          key={chatSessionKey}
          ref={chatRef}
          currentLocation={currentLocation}
          go={go}
          onRouteReady={onRouteReady}
          onDoneChange={setChatDone}
          onSendingChange={setChatSending}
          onPreviewHeightChange={setPreviewHeight}
          bottomInset={chatBottomInset}
          onRequestClose={() => {
            sheetRef.current?.collapse();
            go('home');
          }}
        />
      </ChatBottomSheet>

      <View style={[styles.chatInputBar, { bottom: chatInputBottom }]}>
        <ChatInput
          onSend={text => {
            chatRef.current?.submitAnswer(text);
            // 메시지를 보내는 순간, 3단계 스와이프 중 가장 위(꽉 찬) 상태로 올려준다.
            sheetRef.current?.expand();
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
  // 폰 자체 뒤로가기/홈 제스처 바 영역에 탭바가 가려지지 않도록 하단 안전영역만큼 더 띄운다.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bottomNav,
        { height: BOTTOM_NAV_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
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
  homeMap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
  },
  chatInputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
