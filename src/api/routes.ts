import { client } from './client';
import {
  RouteFeedbackRequest,
  RouteFeedbackResponse,
  RouteHistoryItem,
  RouteHistoryQuery,
  RouteHistoryResponse,
  WalkProgressResponse,
} from '../types/routes';

/* 저장된 산책 경로의 즐겨찾기 상태를 토글합니다(서버가 현재 상태의 반대로 뒤집어 돌려줌). */
export const toggleFavoriteRoute = async (
  routeId: number,
): Promise<RouteHistoryItem> => {
  const { data } = await client.patch<RouteHistoryItem>(
    `/api/user/routes/${routeId}/favorite`,
  );
  return data;
};

/* 로그인한 사용자의 산책 경로 기록을 조회합니다. is_favorite: true를 주면 즐겨찾기만 걸러 받습니다. */
export const getRouteHistories = async (
  query: RouteHistoryQuery = {},
): Promise<RouteHistoryResponse> => {
  const { data } = await client.get<RouteHistoryResponse>('/api/user/routes', {
    params: query,
  });
  return data;
};

/* 방금 걸은 경로의 별점을 저장하고 장기 선호 가중치 갱신 결과를 받습니다. */
export const submitRouteFeedback = async (
  routeId: number,
  request: RouteFeedbackRequest,
): Promise<RouteFeedbackResponse> => {
  const { data } = await client.post<RouteFeedbackResponse>(
    `/api/user/routes/${routeId}/feedback`,
    request,
  );
  return data;
};

// 이 두 엔드포인트의 응답 status는 요청 성공 여부(success/에러코드)가 아니라 "산책 진행 상태"라서
// walk_status라는 별도 필드명을 쓴다 — toggleFavoriteRoute·submitRouteFeedback의 status와 헷갈리지
// 않도록 status === 'success' 같은 비교를 이 둘에는 절대 쓰지 않는다. 실패는 HTTP 코드로 구분한다
// (401/404/422/500 — client.ts 인터셉터가 401만 처리하고 나머진 그대로 throw됨).

/* 산책을 시작합니다(recommended → in_progress). 본문 없음 — 이미 in_progress/completed인
   경로에 다시 불러도 상태를 되돌리지 않는다(멱등). */
export const startWalkRoute = async (
  routeId: number,
): Promise<WalkProgressResponse> => {
  const { data } = await client.post<WalkProgressResponse>(
    `/api/user/routes/${routeId}/start`,
  );
  return data;
};

/* 완주를 기록합니다(in_progress → completed, walked_on에 오늘 날짜 저장). 본문 없음 — 호출 자체가
   "완주했다"는 뜻이라, 실제로 완주했을 때만 불러야 한다. 조기 종료 시엔 아예 호출하지 않는다. */
export const completeWalkRoute = async (
  routeId: number,
): Promise<WalkProgressResponse> => {
  const { data } = await client.post<WalkProgressResponse>(
    `/api/user/routes/${routeId}/complete`,
  );
  return data;
};
