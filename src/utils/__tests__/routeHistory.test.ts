import { dedupeRouteHistories } from '../routeHistory';
import { RouteHistoryItem } from '../../types/routes';

function makeHistory(overrides: Partial<RouteHistoryItem> = {}): RouteHistoryItem {
  return {
    id: 1,
    mode: 'oneway_shortest',
    origin_lat: 37.5665,
    origin_lon: 126.978,
    destination_lat: 37.5721,
    destination_lon: 126.9769,
    coordinates: [
      [37.5665, 126.978],
      [37.5693, 126.9775],
      [37.5721, 126.9769],
    ],
    total_km: 1.0,
    is_favorite: false,
    created_at: '2026-09-01T09:00:00.000Z',
    ...overrides,
  };
}

describe('dedupeRouteHistories', () => {
  it('같은 경로로 여러 번 걸은 기록을 카드 하나로 합친다', () => {
    const result = dedupeRouteHistories([
      makeHistory({ id: 1, created_at: '2026-09-01T09:00:00.000Z' }),
      makeHistory({ id: 2, created_at: '2026-09-01T12:00:00.000Z' }),
      makeHistory({ id: 3, created_at: '2026-09-02T08:00:00.000Z' }),
    ]);

    expect(result).toHaveLength(1);
    // 대표 카드는 가장 최근 기록(재산책 시 즐겨찾기 토글 대상 id도 최신)이다.
    expect(result[0].id).toBe(3);
  });

  it('GPS 오차 수준(약 10m 미만)의 좌표 차이는 같은 경로로 본다', () => {
    const result = dedupeRouteHistories([
      makeHistory({ id: 1, origin_lat: 37.56651, origin_lon: 126.97801 }),
      makeHistory({ id: 2, origin_lat: 37.56649, origin_lon: 126.97799 }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('출발지가 같아도 목적지·거리가 다르면 별개 경로로 유지한다', () => {
    const result = dedupeRouteHistories([
      makeHistory({ id: 1 }),
      makeHistory({
        id: 2,
        destination_lat: 37.6,
        destination_lon: 127.02,
        total_km: 4.2,
        coordinates: [
          [37.5665, 126.978],
          [37.58, 127.0],
          [37.6, 127.02],
        ],
      }),
    ]);

    expect(result).toHaveLength(2);
  });

  it('최근에 걸은 경로가 목록 맨 위로 온다', () => {
    const routeA = { origin_lat: 37.5665, origin_lon: 126.978 };
    const routeB = {
      origin_lat: 37.6,
      origin_lon: 127.02,
      destination_lat: 37.61,
      destination_lon: 127.03,
      coordinates: [
        [37.6, 127.02],
        [37.605, 127.025],
        [37.61, 127.03],
      ] as number[][],
    };

    const result = dedupeRouteHistories([
      makeHistory({ id: 1, ...routeA, created_at: '2026-09-01T09:00:00.000Z' }),
      makeHistory({ id: 2, ...routeB, created_at: '2026-09-02T09:00:00.000Z' }),
      // routeA를 오늘 다시 걸었다 → routeA 그룹이 맨 위로 올라와야 한다.
      makeHistory({ id: 3, ...routeA, created_at: '2026-09-03T09:00:00.000Z' }),
    ]);

    expect(result.map(h => h.id)).toEqual([3, 2]);
  });

  it('기록 탭에서 다시 걸은 경로(로컬 사용 기록)가 맨 위로 온다', () => {
    const routeA = { origin_lat: 37.5665, origin_lon: 126.978 };
    const routeB = {
      origin_lat: 37.6,
      origin_lon: 127.02,
      destination_lat: 37.61,
      destination_lon: 127.03,
      coordinates: [
        [37.6, 127.02],
        [37.605, 127.025],
        [37.61, 127.03],
      ] as number[][],
    };

    const histories = [
      makeHistory({ id: 10, ...routeA, created_at: '2026-09-01T09:00:00.000Z' }),
      makeHistory({ id: 20, ...routeB, created_at: '2026-09-05T09:00:00.000Z' }),
    ];

    // 서버 created_at만 보면 routeB(9/5)가 위지만, routeA(id 10)를 오늘 다시 걸었다.
    const usage = { '10': Date.parse('2026-09-10T09:00:00.000Z') };

    expect(dedupeRouteHistories(histories, usage).map(h => h.id)).toEqual([10, 20]);
  });

  it('그룹에 즐겨찾기된 기록이 하나라도 있으면 대표 카드도 즐겨찾기로 표시한다', () => {
    const result = dedupeRouteHistories([
      makeHistory({ id: 1, is_favorite: true, created_at: '2026-09-01T09:00:00.000Z' }),
      makeHistory({ id: 2, is_favorite: false, created_at: '2026-09-02T09:00:00.000Z' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
    expect(result[0].is_favorite).toBe(true);
  });
});
