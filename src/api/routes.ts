import { client } from './client';
import { RouteHistoryItem } from '../types/routes';

/* 저장된 산책 경로의 즐겨찾기 상태를 토글합니다(서버가 현재 상태의 반대로 뒤집어 돌려줌). */
export const toggleFavoriteRoute = async (routeId: number): Promise<RouteHistoryItem> => {
  const { data } = await client.patch<RouteHistoryItem>(`/api/user/routes/${routeId}/favorite`);
  return data;
};
