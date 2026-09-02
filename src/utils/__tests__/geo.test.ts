import {
  computeRouteBounds,
  haversineDistanceKm,
  polylineLengthKm,
  projectOntoRoute,
  segmentProjection,
  sliceRouteAtDistanceKm,
  zoomLevelForBounds,
} from '../geo';
import { WalkRouteResponse } from '../../types/prewalk';

const NS_ROUTE: WalkRouteResponse['coordinates'] = [
  [37.5, 127.0],
  [37.502, 127.0],
  [37.504, 127.0],
];
const NS_LEN = polylineLengthKm(NS_ROUTE);

describe('polylineLengthKm', () => {
  it('누적 대권거리를 더한다', () => {
    expect(polylineLengthKm(NS_ROUTE)).toBeCloseTo(
      haversineDistanceKm(NS_ROUTE[0], NS_ROUTE[1]) +
        haversineDistanceKm(NS_ROUTE[1], NS_ROUTE[2]),
      9,
    );
  });
  it('좌표가 2개 미만이면 0', () => {
    expect(polylineLengthKm([])).toBe(0);
    expect(polylineLengthKm([[37.5, 127.0]])).toBe(0);
  });
});

describe('segmentProjection', () => {
  it('선분 위 점은 t가 비율과 같고 거리는 0에 가깝다', () => {
    const a: [number, number] = [37.5, 127.0];
    const b: [number, number] = [37.5, 127.01];
    const mid: [number, number] = [37.5, 127.005];
    const r = segmentProjection(mid, a, b);
    expect(r.t).toBeCloseTo(0.5, 5);
    expect(r.distanceKm).toBeCloseTo(0, 5);
  });

  it('0 길이 선분에서 NaN/Infinity가 안 나온다', () => {
    const r = segmentProjection([37.5, 127.0], [37.5, 127.0], [37.5, 127.0]);
    expect(Number.isFinite(r.t)).toBe(true);
    expect(Number.isFinite(r.distanceKm)).toBe(true);
  });

  it('대각선 선분: 경도축 cos(위도) 보정으로 순진한 평면 투영보다 더 가까운 점을 찾는다', () => {
    const a: [number, number] = [37.5, 127.0];
    const b: [number, number] = [37.51, 127.01];
    const p: [number, number] = [37.5, 127.01];
    const corrected = segmentProjection(p, a, b).distanceKm;

    // cos 보정 없이 위경도를 그대로 평면 취급했을 때의 거리(옛 구현).
    const dx = b[1] - a[1];
    const dy = b[0] - a[0];
    const lenSq = dx * dx + dy * dy;
    const tNaive = Math.max(
      0,
      Math.min(1, ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / lenSq),
    );
    const naive = haversineDistanceKm(p, [a[0] + tNaive * dy, a[1] + tNaive * dx]);

    expect(corrected).toBeLessThanOrEqual(naive + 1e-9);
  });
});

describe('projectOntoRoute', () => {
  it('시작점/끝점/중간점의 누적거리', () => {
    expect(projectOntoRoute(NS_ROUTE[0], NS_ROUTE).distanceAlongRouteKm).toBeCloseTo(0, 4);
    expect(projectOntoRoute(NS_ROUTE[2], NS_ROUTE).distanceAlongRouteKm).toBeCloseTo(NS_LEN, 4);
    const mid = projectOntoRoute([37.501, 127.0], NS_ROUTE);
    expect(mid.distanceAlongRouteKm).toBeCloseTo(NS_LEN / 4, 2);
    expect(mid.distanceToRouteKm).toBeCloseTo(0, 4);
  });

  it('경로에서 벗어난 거리(distanceToRouteKm)', () => {
    const off = projectOntoRoute([37.501, 127.0007], NS_ROUTE); // 약 60m 동쪽
    expect(off.distanceToRouteKm).toBeGreaterThan(0.04);
    expect(off.distanceToRouteKm).toBeLessThan(0.08);
  });

  it('빈 route / 단일 점 route 방어', () => {
    expect(projectOntoRoute([37.5, 127.0], [])).toEqual({
      distanceAlongRouteKm: 0,
      distanceToRouteKm: Infinity,
    });
    const single = projectOntoRoute([37.5, 127.0], [[37.6, 127.0]]);
    expect(single.distanceAlongRouteKm).toBe(0);
    expect(single.distanceToRouteKm).toBeGreaterThan(0);
  });

  it('창(window) 밖에 후보가 없으면 distanceToRouteKm는 Infinity', () => {
    const r = projectOntoRoute(NS_ROUTE[2], NS_ROUTE, { centerKm: 0, windowKm: 0.05 });
    expect(r.distanceToRouteKm).toBe(Infinity);
  });

  it('self-intersection 경로에서 window로 올바른 국소 구간을 고른다', () => {
    // ㄷ 자로 되돌아와 시작 구간과 나란해지는 경로.
    const uShape: WalkRouteResponse['coordinates'] = [
      [37.5, 127.0],
      [37.5, 127.004],
      [37.5008, 127.004],
      [37.5008, 127.0],
    ];
    const total = polylineLengthKm(uShape);
    // 마지막 구간 중앙 근처지만 시작 구간과 거의 겹치는 위치.
    const p: [number, number] = [37.5008, 127.002];
    const near = projectOntoRoute(p, uShape, { centerKm: total * 0.85, windowKm: 0.15 });
    expect(near.distanceAlongRouteKm).toBeGreaterThan(total * 0.6);
  });
});

describe('zoomLevelForBounds', () => {
  // Mapbox GL(512px 타일)에서 zoom의 미터/픽셀.
  const metersPerPx = (lat: number, zoom: number) =>
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);

  it('경로 전체가 뷰포트 안에 들어오는 줌을 준다(잘리지 않음)', () => {
    // 약 1km 편도 경로(WalkPrepScreen 미리보기 카드 크기).
    const route: WalkRouteResponse['coordinates'] = [
      [37.6, 126.92],
      [37.603, 126.928],
      [37.606, 126.935],
    ];
    const bounds = computeRouteBounds(route)!;
    const width = 340;
    const height = 300;
    const padding = 40;
    const zoom = zoomLevelForBounds(bounds, width, height, padding);

    const midLat = (bounds.minLat + bounds.maxLat) / 2;
    const mpp = metersPerPx(midLat, zoom);
    const spanLatM = (bounds.maxLat - bounds.minLat) * 111_320;
    const spanLonM =
      (bounds.maxLon - bounds.minLon) * 111_320 * Math.cos((midLat * Math.PI) / 180);

    expect(spanLatM).toBeLessThanOrEqual((height - padding * 2) * mpp);
    expect(spanLonM).toBeLessThanOrEqual((width - padding * 2) * mpp);
  });

  it('작은 bbox일수록 더 크게 확대한다', () => {
    const wide = { minLat: 37.5, maxLat: 37.53, minLon: 127.0, maxLon: 127.04 };
    const tight = { minLat: 37.5, maxLat: 37.501, minLon: 127.0, maxLon: 127.001 };
    expect(zoomLevelForBounds(tight, 300, 300)).toBeGreaterThan(
      zoomLevelForBounds(wide, 300, 300),
    );
  });

  it('mapConfig 줌 범위(10~18)를 벗어나지 않는다', () => {
    const hair = { minLat: 37.5, maxLat: 37.5001, minLon: 127.0, maxLon: 127.0001 };
    const country = { minLat: 33, maxLat: 39, minLon: 124, maxLon: 132 };
    expect(zoomLevelForBounds(hair, 300, 300)).toBeLessThanOrEqual(18);
    expect(zoomLevelForBounds(country, 300, 300)).toBeGreaterThanOrEqual(10);
  });
});

describe('sliceRouteAtDistanceKm', () => {
  it('진행 거리 지점에서 before/after로 나눈다', () => {
    const { before, after } = sliceRouteAtDistanceKm(NS_ROUTE, NS_LEN / 2);
    expect(polylineLengthKm(before)).toBeCloseTo(NS_LEN / 2, 2);
    expect(polylineLengthKm(after)).toBeCloseTo(NS_LEN / 2, 2);
  });
});
