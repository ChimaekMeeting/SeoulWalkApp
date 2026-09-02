import { WalkMode, WalkRouteResponse, WalkRouteStatus } from '../types/prewalk';
import { RouteHistoryItem } from '../types/routes';

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

export function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_LABEL[date.getDay()]}`;
}

/**
 * 같은 경로로 여러 번 산책하면 서버엔 매번 새 RouteHistory가 쌓인다. 기록 목록에선
 * 같은 경로를 카드 하나로 합쳐 보여주기 위한 서명(signature)을 만든다 — 모드·출발/도착
 * 좌표(약 10m 반올림)·거리·경로 중간점(약 100m 반올림)이 모두 같으면 같은 경로로 본다.
 */
function routeSignature(history: RouteHistoryItem): string {
  const r = (n: number | null, digits: number) => (n == null ? 'x' : n.toFixed(digits));
  const mid = history.coordinates[Math.floor(history.coordinates.length / 2)];
  return [
    history.mode,
    r(history.origin_lat, 4),
    r(history.origin_lon, 4),
    r(history.destination_lat, 4),
    r(history.destination_lon, 4),
    history.total_km.toFixed(1),
    mid ? `${r(mid[0], 3)},${r(mid[1], 3)}` : 'x',
  ].join('|');
}

/** route id → 마지막으로 이 기기에서 산책한 시각(epoch ms). `recentRouteUsage`에서 온다. */
export type RouteUsageMap = Record<string, number>;

/**
 * 경로의 "최근성" 시각. 서버 created_at(경로 최초 생성 시각)과, 기록 탭에서 골라 다시
 * 걸었을 때 로컬에 남긴 시각 중 더 나중을 쓴다 — 재산책한 경로가 목록 위로 올라오게 하려면
 * 서버엔 아무 기록도 안 남으므로 로컬 시각이 필요하다.
 */
function recencyMs(history: RouteHistoryItem, usage: RouteUsageMap): number {
  const created = new Date(history.created_at).getTime();
  const walked = history.id != null ? usage[String(history.id)] : undefined;
  return Math.max(created || 0, walked ?? 0);
}

/**
 * 중복 경로 기록을 하나로 합치고 최근에 걸은 순으로 정렬한다.
 * - 같은 경로(routeSignature)는 대표 카드 하나만 남긴다 → 같은 경로가 여러 장 뜨지 않는다.
 * - 대표 카드는 그룹에서 가장 최근에 걸은 기록이고, 그 경로로 다시 산책하면 맨 위로 올라온다.
 * 그룹 안에 즐겨찾기된 기록이 하나라도 있으면 대표 카드도 즐겨찾기로 표시한다.
 */
export function dedupeRouteHistories(
  histories: RouteHistoryItem[],
  usage: RouteUsageMap = {},
): RouteHistoryItem[] {
  const groups = new Map<string, RouteHistoryItem>();
  for (const history of histories) {
    const key = routeSignature(history);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, history);
      continue;
    }
    const newer =
      recencyMs(history, usage) > recencyMs(existing, usage) ? history : existing;
    groups.set(key, {
      ...newer,
      is_favorite: existing.is_favorite || history.is_favorite,
    });
  }
  return [...groups.values()].sort(
    (a, b) => recencyMs(b, usage) - recencyMs(a, usage),
  );
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
