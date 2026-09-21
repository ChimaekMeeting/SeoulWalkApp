import React, {
  forwardRef,
  useCallback,
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
} from 'react';
import {
  Keyboard,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMapView } from '../components/map/AppMapView';
import { MapOverviewControls } from '../components/map/MapOverviewControls';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { ChatBottomSheet, ChatBottomSheetHandle } from '../bottomsheets/ChatBottomSheet';
import {
  computeChatBottomLayout,
  computeChatSheetHalfHeight,
} from '../bottomsheets/chatSheetGeometry';
import {
  ChatConversation,
  ChatConversationHandle,
  ChatPhase,
} from '../components/chat/ChatConversation';
import { ChatInput } from '../components/chat/ChatInput';
import { LocationInfo, WalkRouteResponse } from '../types/prewalk';
import type { LocationErrorReason } from '../hooks/useLocation';
import type { Coordinates } from '../types/location';
import { colors, spacing } from '../theme/tokens';
import { EnvironmentInfo, getEnvironmentInfo } from '../api/weather';

const DEFAULT_CHAT_INPUT_HEIGHT = 76;

interface HomeScreenProps {
  currentLocation: LocationInfo;
  activeRoute: WalkRouteResponse | null;
  chatSessionKey: number;
  onRouteReady: (route: WalkRouteResponse) => void;
  /** 현재 위치 좌표를 아직 가져오는 중인지 (정상 로딩) */
  locationLoading: boolean;
  /** 위치 좌표 획득 실패 종류 (null이면 정상) */
  locationError: LocationErrorReason;
  /** 위치 좌표 재획득 시도 */
  onRetryLocation: () => void;
  /** 대화/메시지 요청 직전 최신 좌표 확보용 (retryLocation 그대로) */
  onRefreshLocation: () => Promise<Coordinates | null>;
  /** 값이 바뀌면 홈 지도가 현재 위치 추적을 다시 켠다(산책 종료·포그라운드 복귀 시 MainRouter가 증가). */
  mapRecenterKey: number;
}

export type HomeScreenHandle = {
  /** 채팅 시트가 완전히 펼쳐진 상태면 절반으로 접고 true를 반환(안드로이드 뒤로가기 처리용). */
  collapseSheetIfExpanded: () => boolean;
};

const SHEET_INDEX_UP = 2;

/**
 * 하단 탭 '홈' 화면 — 지도 위에 채팅 바텀시트(prewalk 챗봇)가 떠 있는 형태. MainRouter가 탭 셸로
 * 감싸고, 다른 탭으로 이동해도 언마운트하지 않아 대화 내역이 유지된다.
 */
export const HomeScreen = forwardRef<HomeScreenHandle, HomeScreenProps>(function HomeScreen(
  {
    currentLocation,
    activeRoute,
    chatSessionKey,
    onRouteReady,
    locationLoading,
    locationError,
    onRetryLocation,
    onRefreshLocation,
    mapRecenterKey,
  }: HomeScreenProps,
  ref,
) {
  const chatRef = useRef<ChatConversationHandle>(null);
  const sheetRef = useRef<ChatBottomSheetHandle>(null);
  const sheetIndexRef = useRef(1);

  useImperativeHandle(ref, () => ({
    collapseSheetIfExpanded: () => {
      if (sheetIndexRef.current >= SHEET_INDEX_UP) {
        sheetRef.current?.snapToHalf();
        return true;
      }
      return false;
    },
  }), []);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // 키보드·분할 화면·회전으로 실제 렌더 영역이 바뀔 때마다 onLayout 값이 갱신된다.
  // 첫 layout 전에는 현재 window 높이를 fallback으로 쓴다.
  const [containerHeight, setContainerHeight] = useState(0);
  const [chatInputHeight, setChatInputHeight] = useState(DEFAULT_CHAT_INPUT_HEIGHT);
  const [chatPhase, setChatPhase] = useState<ChatPhase>('idle');
  const [chatSending, setChatSending] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(50);
  const [manualRecenterKey, setManualRecenterKey] = useState(0);
  const [environmentRefreshKey, setEnvironmentRefreshKey] = useState(0);
  const [environment, setEnvironment] = useState<EnvironmentInfo | null>(null);
  const [environmentLoading, setEnvironmentLoading] = useState(false);

  // GPS의 작은 흔들림마다 공공 API를 다시 호출하지 않도록 약 100m 단위로 묶는다.
  const environmentLat = currentLocation.lat?.toFixed(3) ?? null;
  const environmentLon = currentLocation.lon?.toFixed(3) ?? null;

  useEffect(() => {
    if (environmentLat == null || environmentLon == null) {
      setEnvironment(null);
      return;
    }

    let active = true;
    setEnvironmentLoading(true);
    getEnvironmentInfo(Number(environmentLat), Number(environmentLon))
      .then(data => {
        if (active) setEnvironment(data);
      })
      .catch(() => {
        if (active) setEnvironment(null);
      })
      .finally(() => {
        if (active) setEnvironmentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [environmentLat, environmentLon, environmentRefreshKey]);

  const handleRecenter = useCallback(() => {
    onRetryLocation();
    setManualRecenterKey(key => key + 1);
    setEnvironmentRefreshKey(key => key + 1);
  }, [onRetryLocation]);

  // 대화가 아직 시작되지 않았고(위치 좌표가 필요) 위치 오류가 있으면 입력을 막는다 —
  // 이유는 ChatConversation이 안내 버블 + 액션 버튼으로 보여준다. 대화가 한 번 시작된 뒤엔
  // (threadId 확보) 좌표가 잠깐 흔들려도 후속 메시지 전송은 막지 않는다.
  const inputBlockedByLocation = !!locationError && !chatStarted;

  // chatSessionKey가 바뀌면(대화 리셋) ChatConversation은 key로 리마운트되지만, 시트 자체는
  // 리마운트 대상이 아니라서 리셋 직전 스냅 위치(꽉 펼친 상태 등)가 그대로 남는다. 리셋될 때마다
  // 시트도 기본(절반) 위치로 되돌린다. chatSessionKey는 0에서 시작해 리셋될 때만 증가하므로,
  // 0일 때(최초 마운트)는 이미 절반에서 시작하니 건너뛴다.
  useEffect(() => {
    if (chatSessionKey === 0) return;
    sheetRef.current?.snapToHalf();
  }, [chatSessionKey]);
  const availableHeight = containerHeight || windowHeight;
  // 키보드 높이는 여기서 더하지 않는다. Android adjustResize와 iOS MainRouter의
  // KeyboardAvoidingView가 이미 사용 가능한 레이아웃 높이를 줄인다. 입력창은 줄어든 영역의
  // 하단 내비게이션 바로 위에 두고, 실제 측정한 입력창 높이만 대화/시트 여백에 반영한다.
  const { chatInputBottom, chatBottomInset } = computeChatBottomLayout({
    bottomNavHeight: BOTTOM_NAV_HEIGHT,
    bottomSafeArea: insets.bottom,
    chatInputHeight,
  });

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setContainerHeight(current => (current === nextHeight ? current : nextHeight));
  }, []);

  const handleChatInputLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setChatInputHeight(current => (current === nextHeight ? current : nextHeight));
  }, []);

  // 채팅 시트가 "절반" 스냅으로 떠 있을 때 지도 하단이 가려지는 만큼, 카메라 중심을 위로 밀어서
  // 가려지지 않은 윗부분 안에서 현재 위치(GPS 점)가 보이게 한다. ChatBottomSheet의 절반 높이
  // 계산과 정확히 같은 값을 써야 해서 같은 공용 함수를 쓴다.
  const mapBottomPadding = computeChatSheetHalfHeight({
    screenHeight: availableHeight,
    bottomReservedHeight: chatBottomInset,
    previewHeight,
  });

  // 키보드 위치 계산은 OS/KAV에 맡기고, 여기서는 채팅 시트를 펼치는 동작만 담당한다.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

    const showSub = Keyboard.addListener(showEvent, () => {
      sheetRef.current?.expand();
    });

    return () => showSub.remove();
  }, []);

  return (
    <View style={styles.fill} onLayout={handleContainerLayout}>
      <View style={styles.homeMap}>
        <AppMapView
          mode="overview"
          currentLocation={currentLocation}
          previewRoute={activeRoute?.coordinates ?? undefined}
          bottomPadding={mapBottomPadding}
          recenterKey={mapRecenterKey + manualRecenterKey}
        />
        <MapOverviewControls
          environment={environment}
          loading={environmentLoading}
          onRecenter={handleRecenter}
        />
      </View>

      <ChatBottomSheet
        ref={sheetRef}
        containerHeight={availableHeight}
        previewHeight={previewHeight}
        bottomReservedHeight={chatBottomInset}
        onChangeIndex={index => {
          sheetIndexRef.current = index;
        }}
      >
        <ChatConversation
          key={chatSessionKey}
          ref={chatRef}
          currentLocation={currentLocation}
          onRouteReady={onRouteReady}
          onPhaseChange={setChatPhase}
          onSendingChange={setChatSending}
          onStartedChange={setChatStarted}
          onPreviewHeightChange={setPreviewHeight}
          bottomInset={chatBottomInset}
          locationLoading={locationLoading}
          locationError={locationError}
          onRetryLocation={onRetryLocation}
          onRefreshLocation={onRefreshLocation}
        />
      </ChatBottomSheet>

      <View
        style={[styles.chatInputBar, { bottom: chatInputBottom }]}
        onLayout={handleChatInputLayout}
      >
        <ChatInput
          onSend={text => {
            chatRef.current?.submitAnswer(text);
            // 메시지를 보내는 순간, 3단계 스와이프 중 가장 위(꽉 찬) 상태로 올려준다.
            sheetRef.current?.expand();
          }}
          disabled={
            chatSending ||
            inputBlockedByLocation ||
            chatPhase === 'session_expired'
          }
          placeholder={
            inputBlockedByLocation
              ? '위치 확인 후 대화를 시작할 수 있어요'
              : undefined
          }
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
});
