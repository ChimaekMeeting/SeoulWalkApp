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
import type { Coordinates } from '../../types/location';
import { ChatBubble } from './ChatBubble';
import { MyBubble } from './MyBubble';
import { LoadingBubble } from './LoadingBubble';
import { RouteCandidate } from './RouteCandidate';
import { spacing, colors } from '../../theme/tokens';

export type ChatConversationHandle = {
  submitAnswer: (answer: string) => void;
};

/**
 * 대화 단계. `state.is_complete`(경로 계산 완료)와 "대화 종료·입력 차단"을 분리하기 위한 것.
 *  - idle             : threadId 확보 전(첫 init 대기/실패)
 *  - chatting         : 대화 진행 중, 아직 추천된 경로 없음
 *  - route_recommended: 경로가 추천됨 — 카드 수락뿐 아니라 조건 변경·재추천 입력도 가능
 *  - session_expired  : 세션이 만료/유실됨 — "새 대화 시작"으로만 복구
 */
export type ChatPhase = 'idle' | 'chatting' | 'route_recommended' | 'session_expired';

// 'routes'는 추천 경로 카드 묶음을 타임라인상의 한 항목으로 취급하기 위한 것.
// 재추천마다 새 항목을 이어붙이므로(교체가 아님) 이전 추천 카드도 그대로 남아 선택할 수 있고,
// 이후 채팅은 자연스럽게 그 카드 밑으로 쌓인다.
type Message =
  | { from: 'bot' | 'me'; text: string }
  | { from: 'routes'; routes: WalkRouteResponse[] };

const STATUS_MESSAGES: Partial<Record<ChatStatus, string>> = {
  [ChatStatus.ACCESS_EXPIRED_TOKEN]: '로그인이 만료되었어요. 다시 로그인해주세요.',
  [ChatStatus.INVALID_TOKEN]: '인증 정보가 올바르지 않아요. 다시 로그인해주세요.',
  [ChatStatus.SESSION_NOT_FOUND]: '대화 세션을 찾을 수 없어요. 다시 시작해주세요.',
  [ChatStatus.UNACCESSIBLE]: '지금은 서비스를 이용할 수 없어요.',
  [ChatStatus.INTERNAL_ERROR]: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
};

// 이 상태들이 오면 현재 threadId는 더 이상 못 쓴다 — 새 세션을 만들어야 복구된다.
const SESSION_EXPIRED_STATUSES: ReadonlySet<ChatStatus> = new Set([
  ChatStatus.SESSION_NOT_FOUND,
  ChatStatus.INVALID_TOKEN,
  ChatStatus.ACCESS_EXPIRED_TOKEN,
]);

type Props = {
  currentLocation: LocationInfo;
  onRouteReady: (route: WalkRouteResponse) => void;
  onPhaseChange: (phase: ChatPhase) => void; // 대화 단계 변화를 외부(입력창)에 알림
  onSendingChange: (sending: boolean) => void; // 챗봇 응답을 기다리는 중인지를 외부(입력창)에 알림
  onStartedChange?: (started: boolean) => void; // 대화가 시작됐는지(threadId 확보)를 외부에 알림
  /** 현재 위치 좌표를 아직 가져오는 중인지(정상 로딩). 위치 오류(locationError)와 구분된다. */
  locationLoading?: boolean;
  /** 위치 좌표 획득 실패 종류. null이면 정상. */
  locationError?: LocationErrorReason;
  /** 위치 좌표 재획득 시도(일시적 실패 시 "다시 시도" 버튼에서 호출) */
  onRetryLocation?: () => void;
  /**
   * 요청(init/getMessage) 직전에 호출해 최신 현재 위치를 받아온다. 대화 도중 사용자가 이동했을 때도
   * 그 위치 기준으로 경로가 계산되도록 매 요청에 최신 좌표를 실어 보내기 위함. 실패 시 null을 돌려주며,
   * 그 경우 currentLocation(prop)으로 폴백한다.
   */
  onRefreshLocation?: () => Promise<Coordinates | null>;
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
    onPhaseChange,
    onSendingChange,
    onStartedChange,
    locationLoading,
    locationError,
    onRetryLocation,
    onRefreshLocation,
    bottomInset,
    onPreviewHeightChange,
  }: Props,
  ref: React.Ref<ChatConversationHandle>,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [sending, setSending] = useState(false);
  // getInitMessage 실패 시 true — hasStartedRef가 재시도를 막아버리지 않도록 별도로 추적한다.
  const [initFailed, setInitFailed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [previewGroupHeight, setPreviewGroupHeight] = useState(0);
  const scrollRef = useRef<React.ElementRef<typeof BottomSheetScrollView>>(null);
  const hasStartedRef = useRef(false);
  // 비동기 응답이 리셋된 대화/바뀐 세션에 섞이지 않도록: 요청마다 세대 번호를 올리고,
  // 응답이 돌아왔을 때 여전히 최신 요청·같은 thread인지 검증한다.
  const requestIdRef = useRef(0);
  const threadIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 세션 만료로 유실된 직전 사용자 발화. "새 대화 시작" 시 새 세션에서 재처리한다.
  const pendingPromptRef = useRef<string | null>(null);

  const isAbortError = (err: unknown) =>
    (err as { name?: string })?.name === 'AbortError' ||
    (err as { code?: string })?.code === 'ERR_CANCELED';

  // 요청 직전에 최신 좌표를 받아온다. 실패하면 currentLocation(prop)으로 폴백.
  // retry()는 getLastKnownPositionAsync(캐시)로 먼저 seed하므로 최악의 경우에도 직전 좌표를 준다.
  const resolveCurrentLocation = async (): Promise<LocationInfo> => {
    const fresh = (await onRefreshLocation?.()) ?? null;
    return fresh
      ? { lat: fresh.latitude, lon: fresh.longitude, address: null, place_name: null }
      : currentLocation;
  };

  const applyResponse = (res: ChatResponse, options?: { reset?: boolean }) => {
    // TODO: 테스트 끝나면 아래 로그 제거 — prewalk 백엔드 대화 상태(경로 추천 안 되는 문제) 디버깅용
    const rr = res.state?.route_result;
    console.log('[ChatConversation] prewalk response:', {
      status: res.status,
      thread_id: res.thread_id,
      is_complete: res.state?.is_complete,
      awaiting_confirmation: res.state?.awaiting_confirmation,
      mode: res.state?.mode,
      route_result_type: Array.isArray(rr) ? `array(${rr.length})` : rr === null ? 'null' : typeof rr,
      route_result_raw: rr,
      user_context: res.state?.user_context,
      response: res.state?.response,
    });
    if (res.status !== ChatStatus.SUCCESS) {
      const text =
        STATUS_MESSAGES[res.status] ?? STATUS_MESSAGES[ChatStatus.INTERNAL_ERROR]!;
      setMessages(prev => (options?.reset ? [] : prev).concat({ from: 'bot', text }));
      // 실패 응답의 thread_id는 반영하지 않는다. 세션이 유실된 상태면 복구 UI로 전환.
      if (SESSION_EXPIRED_STATUSES.has(res.status)) setPhase('session_expired');
      return;
    }

    if (res.thread_id) {
      threadIdRef.current = res.thread_id;
      setThreadId(res.thread_id);
    }

    // 경로가 완성된 응답은 ChatBubble로 따로 보여주지 않는다 — 로딩 표시가 그 자리에서
    // 바로 RouteCandidate로 바뀌어 보이도록 한다.
    // 백엔드는 route_result를 경로 1개일 때 단일 객체로, 여러 개일 때 배열로 보낸다(스키마상
    // 배열이지만 실제로는 그렇지 않음) — 항상 배열로 정규화한다.
    const rawRoutes = res.state?.route_result;
    const routeList: WalkRouteResponse[] = Array.isArray(rawRoutes)
      ? rawRoutes
      : rawRoutes
      ? [rawRoutes]
      : [];
    const hasRoutes = routeList.length > 0;
    const routeReady = !!(res.state?.is_complete && hasRoutes);
    const botText = res.state?.response;
    setMessages(prev => {
      let next = options?.reset ? [] : prev;
      if (botText && !routeReady) {
        next = next.concat({ from: 'bot', text: botText });
      }
      // 새 추천은 기존 카드를 대체하지 않고 타임라인에 이어붙인다 — 이전 추천 경로도
      // 계속 보이고 선택할 수 있어야 하기 때문.
      if (hasRoutes) {
        next = next.concat({ from: 'routes', routes: routeList });
      }
      return next;
    });
    // is_complete=true인데 경로가 없는 응답도 막힌 화면이 되지 않도록 계속 대화 가능 상태로 둔다.
    setPhase(routeReady ? 'route_recommended' : 'chatting');
  };

  const startConversation = async () => {
    const origin = await resolveCurrentLocation();
    if (origin.lat == null || origin.lon == null) return;
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSending(true);
    setInitFailed(false);
    try {
      const res = await getInitMessage(
        { lat: origin.lat, lon: origin.lon },
        abortRef.current.signal,
      );
      if (requestId !== requestIdRef.current) return;
      applyResponse(res, { reset: true });
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return;
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
      if (requestId === requestIdRef.current) setSending(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    // route_recommended에서는 조건 변경·재추천 입력을 허용한다. 차단은 응답 대기 중이거나
    // 세션이 만료된 경우에만.
    if (sending || phase === 'session_expired') return;
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
    const requestId = ++requestIdRef.current;
    const requestedThreadId = threadId;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setMessages(prev => [...prev, { from: 'me', text: answer }]);
    setSending(true);
    try {
      // 대화 도중 이동했을 수 있으니 이번 발화에도 최신 좌표를 함께 보낸다.
      const here = await resolveCurrentLocation();
      if (requestId !== requestIdRef.current) return;
      console.log('[ChatConversation] getMessage →', {
        thread_id: requestedThreadId,
        user_prompt: answer,
        lat: here.lat,
        lon: here.lon,
      });
      const res = await getMessage(
        {
          thread_id: requestedThreadId,
          user_prompt: answer,
          lat: here.lat ?? undefined,
          lon: here.lon ?? undefined,
        },
        signal,
      );
      console.log('[ChatConversation] getMessage ← status:', res?.status);
      // 응답이 돌아온 사이에 새 요청이 시작됐거나 thread가 바뀌었으면 버린다.
      if (requestId !== requestIdRef.current) return;
      if (threadIdRef.current !== requestedThreadId) return;
      // 세션이 만료됐으면 이 발화를 새 세션에서 다시 처리할 수 있게 보관한다.
      if (SESSION_EXPIRED_STATUSES.has(res.status)) {
        pendingPromptRef.current = answer;
      }
      applyResponse(res);
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return;
      // TODO: 테스트 끝나면 아래 로그 제거
      console.error(
        '[ChatConversation] getMessage failed:',
        (err as any)?.response?.status,
        (err as any)?.name,
        (err as any)?.message,
        (err as any)?.stack ?? (err as any),
        JSON.stringify((err as any)?.response?.data ?? null),
      );
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: '메시지를 보내지 못했어요. 다시 시도해주세요.' },
      ]);
    } finally {
      if (requestId === requestIdRef.current) setSending(false);
    }
  };

  // 세션 만료(session_expired) 복구: 새 init으로 세션을 다시 만들고, 직전에 유실된
  // 조건 변경 발화가 있으면 새 세션에서 이어서 재처리한다(단순 init 재호출로 요청이 유실되지 않도록).
  const restartConversation = async () => {
    const origin = await resolveCurrentLocation();
    if (origin.lat == null || origin.lon == null) return;
    const pending = pendingPromptRef.current;
    pendingPromptRef.current = null;
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setInitFailed(false);
    setPhase('idle');
    setSending(true);
    try {
      const initRes = await getInitMessage(
        { lat: origin.lat, lon: origin.lon },
        signal,
      );
      if (requestId !== requestIdRef.current) return;
      applyResponse(initRes, { reset: true });
      if (
        pending &&
        initRes.status === ChatStatus.SUCCESS &&
        initRes.thread_id
      ) {
        setMessages(prev => [...prev, { from: 'me', text: pending }]);
        const res = await getMessage(
          {
            thread_id: initRes.thread_id,
            user_prompt: pending,
            lat: origin.lat ?? undefined,
            lon: origin.lon ?? undefined,
          },
          signal,
        );
        if (requestId !== requestIdRef.current) return;
        if (threadIdRef.current !== initRes.thread_id) return;
        if (SESSION_EXPIRED_STATUSES.has(res.status)) {
          pendingPromptRef.current = pending;
        }
        applyResponse(res);
      }
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return;
      // TODO: 테스트 끝나면 아래 로그 제거
      console.error(
        '[ChatConversation] restartConversation failed:',
        (err as any)?.response?.status,
        (err as any)?.response?.data ?? err,
      );
      setInitFailed(true);
      setMessages([
        { from: 'bot', text: '대화를 다시 시작하지 못했어요. 다시 시도해주세요.' },
      ]);
    } finally {
      if (requestId === requestIdRef.current) setSending(false);
    }
  };

  useEffect(() => {
    if (hasStartedRef.current) return;
    if (currentLocation.lat == null || currentLocation.lon == null) return;
    hasStartedRef.current = true;
    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation.lat, currentLocation.lon]);

  // 언마운트(대화 리셋으로 인한 리마운트 포함) 시 진행 중이던 요청을 취소한다.
  useEffect(() => {
    const abortRefAtMount = abortRef;
    return () => abortRefAtMount.current?.abort();
  }, []);

  useEffect(() => {
    onPhaseChange(phase);
  }, [phase, onPhaseChange]);

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
              message.from === 'routes' ? (
                <View style={styles.chatLine}>
                  <View style={styles.chatIcon}>
                    <Text style={styles.chatIconText}>✳</Text>
                  </View>
                  <View style={styles.cardColumn}>
                    {message.routes.map((route, routeIndex) => (
                      <RouteCandidate
                        key={route.id ?? routeIndex}
                        route={route}
                        index={routeIndex}
                        // 재추천 요청 중에는 카드 선택을 막는다 — 산책 시작과 intent 응답이
                        // 동시에 진행되어 오래된 경로로 산책이 시작되는 것을 방지. 응답이
                        // 오면 다시 풀리고, 이전에 추천된 카드도 계속 선택할 수 있다.
                        disabled={sending}
                        onPress={() => onRouteReady(route)}
                      />
                    ))}
                  </View>
                </View>
              ) : message.from === 'bot' ? (
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
          {phase === 'session_expired' && !sending ? (
            <Pressable
              onPress={() => restartConversation()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>새 대화 시작</Text>
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
