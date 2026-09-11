import { client } from './client';
import { ChatRequest, ChatResponse, InitRequest } from '../types/prewalk';

// 프리워크 챗봇은 백엔드가 그래프 탐색 + LLM 호출까지 하므로 정상 응답도 20초(client 기본
// timeout)를 넘길 수 있다. 콜드스타트까지 겹치면 첫 요청은 거의 확실히 넘긴다 — 정상 응답이
// timeout에 잘려 "다시 시도" 루프로 빠지지 않도록 이 두 엔드포인트만 여유를 더 준다.
const PREWALK_TIMEOUT_MS = 45000;

/* 챗봇의 첫 번째 메시지를 제공합니다. */
export const getInitMessage = async (
  body: InitRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> => {
  const { data } = await client.post<ChatResponse>('/api/prewalk/init', body, {
    signal,
    timeout: PREWALK_TIMEOUT_MS,
  });
  return data;
};

/* 사용자 프롬프트를 기반으로 적절한 메시지를 제공합니다. */
export const getMessage = async (
  body: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> => {
  const { data } = await client.post<ChatResponse>('/api/prewalk/intent', body, {
    signal,
    timeout: PREWALK_TIMEOUT_MS,
  });
  return data;
};
