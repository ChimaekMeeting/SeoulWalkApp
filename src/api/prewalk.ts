import { client } from './client';
import { ChatRequest, ChatResponse, InitRequest } from '../types/prewalk';

/* 챗봇의 첫 번째 메시지를 제공합니다. */
export const getInitMessage = async (
  body: InitRequest,
): Promise<ChatResponse> => {
  const { data } = await client.post<ChatResponse>('/api/prewalk/init', body);
  return data;
};

/* 사용자 프롬프트를 기반으로 적절한 메시지를 제공합니다. */
export const getMessage = async (body: ChatRequest): Promise<ChatResponse> => {
  const { data } = await client.post<ChatResponse>('/api/prewalk/intent', body);
  return data;
};
