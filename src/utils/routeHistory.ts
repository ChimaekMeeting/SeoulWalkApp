import { WalkMode, WalkRouteResponse, WalkRouteStatus } from '../types/prewalk';
import { RouteHistoryItem } from '../types/routes';

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

export function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_LABEL[date.getDay()]}`;
}

/* 저장된 경로 기록을 다시 산책 시작(6a)에 쓸 수 있도록 WalkRouteResponse 형태로 변환한다. */
export function routeHistoryToWalkRoute(history: RouteHistoryItem): WalkRouteResponse {
  return {
    status: WalkRouteStatus.SUCCESS,
    mode: history.mode as WalkMode,
    coordinates: history.coordinates as [number, number][],
    total_km: history.total_km,
    id: history.id,
    is_favorite: history.is_favorite,
  };
}
