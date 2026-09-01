import React, { useState, useRef, useEffect } from 'react';
import { Dimensions, Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMapView } from '../components/map/AppMapView';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { ChatBottomSheet, ChatBottomSheetHandle } from '../bottomsheets/ChatBottomSheet';
import { computeChatSheetHalfHeight } from '../bottomsheets/chatSheetGeometry';
import { ChatConversation, ChatConversationHandle } from '../components/chat/ChatConversation';
import { ChatInput } from '../components/chat/ChatInput';
import { LocationInfo, WalkRouteResponse } from '../types/prewalk';
import { colors, spacing } from '../theme/tokens';

const { height: SCREEN_H } = Dimensions.get('window');
const CHAT_INPUT_HEIGHT = 140;

interface HomeScreenProps {
  currentLocation: LocationInfo;
  activeRoute: WalkRouteResponse | null;
  chatSessionKey: number;
  onRouteReady: (route: WalkRouteResponse) => void;
}

/**
 * 하단 탭 '홈' 화면 — 지도 위에 채팅 바텀시트(prewalk 챗봇)가 떠 있는 형태. MainRouter가 탭 셸로
 * 감싸고, 다른 탭으로 이동해도 언마운트하지 않아 대화 내역이 유지된다.
 */
export function HomeScreen({
  currentLocation,
  activeRoute,
  chatSessionKey,
  onRouteReady,
}: HomeScreenProps) {
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
    keyboardHeight > 0 ? keyboardHeight + spacing.sm : BOTTOM_NAV_HEIGHT;
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
          onRouteReady={onRouteReady}
          onDoneChange={setChatDone}
          onSendingChange={setChatSending}
          onPreviewHeightChange={setPreviewHeight}
          bottomInset={chatBottomInset}
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
