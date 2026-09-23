import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  Linking,
  Platform,
  Pressable,
  View,
  StyleSheet,
} from 'react-native';
import { Text } from '../Text';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  getInitMessage,
  getMessage,
  PrewalkStreamError,
} from '../../api/prewalk';
import {
  ChatResponse,
  ChatStatus,
  CircularPreference,
  LocationInfo,
  OnewayPreference,
  OnewayShortestPreference,
  State,
  WalkMode,
  WalkRouteResponse,
} from '../../types/prewalk';
import type { LocationErrorReason } from '../../hooks/useLocation';
import type { Coordinates } from '../../types/location';
import { ChatBubble } from './ChatBubble';
import { MyBubble } from './MyBubble';
import { LoadingBubble } from './LoadingBubble';
import { RouteCandidate } from './RouteCandidate';
import { AssistantAvatar } from './AssistantAvatar';
import { WalkHintCard } from './WalkHintCard';
import { WalkConditionCard } from './WalkConditionCard';
import { spacing, colors } from '../../theme/tokens';

// 챗봇이 이해한 산책 조건 요약(WalkConditionCard용). user_context에 출발지와, 순환 모드면
// 목표 거리·편도 모드면 목적지가 갖춰지면 계산된다(is_complete·feature_labels는 기다리지
// 않는다 — 확인 질문 단계에서도 사용자가 뭘 확인하는지 보여줘야 하므로). 그 전까지는 null이라
// 카드 자체가 뜨지 않는다.
type WalkConditions = {
  mode: WalkMode;
  origin: LocationInfo;
  destination: LocationInfo | null;
  targetKm: number | null;
  // oneway_shortest처럼 사용자가 지정한 목표 거리가 아니라 백엔드가 계산한 최단 거리일 때는
  // "목표 거리를 OOkm로 바꿔줘" 같은 발화로 고칠 대상이 아니므로 연필 아이콘을 숨긴다.
  targetKmEditable: boolean;
};

function extractWalkConditions(state: State): WalkConditions | null {
  // is_complete=true(경로 계산 완료)나 feature_labels(안전/편안 라벨)까지 기다리면, 정작
  // "이 코스로 진행할까요?" 확인 질문이 뜨는 시점(아직 is_complete=false)엔 카드가 안 보여서
  // 사용자가 뭘 확인하고 예/아니요를 눌러야 할지 알 수 없었다. 출발·도착·거리처럼 확인에 필요한
  // 최소 정보만 갖춰지면 바로 보여준다.
  const ctx = state.user_context;
  if (!ctx || !ctx.origin) return null;

  if (ctx.mode === WalkMode.CIRCULAR_RANDOM) {
    const pref = ctx as CircularPreference;
    if (pref.target_km == null) return null;
    return {
      mode: pref.mode,
      origin: pref.origin!,
      destination: null,
      targetKm: pref.target_km,
      targetKmEditable: true,
    };
  }

  const pref = ctx as OnewayPreference | OnewayShortestPreference;
  if (!pref.destination) return null;
  const hasOwnTargetKm = 'target_km' in pref;
  const targetKm = hasOwnTargetKm ? (pref as OnewayPreference).target_km : null;
  return {
    mode: pref.mode,
    origin: pref.origin!,
    destination: pref.destination,
    targetKm: targetKm ?? state.shortest_km ?? null,
    targetKmEditable: hasOwnTargetKm,
  };
}

export type ChatConversationHandle = {
  submitAnswer: (answer: string) => void;
  submitConfirmation: (confirmed: boolean) => void;
};

/**
 * 대화 단계. `state.is_complete`(경로 계산 완료)와 "대화 종료·입력 차단"을 분리하기 위한 것.
 *  - idle             : threadId 확보 전(첫 init 대기/실패)
 *  - chatting         : 대화 진행 중, 아직 추천된 경로 없음
 *  - route_recommended: 경로가 추천됨 — 카드 수락뿐 아니라 조건 변경·재추천 입력도 가능
 *  - session_expired  : 세션이 만료/유실됨 — "새 대화 시작"으로만 복구
 */
export type ChatPhase =
  | 'idle'
  | 'chatting'
  | 'route_recommended'
  | 'session_expired';

// 'routes'는 추천 경로 카드 묶음을 타임라인상의 한 항목으로 취급하기 위한 것.
// 재추천마다 새 항목을 이어붙이므로(교체가 아님) 이전 추천 카드도 그대로 남아 선택할 수 있고,
// 이후 채팅은 자연스럽게 그 카드 밑으로 쌓인다.
type Message =
  | { from: 'bot' | 'me'; text: string }
  | { from: 'routes'; routes: WalkRouteResponse[] }
  | { from: 'conditions'; conditions: WalkConditions };

// 대기 중 LoadingBubble에 보여줄 기본 문구. 서버가 progress 이벤트를 보내주면 그걸로 즉시
// 대체되므로(progressSteps), 이건 첫 이벤트가 도착하기 전 아주 짧은 순간에만 보인다.
const DEFAULT_LOADING_STEP = '생각하고 있어요';

const STATUS_MESSAGES: Partial<Record<ChatStatus, string>> = {
  [ChatStatus.ACCESS_EXPIRED_TOKEN]:
    '로그인이 만료되었어요. 다시 로그인해주세요.',
  [ChatStatus.INVALID_TOKEN]:
    '인증 정보가 올바르지 않아요. 다시 로그인해주세요.',
  [ChatStatus.SESSION_NOT_FOUND]:
    '대화 세션을 찾을 수 없어요. 다시 시작해주세요.',
  [ChatStatus.UNACCESSIBLE]: '지금은 서비스를 이용할 수 없어요.',
  [ChatStatus.INTERNAL_ERROR]:
    '일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
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
  // "이 코스로 진행할까요?" 같은 확인 질문 대기 여부를 외부(입력창 바 위 예/아니요 버튼)에 알림.
  // 이 동안엔 바깥 ChatInput도 비활성화해서 자유 텍스트 대신 버튼으로만 답하게 한다.
  onAwaitingConfirmationChange?: (awaiting: boolean) => void;
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
  // 첫 봇 메시지의 실측 높이를 부모(중간 스냅 계산)에 전달한다. 브랜드 제목은 지도 위에
  // 따로 있으므로 포함하지 않는다. 대화가 길어져도 이 미리보기 묶음 자체의 크기는 바뀌지 않아,
  // 중간 스냅이 항상 같은 위치(말풍선이 잘리지 않는 위치)를 가리키게 된다.
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
    onAwaitingConfirmationChange,
    bottomInset,
    onPreviewHeightChange,
  }: Props,
  ref: React.Ref<ChatConversationHandle>,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  // "코스 N" 라벨을 메시지 내 순번이 아니라 대화 전체 누적 순번으로 매기기 위한 오프셋.
  // 백엔드가 라운드당 경로 1개만 배열 없이 내려주는 경우가 많아, 메시지별로 인덱스를
  // 0부터 다시 매기면 모든 라운드가 "코스 1"로 보이기 때문(messages[i]에 대응하는 offset).
  const routeOffsets = useMemo(() => {
    let count = 0;
    return messages.map(message => {
      const offset = count;
      if (message.from === 'routes') count += message.routes.length;
      return offset;
    });
  }, [messages]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [sending, setSending] = useState(false);
  // 진행 중인 요청이 SSE progress 이벤트로 보내온 문구들(도착 순서대로 누적) — LoadingBubble은
  // 항상 마지막 항목만 보여준다. 요청을 새로 시작할 때마다 비운다.
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  // 직전 응답이 "이 코스로 진행할까요?" 같은 확인 질문이었는지 — true면 예/아니요 버튼을 보여준다.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // getInitMessage 실패 시 true — hasStartedRef가 재시도를 막아버리지 않도록 별도로 추적한다.
  const [initFailed, setInitFailed] = useState(false);
  const [previewGroupHeight, setPreviewGroupHeight] = useState(0);
  const scrollRef =
    useRef<React.ElementRef<typeof BottomSheetScrollView>>(null);
  const keyboardVisibleRef = useRef(false);
  const hasStartedRef = useRef(false);
  // 비동기 응답이 리셋된 대화/바뀐 세션에 섞이지 않도록: 요청마다 세대 번호를 올리고,
  // 응답이 돌아왔을 때 여전히 최신 요청·같은 thread인지 검증한다.
  const requestIdRef = useRef(0);
  const threadIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 세션 만료로 유실된 직전 사용자 발화. "새 대화 시작" 시 새 세션에서 재처리한다.
  const pendingPromptRef = useRef<string | null>(null);

  // 새 말풍선 추가와 바텀시트 높이 변경은 같은 프레임에 일어날 수 있다. 한 번만
  // scrollToEnd를 호출하면 이전 viewport를 기준으로 계산되어 긴 첫 메시지 쪽에 멈출 수
  // 있으므로, 현재 레이아웃과 다음 레이아웃이 모두 끝난 뒤 최신 항목을 다시 맞춘다.
  // 키보드 높이·화면 크기를 직접 계산하지 않아 기기별 adjustResize 동작에도 동일하게 대응한다.
  const scrollToLatest = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    });
  }, []);

  const isAbortError = (err: unknown) =>
    (err as { name?: string })?.name === 'AbortError' ||
    (err as { code?: string })?.code === 'ERR_CANCELED';

  // 이 요청이 여전히 최신 요청일 때만 progressSteps에 반영한다(오래된 요청의 뒤늦은 이벤트 무시).
  const makeProgressHandler = (requestId: number) => (text: string) => {
    if (requestId === requestIdRef.current)
      setProgressSteps(prev => [...prev, text]);
  };

  // 요청 직전에 최신 좌표를 받아온다. 실패하면 currentLocation(prop)으로 폴백.
  // retry()는 getLastKnownPositionAsync(캐시)로 먼저 seed하므로 최악의 경우에도 직전 좌표를 준다.
  const resolveCurrentLocation = async (): Promise<LocationInfo> => {
    const fresh = (await onRefreshLocation?.()) ?? null;
    return fresh
      ? {
          lat: fresh.latitude,
          lon: fresh.longitude,
          address: null,
          place_name: null,
        }
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
      route_result_type: Array.isArray(rr)
        ? `array(${rr.length})`
        : rr === null
        ? 'null'
        : typeof rr,
      route_result_raw: rr,
      user_context: res.state?.user_context,
      response: res.state?.response,
    });
    setAwaitingConfirmation(false);
    if (res.status !== ChatStatus.SUCCESS) {
      const text =
        STATUS_MESSAGES[res.status] ??
        STATUS_MESSAGES[ChatStatus.INTERNAL_ERROR]!;
      setMessages(prev =>
        (options?.reset ? [] : prev).concat({ from: 'bot', text }),
      );
      // 실패 응답의 thread_id는 반영하지 않는다. 세션이 유실된 상태면 복구 UI로 전환.
      if (SESSION_EXPIRED_STATUSES.has(res.status)) setPhase('session_expired');
      return;
    }

    const nextConditions = res.state ? extractWalkConditions(res.state) : null;

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
      // 확인 질문("이 코스로 진행할까요?") 등 봇 텍스트 바로 위에 조건 요약 카드를 보여준다 —
      // 사용자가 뭘 보고 예/아니요를 누르는지 알 수 있어야 하므로 그 라운드의 봇 말풍선 앞에 둔다.
      if (nextConditions) {
        next = next.concat({ from: 'conditions', conditions: nextConditions });
      }
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
    setAwaitingConfirmation(!!res.state?.awaiting_confirmation);
  };

  // 요청 실패(스트림 에러 포함) 시 보여줄 문구. 서버가 error 이벤트로 사유를 알려준 경우 그걸
  // 그대로 쓰고, 그 외(네트워크 오류 등)에는 fallback 문구를 쓴다.
  const streamErrorText = (err: unknown, fallback: string) =>
    err instanceof PrewalkStreamError ? err.message : fallback;

  const startConversation = async () => {
    const origin = await resolveCurrentLocation();
    if (origin.lat == null || origin.lon == null) return;
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setProgressSteps([]);
    setSending(true);
    setInitFailed(false);
    try {
      const res = await getInitMessage(
        { lat: origin.lat, lon: origin.lon },
        abortRef.current.signal,
        makeProgressHandler(requestId),
      );
      if (requestId !== requestIdRef.current) return;
      applyResponse(res, { reset: true });
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return;
      // TODO: 테스트 끝나면 아래 로그 제거
      console.error('[ChatConversation] getInitMessage failed:', err);
      // hasStartedRef를 다시 풀어줘야 재시도 버튼을 누르지 않고도(예: 위치가 뒤늦게 잡혀서
      // effect가 재실행되는 경우) 다음 시도가 막히지 않는다.
      hasStartedRef.current = false;
      setInitFailed(true);
      setMessages([
        {
          from: 'bot',
          text: streamErrorText(
            err,
            '대화를 시작하지 못했어요. 다시 시도해주세요.',
          ),
        },
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
    setProgressSteps([]);
    setSending(true);
    try {
      // 대화 도중 이동했을 수 있으니 이번 발화에도 최신 좌표를 함께 보낸다.
      const here = await resolveCurrentLocation();
      if (requestId !== requestIdRef.current) return;
      const res = await getMessage(
        {
          thread_id: requestedThreadId,
          user_prompt: answer,
          lat: here.lat ?? undefined,
          lon: here.lon ?? undefined,
        },
        signal,
        makeProgressHandler(requestId),
      );
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
      console.error('[ChatConversation] getMessage failed:', err);
      setMessages(prev => [
        ...prev,
        {
          from: 'bot',
          text: streamErrorText(
            err,
            '메시지를 보내지 못했어요. 다시 시도해주세요.',
          ),
        },
      ]);
    } finally {
      if (requestId === requestIdRef.current) setSending(false);
    }
  };

  // "이 코스로 진행할까요?" 같은 확인 질문에 버튼으로 답한다. 자유 텍스트가 아니라
  // confirmation 필드로 보내고, user_prompt는 비워 보낸다(confirmation과 함께면 공백 허용).
  const submitConfirmation = async (confirmed: boolean) => {
    if (sending || phase === 'session_expired' || !threadId) return;
    const requestId = ++requestIdRef.current;
    const requestedThreadId = threadId;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setMessages(prev => [
      ...prev,
      { from: 'me', text: confirmed ? '예' : '아니요' },
    ]);
    setAwaitingConfirmation(false);
    setProgressSteps([]);
    setSending(true);
    try {
      const here = await resolveCurrentLocation();
      if (requestId !== requestIdRef.current) return;
      const res = await getMessage(
        {
          thread_id: requestedThreadId,
          user_prompt: '',
          confirmation: confirmed,
          lat: here.lat ?? undefined,
          lon: here.lon ?? undefined,
        },
        signal,
        makeProgressHandler(requestId),
      );
      if (requestId !== requestIdRef.current) return;
      if (threadIdRef.current !== requestedThreadId) return;
      applyResponse(res);
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return;
      console.error('[ChatConversation] submitConfirmation failed:', err);
      setMessages(prev => [
        ...prev,
        {
          from: 'bot',
          text: streamErrorText(
            err,
            '요청을 처리하지 못했어요. 다시 시도해주세요.',
          ),
        },
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
    setProgressSteps([]);
    setSending(true);
    try {
      const initRes = await getInitMessage(
        { lat: origin.lat, lon: origin.lon },
        signal,
        makeProgressHandler(requestId),
      );
      if (requestId !== requestIdRef.current) return;
      applyResponse(initRes, { reset: true });
      if (
        pending &&
        initRes.status === ChatStatus.SUCCESS &&
        initRes.thread_id
      ) {
        setMessages(prev => [...prev, { from: 'me', text: pending }]);
        setProgressSteps([]);
        const res = await getMessage(
          {
            thread_id: initRes.thread_id,
            user_prompt: pending,
            lat: origin.lat ?? undefined,
            lon: origin.lon ?? undefined,
          },
          signal,
          makeProgressHandler(requestId),
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
      console.error('[ChatConversation] restartConversation failed:', err);
      setInitFailed(true);
      setMessages([
        {
          from: 'bot',
          text: streamErrorText(
            err,
            '대화를 다시 시작하지 못했어요. 다시 시도해주세요.',
          ),
        },
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
    onAwaitingConfirmationChange?.(awaitingConfirmation);
  }, [awaitingConfirmation, onAwaitingConfirmationChange]);

  useEffect(() => {
    // previewGroupHeight는 스크롤 여백(padding)을 뺀 순수 콘텐츠 높이라,
    // 위쪽 padding(spacing.lg)만 더하면 "미리보기 영역이 실제로 차지하는 높이"가 된다.
    onPreviewHeightChange(previewGroupHeight + spacing.lg);
  }, [previewGroupHeight, onPreviewHeightChange]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      keyboardVisibleRef.current = true;
      // 키보드가 뜨며 대화 영역이 좁아진(또는 시트가 펼쳐진) 다음 프레임에서 마지막 메시지를
      // 다시 노출한다. 키보드 높이나 기기별 지연값에는 의존하지 않는다.
      scrollToLatest(false);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToLatest]);

  useEffect(() => {
    // 사용자 발화, 로딩 버블, AI 응답/경로 카드로 타임라인 끝이 바뀔 때마다 최신 항목을 노출한다.
    scrollToLatest(false);
  }, [messages.length, sending, scrollToLatest]);

  useImperativeHandle(ref, () => ({
    submitAnswer: (answer: string) => {
      submitAnswer(answer);
    },
    submitConfirmation: (confirmed: boolean) => {
      submitConfirmation(confirmed);
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
  const locationNotice: {
    text: string;
    actionLabel: string;
    onPress: () => void;
  } | null =
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
      <BottomSheetScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={[
          styles.chatContent,
          { paddingBottom: bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        // 콘텐츠와 viewport 중 어느 쪽이 먼저 바뀌어도 최종 레이아웃을 기준으로 최신 대화를 보인다.
        onContentSizeChange={() => scrollToLatest(false)}
        onLayout={() => scrollToLatest(false)}
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
                <Text style={styles.retryButtonText}>
                  {locationNotice.actionLabel}
                </Text>
              </Pressable>
            </View>
          ) : awaitingLocation ? (
            <ChatBubble text="위치 정보를 확인하는 중이에요…" />
          ) : null}
          {messages.map((message, index) => {
            const routeOffset = routeOffsets[index];
            const bubble =
              message.from === 'routes' ? (
                <View style={styles.chatLine}>
                  <AssistantAvatar />
                  <View style={styles.cardColumn}>
                    {message.routes.map((route, routeIndex) => (
                      <RouteCandidate
                        key={route.id ?? routeIndex}
                        route={route}
                        index={routeOffset + routeIndex}
                        // 재추천 요청 중에는 카드 선택을 막는다 — 산책 시작과 intent 응답이
                        // 동시에 진행되어 오래된 경로로 산책이 시작되는 것을 방지. 응답이
                        // 오면 다시 풀리고, 이전에 추천된 카드도 계속 선택할 수 있다.
                        disabled={sending}
                        onPress={() => onRouteReady(route)}
                      />
                    ))}
                  </View>
                </View>
              ) : message.from === 'conditions' ? (
                <WalkConditionCard
                  origin={message.conditions.origin}
                  destination={message.conditions.destination}
                  showDestination={message.conditions.mode !== WalkMode.CIRCULAR_RANDOM}
                  targetKm={message.conditions.targetKm}
                  distanceEditable={message.conditions.targetKmEditable}
                  disabled={sending || phase === 'session_expired'}
                  onEdit={text => submitAnswer(text)}
                />
              ) : message.from === 'bot' ? (
                <ChatBubble text={message.text} />
              ) : (
                <MyBubble text={message.text} />
              );
            // 첫 봇 메시지만 실측해 중간 스냅 높이 계산에 사용한다. 아직 사용자가 아무것도
            // 입력하지 않은 첫 화면에서는 조건 힌트 카드도 함께 보여준다.
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
                  {messages.length === 1 && !sending ? <WalkHintCard /> : null}
                </View>
              );
            }
            return <View key={index}>{bubble}</View>;
          })}
          {sending ? (
            <LoadingBubble
              steps={
                progressSteps.length ? progressSteps : [DEFAULT_LOADING_STEP]
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
    borderColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonPressed: {
    opacity: 0.6,
  },
  retryButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  chatLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardColumn: {
    flexShrink: 1,
    width: '82%',
    gap: spacing.sm,
  },
});
