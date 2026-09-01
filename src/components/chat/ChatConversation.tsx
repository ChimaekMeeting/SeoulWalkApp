import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { getInitMessage, getMessage } from '../../api/prewalk';
import {
  ChatResponse,
  ChatStatus,
  LocationInfo,
  WalkRouteResponse,
} from '../../types/prewalk';
import type { LocationErrorReason } from '../../hooks/useLocation';
import { ChatBubble } from './ChatBubble';
import { MyBubble } from './MyBubble';
import { LoadingBubble } from './LoadingBubble';
import { RouteCandidate } from './RouteCandidate';
import { spacing, colors } from '../../theme/tokens';

export type ChatConversationHandle = {
  submitAnswer: (answer: string) => void;
};

type Message = { from: 'bot' | 'me'; text: string };

const STATUS_MESSAGES: Partial<Record<ChatStatus, string>> = {
  [ChatStatus.ACCESS_EXPIRED_TOKEN]: '로그인이 만료되었어요. 다시 로그인해주세요.',
  [ChatStatus.INVALID_TOKEN]: '인증 정보가 올바르지 않아요. 다시 로그인해주세요.',
  [ChatStatus.SESSION_NOT_FOUND]: '대화 세션을 찾을 수 없어요. 다시 시작해주세요.',
  [ChatStatus.UNACCESSIBLE]: '지금은 서비스를 이용할 수 없어요.',
  [ChatStatus.INTERNAL_ERROR]: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
};

type Props = {
  currentLocation: LocationInfo;
  onRouteReady: (route: WalkRouteResponse) => void;
  onDoneChange: (done: boolean) => void; // 질문이 모두 끝났는지를 외부(입력창)에 알림
  onSendingChange: (sending: boolean) => void; // 챗봇 응답을 기다리는 중인지를 외부(입력창)에 알림
  onStartedChange?: (started: boolean) => void; // 대화가 시작됐는지(threadId 확보)를 외부에 알림
  /** 현재 위치 좌표를 아직 가져오는 중인지(정상 로딩). 위치 오류(locationError)와 구분된다. */
  locationLoading?: boolean;
  /** 위치 좌표 획득 실패 종류. null이면 정상. */
  locationError?: LocationErrorReason;
  /** 위치 좌표 재획득 시도(일시적 실패 시 "다시 시도" 버튼에서 호출) */
  onRetryLocation?: () => void;
  bottomInset: number; // 바텀시트 바깥에 떠 있는 ChatInput에 가려지지 않도록 남겨둘 여백
  // 헤더 + 첫 봇 메시지의 실측 높이를 부모(중간 스냅 계산)에 전달.
  // 대화가 길어져도 이 미리보기 묶음 자체의 크기는 바뀌지 않아, 중간 스냅이 항상 같은
  // 위치(말풍선이 잘리지 않는 위치)를 가리키게 된다.
  onPreviewHeightChange: (height: number) => void;
};

// 홈 바텀시트 안에 들어가는 채팅 대화 패널 (오버레이/배경 없이 시트가 컨테이너 역할)
// 입력창(ChatInput)은 바텀시트 바깥에 떠 있는 별도 요소라 submitAnswer를 ref로 노출해 연결한다.
// prewalk 챗봇 API(getInitMessage/getMessage)와 직접 통신하며, 대화가 끝나면(state.is_complete)
// 백엔드가 계산한 실제 경로(state.route_result)를 onRouteReady로 상위에 전달한다.
export const ChatConversation = forwardRef(function ChatConversation(
  {
    currentLocation,
    onRouteReady,
    onDoneChange,
    onSendingChange,
    onStartedChange,
    locationLoading,
    locationError,
    onRetryLocation,
    bottomInset,
    onPreviewHeightChange,
  }: Props,
  ref: React.Ref<ChatConversationHandle>,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [routeResults, setRouteResults] = useState<WalkRouteResponse[] | null>(
    null,
  );
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  // getInitMessage 실패 시 true — hasStartedRef가 재시도를 막아버리지 않도록 별도로 추적한다.
  const [initFailed, setInitFailed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [previewGroupHeight, setPreviewGroupHeight] = useState(0);
  const scrollRef = useRef<React.ElementRef<typeof BottomSheetScrollView>>(null);
  const hasStartedRef = useRef(false);

  const applyResponse = (res: ChatResponse, options?: { reset?: boolean }) => {
    if (res.thread_id) setThreadId(res.thread_id);

    if (res.status !== ChatStatus.SUCCESS) {
      const text =
        STATUS_MESSAGES[res.status] ?? STATUS_MESSAGES[ChatStatus.INTERNAL_ERROR]!;
      setMessages(prev => (options?.reset ? [] : prev).concat({ from: 'bot', text }));
      return;
    }

    // 경로가 완성된 응답은 ChatBubble로 따로 보여주지 않는다 — 로딩 표시가 그 자리에서
    // 바로 RouteCandidate로 바뀌어 보이도록 한다.
    const routeReady = !!(
      res.state?.is_complete &&
      res.state?.route_result &&
      res.state.route_result.length > 0
    );
    const botText = res.state?.response;
    setMessages(prev => {
      const base = options?.reset ? [] : prev;
      return botText && !routeReady ? base.concat({ from: 'bot', text: botText }) : base;
    });
    setRouteResults(res.state?.route_result ?? null);
    setDone(res.state?.is_complete ?? false);
  };

  const startConversation = async () => {
    if (currentLocation.lat == null || currentLocation.lon == null) return;
    setSending(true);
    setInitFailed(false);
    try {
      const res = await getInitMessage({
        lat: currentLocation.lat,
        lon: currentLocation.lon,
      });
      applyResponse(res, { reset: true });
    } catch (err) {
      // TODO: 테스트 끝나면 아래 로그 제거
      console.error(
        '[ChatConversation] getInitMessage failed:',
        (err as any)?.response?.status,
        (err as any)?.response?.data ?? err,
      );
      // hasStartedRef를 다시 풀어줘야 재시도 버튼을 누르지 않고도(예: 위치가 뒤늦게 잡혀서
      // effect가 재실행되는 경우) 다음 시도가 막히지 않는다.
      hasStartedRef.current = false;
      setInitFailed(true);
      setMessages([
        { from: 'bot', text: '대화를 시작하지 못했어요. 다시 시도해주세요.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (done || sending) return;
    // 대화가 아직 시작되지 않았으면(threadId 없음) 조용히 무시하지 않고, 왜 못 보냈는지 알려준다.
    if (!threadId) {
      setMessages(prev => [
        ...prev,
        { from: 'me', text: answer },
        {
          from: 'bot',
          text: locationError
            ? '현재 위치를 확인하지 못해 아직 대화를 시작하지 못했어요. 위 안내를 확인해 주세요.'
            : initFailed
            ? '대화 시작에 실패했어요. 위 "다시 시도"를 눌러 주세요.'
            : '위치 정보를 확인하고 있어요. 잠시 후 다시 시도해 주세요.',
        },
      ]);
      return;
    }
    setMessages(prev => [...prev, { from: 'me', text: answer }]);
    setSending(true);
    try {
      const res = await getMessage({ thread_id: threadId, user_prompt: answer });
      applyResponse(res);
    } catch (err) {
      // TODO: 테스트 끝나면 아래 로그 제거
      console.error(
        '[ChatConversation] getMessage failed:',
        (err as any)?.response?.status,
        (err as any)?.response?.data ?? err,
      );
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '메시지를 보내지 못했어요. 다시 시도해주세요.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (hasStartedRef.current) return;
    if (currentLocation.lat == null || currentLocation.lon == null) return;
    hasStartedRef.current = true;
    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation.lat, currentLocation.lon]);

  useEffect(() => {
    onDoneChange(done);
  }, [done, onDoneChange]);

  useEffect(() => {
    onSendingChange(sending);
  }, [sending, onSendingChange]);

  useEffect(() => {
    onStartedChange?.(threadId != null);
  }, [threadId, onStartedChange]);

  useEffect(() => {
    // previewGroupHeight는 스크롤 여백(padding)을 뺀 순수 콘텐츠 높이라,
    // 위쪽 padding(spacing.lg)만 더하면 "미리보기 영역이 실제로 차지하는 높이"가 된다.
    onPreviewHeightChange(headerHeight + previewGroupHeight + spacing.lg);
  }, [headerHeight, previewGroupHeight, onPreviewHeightChange]);

  useImperativeHandle(ref, () => ({
    submitAnswer: (answer: string) => {
      submitAnswer(answer);
    },
  }));

  // 대화 시작 전 위치 좌표를 "정상적으로 기다리는 중"일 때만 로딩 버블을 보여준다.
  // 좌표 획득 실패(locationError)는 아래 locationNotice가 대신 안내한다.
  const awaitingLocation =
    !threadId &&
    messages.length === 0 &&
    !sending &&
    !locationError &&
    (locationLoading ?? true);

  // 대화 시작 전(threadId 없음) 위치 좌표를 못 얻은 경우의 안내 + 행동 버튼.
  // 대화가 시작된 뒤엔 후속 메시지에 좌표가 필요 없으므로 노출하지 않는다.
  const locationNotice: { text: string; actionLabel: string; onPress: () => void } | null =
    threadId || !locationError
      ? null
      : locationError === 'permission_denied'
      ? {
          text: '위치 권한이 꺼져 있어 경로를 만들 수 없어요.\n설정에서 위치 권한을 켜 주세요.',
          actionLabel: '설정 열기',
          onPress: () => Linking.openSettings(),
        }
      : {
          text: '현재 위치를 확인할 수 없어 경로를 만들 수 없어요.\nGPS와 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
          actionLabel: '다시 시도',
          onPress: () => onRetryLocation?.(),
        };

  return (
    <View style={styles.chatPanel}>
      <View
        style={styles.chatHeader}
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <Text style={styles.chatHeaderTitle}>Roudi</Text>
      </View>
      <BottomSheetScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={[
          styles.chatContent,
          { paddingBottom: bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        // 말풍선이 추가/삭제되어 콘텐츠 높이가 바뀔 때마다(=맨 아래 높이가 바뀔 때마다)
        // 그 높이를 기준으로 맨 아래로 자동 스크롤한다.
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        <View style={styles.bubbleStack}>
          {locationNotice ? (
            <View style={styles.locationNotice}>
              <ChatBubble text={locationNotice.text} />
              <Pressable
                onPress={locationNotice.onPress}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                ]}
              >
                <Text style={styles.retryButtonText}>{locationNotice.actionLabel}</Text>
              </Pressable>
            </View>
          ) : awaitingLocation ? (
            <ChatBubble text="위치 정보를 확인하는 중이에요…" />
          ) : null}
          {messages.map((message, index) => {
            const bubble =
              message.from === 'bot' ? (
                <ChatBubble text={message.text} />
              ) : (
                <MyBubble text={message.text} />
              );
            // 첫 봇 메시지만 실측해 중간 스냅 높이 계산에 사용한다.
            if (index === 0) {
              return (
                <View
                  key={index}
                  style={styles.previewGroup}
                  onLayout={e =>
                    setPreviewGroupHeight(e.nativeEvent.layout.height)
                  }
                >
                  {bubble}
                </View>
              );
            }
            return <View key={index}>{bubble}</View>;
          })}
          {sending ? (
            <LoadingBubble
              text={
                !threadId
                  ? '오늘 날씨를 살펴보고 있어요.'
                  : '좋은 답변을 생각 중입니다.'
              }
            />
          ) : null}
          {routeResults && routeResults.length > 0 ? (
            <View style={styles.chatLine}>
              <View style={styles.chatIcon}>
                <Text style={styles.chatIconText}>✳</Text>
              </View>
              <View style={styles.cardColumn}>
                {routeResults.map((route, index) => (
                  <RouteCandidate
                    key={route.id ?? index}
                    route={route}
                    index={index}
                    onPress={() => onRouteReady(route)}
                  />
                ))}
              </View>
            </View>
          ) : null}
          {initFailed && !sending ? (
            <Pressable
              onPress={() => startConversation()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </Pressable>
          ) : null}
        </View>
      </BottomSheetScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  chatPanel: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: '#FFFFFF'
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
  },
  chatScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatContent: {
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  bubbleStack: {
    width: '100%',
    gap: spacing.md,
  },
  previewGroup: {
    gap: spacing.md,
  },
  locationNotice: {
    gap: spacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.mintDeep,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonPressed: {
    opacity: 0.6,
  },
  retryButtonText: {
    color: colors.mintDeep,
    fontSize: 13,
    fontWeight: '800',
  },
  chatLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  chatIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  cardColumn: {
    flexShrink: 1,
    width: '82%',
    gap: spacing.sm,
  },
});
