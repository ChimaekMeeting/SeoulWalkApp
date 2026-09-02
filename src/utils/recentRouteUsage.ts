import * as SecureStore from 'expo-secure-store';

/**
 * "최근 경로" 정렬용 로컬 사용 기록.
 *
 * 서버 RouteHistory는 경로가 처음 생성될 때(챗봇 플로우)만 만들어지고, 기록 탭에서 저장된
 * 경로를 골라 다시 산책하는 건 서버에 아무 기록도 남기지 않는다. 그래서 "그 경로로 다시
 * 걸으면 목록 맨 위로 올라온다"를 서버 데이터만으로는 구현할 수 없어, 마지막으로 걸은 시각을
 * 이 기기에 route id별로 저장해 정렬에 얹는다.
 */
const STORAGE_KEY = 'recent_route_usage_v1';

// SecureStore 값 크기 제한(안드로이드 약 2KB)에 안 걸리도록 최근 항목만 유지한다.
const MAX_ENTRIES = 40;

type UsageMap = Record<string, number>;

async function readMap(): Promise<UsageMap> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as UsageMap;
    return {};
  } catch {
    return {};
  }
}

/** route id → 마지막으로 산책을 시작한 시각(epoch ms). 조회 실패 시 빈 객체. */
export async function getRecentRouteUsage(): Promise<UsageMap> {
  return readMap();
}

/** 저장된 경로로 (다시) 산책을 시작했음을 기록한다. */
export async function markRouteWalked(
  routeId: number,
  walkedAt: number = Date.now(),
): Promise<void> {
  try {
    const map = await readMap();
    map[String(routeId)] = walkedAt;

    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1] - a[1]);
      const pruned: UsageMap = {};
      for (const [id, ts] of entries.slice(0, MAX_ENTRIES)) pruned[id] = ts;
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(pruned));
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 로컬 정렬 힌트일 뿐이라 실패해도 무시한다.
  }
}
