import { ChatStatus } from '../../types/prewalk';

jest.mock('../../auth/authStorage', () => ({
  authStorage: { getAccessToken: jest.fn().mockResolvedValue(null) },
}));
jest.mock('../../config/env', () => ({
  env: { API_BASE_URL: 'http://test' },
}));

const mockFetch = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getMessage } = require('../prewalk');

// RN(Hermes)·Jest(Node) 둘 다 런타임엔 TextEncoder를 전역으로 제공하지만, 이 프로젝트의 tsconfig엔
// DOM 타입이 없어 TS가 모른다 — prewalk.ts의 TextDecoder 선언과 같은 이유로 최소 타입만 선언한다.
declare const TextEncoder: {
  new (): { encode(input?: string): Uint8Array };
};

/** chunks를 순서대로 흘려보내는 가짜 스트리밍 Response.body를 만든다. */
function makeStreamResponse(chunks: string[]) {
  let i = 0;
  return {
    body: {
      getReader: () => ({
        read: async () => {
          if (i < chunks.length) {
            return { done: false, value: new TextEncoder().encode(chunks[i++]) };
          }
          return { done: true, value: undefined };
        },
      }),
    },
  };
}

describe('getMessage (prewalk SSE 스트리밍)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('서버가 마지막 result 이벤트 뒤에 빈 줄(\\n\\n) 없이 바로 연결을 끊어도 결과를 파싱한다', async () => {
    const payload = { status: ChatStatus.SUCCESS, thread_id: 't1', state: null };
    // 의도적으로 끝에 "\n\n"을 안 붙인다 — 서버가 이 상태로 스트림을 닫는 경우를 재현.
    const sse = `event: result\ndata: ${JSON.stringify(payload)}`;
    mockFetch.mockResolvedValue(makeStreamResponse([sse]));

    const res = await getMessage({ thread_id: 't1', user_prompt: '안녕' });

    expect(res).toEqual(payload);
  });

  it('정상적으로 구분된(\\n\\n) 여러 이벤트도 그대로 처리한다', async () => {
    const payload = { status: ChatStatus.SUCCESS, thread_id: 't2', state: null };
    const sse =
      `event: progress\ndata: 생각 중\n\n` +
      `event: result\ndata: ${JSON.stringify(payload)}\n\n`;
    mockFetch.mockResolvedValue(makeStreamResponse([sse]));
    const onProgress = jest.fn();

    const res = await getMessage(
      { thread_id: 't2', user_prompt: '안녕' },
      undefined,
      onProgress,
    );

    expect(onProgress).toHaveBeenCalledWith('생각 중');
    expect(res).toEqual(payload);
  });
});
