import { fetch as expoFetch } from 'expo/fetch';
import { env } from '../config/env';
import { authStorage } from '../auth/authStorage';
import {
  ChatRequest,
  ChatResponse,
  InitRequest,
  PrewalkProgressHandler,
} from '../types/prewalk';

// 프리워크 챗봇 응답은 Content-Type: text/event-stream(SSE)이라 axios(client.ts)로는 이벤트를
// 순서대로 소비할 수 없다. RN(Hermes)의 axios/XHR 어댑터는 스트리밍 바디를 지원하지 않으므로,
// 네이티브 스트리밍을 지원하는 expo/fetch(response.body가 ReadableStream)로 직접 호출한다.
// 이 때문에 client.ts의 토큰 자동 갱신(401 재발급) 인터셉터도 이 두 엔드포인트에는 적용되지 않는다 —
// ACCESS_EXPIRED_TOKEN/INVALID_TOKEN이 오면 ChatConversation이 "새 대화 시작" 안내로 처리한다.

// 응답이 이 시간(ms) 동안 한 이벤트도 보내지 않으면 멈춘 것으로 보고 중단한다. 콜드스타트 +
// 그래프 탐색 + LLM 호출이 겹치면 첫 이벤트까지 오래 걸릴 수 있어 넉넉히 잡되, progress 이벤트가
// 올 때마다 다시 늘어나므로(활동 기준) 전체 대화가 아무리 길어도 끊기지 않는다.
const PREWALK_IDLE_TIMEOUT_MS = 45000;

// RN(Hermes)은 TextDecoder를 전역으로 제공하지만 @react-native/typescript-config의 lib에는
// DOM 타입이 없어 TS가 모른다. 런타임엔 있으니 타입만 최소한으로 선언해둔다.
declare const TextDecoder: {
  new (): {
    decode(input?: Uint8Array, options?: { stream?: boolean }): string;
  };
};

export class PrewalkStreamError extends Error {}

type SseEvent = { event: string; data: string };

function parseSseBlock(block: string): SseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:'))
      dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

async function streamPrewalk(
  path: string,
  body: InitRequest | ChatRequest,
  signal: AbortSignal | undefined,
  onProgress: PrewalkProgressHandler | undefined,
): Promise<ChatResponse> {
  const token = await authStorage.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers.Cookie = `access_token=${token}`;
  }

  // 부모 signal(호출자의 취소)과 유휴 타임아웃을 하나의 컨트롤러로 합친다. timedOut을 따로 두는
  // 이유는, 유휴 타임아웃도 fetch 입장에서는 그냥 AbortError라 사용자가 취소한 것(조용히 무시해야
  // 할 것)과 구분이 안 되기 때문 — 타임아웃일 때만 에러 메시지를 보여주도록 표시해둔다.
  const idleController = new AbortController();
  const onParentAbort = () => idleController.abort();
  signal?.addEventListener('abort', onParentAbort);
  let timedOut = false;
  const armIdleTimer = () =>
    setTimeout(() => {
      timedOut = true;
      idleController.abort();
    }, PREWALK_IDLE_TIMEOUT_MS);
  let idleTimer = armIdleTimer();
  const bumpIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = armIdleTimer();
  };

  try {
    try {
      const res = await expoFetch(`${env.API_BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: idleController.signal,
      });

      // 응답이 SSE가 아닌 일반 에러(4xx/5xx, 프록시 타임아웃 등)일 수 있다 — 이 경우 body를 그대로
      // 이벤트 스트림으로 읽으려 하면 결과 이벤트를 못 찾고 "stream ended without a result event"라는
      // 의미 없는 메시지로 뭉개진다. 상태 코드부터 확인해 실제 원인(상태 코드 + 응답 본문)을 남긴다.
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new PrewalkStreamError(
          `[prewalk] HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 500)}` : ''}`,
        );
      }

      if (!res.body) {
        throw new PrewalkStreamError(
          '[prewalk] streaming response has no body',
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: ChatResponse | null = null;

      // 파싱된 이벤트 한 건을 처리한다. 정상 루프 도중과, 스트림이 끝난 뒤 버퍼에 덜 파싱된
      // 마지막 이벤트를 마저 처리할 때 둘 다에서 쓴다(아래 참고).
      const handleEvent = (parsed: SseEvent) => {
        if (parsed.event === 'progress') {
          onProgress?.(parsed.data);
        } else if (parsed.event === 'result') {
          result = JSON.parse(parsed.data) as ChatResponse;
        } else if (parsed.event === 'error') {
          throw new PrewalkStreamError(parsed.data);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bumpIdleTimer();
        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, '\n');

        let sepIndex: number;
        // SSE 이벤트는 빈 줄(\n\n)로 구분된다.
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          const parsed = parseSseBlock(rawEvent);
          if (parsed) handleEvent(parsed);
        }
      }

      // 서버가 마지막 이벤트(대개 result) 뒤에 구분자(빈 줄) 없이 바로 연결을 끊으면, 그 이벤트가
      // \n\n을 못 만나 buffer에 그대로 남아 위 루프에서 처리되지 않는다 — 여기서 마저 파싱한다.
      buffer += decoder.decode();
      const trailing = parseSseBlock(buffer);
      if (trailing) handleEvent(trailing);

      // access_expired_token 같은 일부 에러 응답은 SSE 포맷(event:/data:) 없이 body 전체가 그냥
      // JSON 한 덩어리로 온다 — 위 파싱은 다 실패하지만, buffer 자체가 유효한 ChatResponse JSON일
      // 수 있으니 마지막으로 그대로 파싱을 시도한다. 이래야 session_expired 처리(로그인 만료 안내)로
      // 정상적으로 이어진다.
      if (!result) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed && typeof parsed.status === 'string') {
            result = parsed as ChatResponse;
          }
        } catch {
          // buffer가 JSON도 아니면 아래에서 그대로 에러 처리.
        }
      }

      if (!result) {
        throw new PrewalkStreamError(
          '[prewalk] stream ended without a result event',
        );
      }
      return result;
    } catch (err) {
      if (timedOut) {
        throw new PrewalkStreamError(
          '요청이 너무 오래 걸려요. 다시 시도해주세요.',
        );
      }
      throw err;
    }
  } finally {
    clearTimeout(idleTimer);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

/* 챗봇의 첫 번째 메시지를 제공합니다. */
export const getInitMessage = async (
  body: InitRequest,
  signal?: AbortSignal,
  onProgress?: PrewalkProgressHandler,
): Promise<ChatResponse> =>
  streamPrewalk('/api/prewalk/init', body, signal, onProgress);

/* 사용자 프롬프트를 기반으로 적절한 메시지를 제공합니다. */
export const getMessage = async (
  body: ChatRequest,
  signal?: AbortSignal,
  onProgress?: PrewalkProgressHandler,
): Promise<ChatResponse> =>
  streamPrewalk('/api/prewalk/intent', body, signal, onProgress);
