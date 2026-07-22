import { client } from './client';
import { RouteHistoryItem, RouteHistoryQuery, RouteHistoryResponse } from '../types/routes';

/* 저장된 산책 경로의 즐겨찾기 상태를 토글합니다(서버가 현재 상태의 반대로 뒤집어 돌려줌). */
export const toggleFavoriteRoute = async (routeId: number): Promise<RouteHistoryItem> => {
  const { data } = await client.patch<RouteHistoryItem>(`/api/user/routes/${routeId}/favorite`);
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
