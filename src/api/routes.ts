import { client } from './client';

/* 저장된 산책 경로의 즐겨찾기 상태를 변경합니다. */
export const toggleFavoriteRoute = async (
  routeId: number,
  favorite: boolean,
): Promise<void> => {
  await client.patch(`/api/user/routes/${routeId}/favorite`, { favorite });
};
