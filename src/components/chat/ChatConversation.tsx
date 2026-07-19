import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { getInitMessage, getMessage } from '../../api/prewalk';
import {
  ChatResponse,
  ChatStatus,
  LocationInfo,
  WalkRouteResponse,
} from '../../types/prewalk';
import { PersonaId, personas } from '../../data/chimeakData';
import { Navigate } from '../../navigation/types';
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
  persona: PersonaId;
  currentLocation: LocationInfo;
  onRouteReady: (route: WalkRouteResponse) => void;
  go: Navigate;
  onRequestClose: () => void; // ✕ 또는 코스 선택 시 시트를 접는 콜백
  onDoneChange: (done: boolean) => void; // 질문이 모두 끝났는지를 외부(입력창)에 알림
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
    persona,
    currentLocation,
    onRouteReady,
    go,
    onRequestClose,
    onDoneChange,
    bottomInset,
    onPreviewHeightChange,
  }: Props,
  ref: React.Ref<ChatConversationHandle>,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<WalkRouteResponse | null>(
    null,
  );
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [previewGroupHeight, setPreviewGroupHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const hasStartedRef = useRef(false);

  const applyResponse = (res: ChatResponse, options?: { reset?: boolean }) => {
    if (res.thread_id) setThreadId(res.thread_id);

    if (res.status !== ChatStatus.SUCCESS) {
      const text =
        STATUS_MESSAGES[res.status] ?? STATUS_MESSAGES[ChatStatus.INTERNAL_ERROR]!;
      setMessages(prev => (options?.reset ? [] : prev).concat({ from: 'bot', text }));
      setAwaitingConfirmation(false);
      return;
    }

    // 경로가 완성된 응답은 ChatBubble로 따로 보여주지 않는다 — 로딩 표시가 그 자리에서
    // 바로 RouteCandidate로 바뀌어 보이도록 한다.
    const routeReady = !!(res.state?.is_complete && res.state?.route_result);
    const botText = res.state?.response;
    setMessages(prev => {
      const base = options?.reset ? [] : prev;
      return botText && !routeReady ? base.concat({ from: 'bot', text: botText }) : base;
    });
    setRouteResult(res.state?.route_result ?? null);
    setDone(res.state?.is_complete ?? false);
    setAwaitingConfirmation(res.state?.awaiting_confirmation ?? false);
  };

  const startConversation = async () => {
    if (currentLocation.lat == null || currentLocation.lon == null) return;
    setSending(true);
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
      setMessages([
        { from: 'bot', text: '대화를 시작하지 못했어요. 다시 시도해주세요.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (done || sending || !threadId) return;
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
    // previewGroupHeight는 스크롤 여백(padding)을 뺀 순수 콘텐츠 높이라,
    // 위쪽 padding(spacing.lg)만 더하면 "미리보기 영역이 실제로 차지하는 높이"가 된다.
    onPreviewHeightChange(headerHeight + previewGroupHeight + spacing.lg);
  }, [headerHeight, previewGroupHeight, onPreviewHeightChange]);

  useImperativeHandle(ref, () => ({
    submitAnswer: (answer: string) => {
      submitAnswer(answer);
    },
  }));

  const awaitingLocation = !threadId && messages.length === 0 && !sending;

  return (
    <View style={styles.chatPanel}>
      <View
        style={styles.chatHeader}
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <Text style={styles.chatHeaderTitle}>
          Roudi ({personas[persona].label})
        </Text>
      </View>
      <ScrollView
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
          {awaitingLocation ? (
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
                  : awaitingConfirmation
                    ? '경로를 생성 중입니다. 조금만 기다려주세요.'
                    : '좋은 답변을 생각 중입니다.'
              }
            />
          ) : null}
          {done && routeResult ? (
            <View>
              <RouteCandidate
                route={routeResult}
                onPress={() => onRouteReady(routeResult)}
              />
              <View style={styles.chatButtons}>
                <Pressable
                  onPress={() => startConversation()}
                  style={styles.ghostButtonSmall}
                >
                  <Text style={styles.ghostButtonText}>다시 묻기</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
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
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: spacing.lg,
  },
  bubbleStack: {
    width: '100%',
    gap: spacing.md,
  },
  previewGroup: {
    gap: spacing.md,
  },
  chatButtons: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonSmall: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.mintDeep,
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  ghostButtonSmall: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  ghostButtonText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '900',
  },
});
