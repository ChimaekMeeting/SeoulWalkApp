import {
  anchorLoopToPoint,
  bearingDeg,
  computeRouteBounds,
  directionArrowAt,
  haversineDistanceKm,
  isLoopRoute,
  pointAlongRouteFraction,
  polylineLengthKm,
  projectOntoRoute,
  reverseRoute,
  segmentProjection,
  sliceRouteAtDistanceKm,
  trimRouteToPoint,
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

describe('isLoopRoute', () => {
  it('시작점≈끝점이면 순환 코스', () => {
    expect(isLoopRoute([[37.5, 127.0], [37.51, 127.0], [37.50002, 127.0]])).toBe(true);
  });
  it('끝점이 30m 넘게 떨어져 있으면 편도 코스', () => {
    expect(isLoopRoute(NS_ROUTE)).toBe(false);
  });
  it('좌표가 2개 미만이면 false', () => {
    expect(isLoopRoute([])).toBe(false);
    expect(isLoopRoute([[37.5, 127.0]])).toBe(false);
  });
});

describe('reverseRoute', () => {
  it('좌표 순서를 뒤집는다(좌표값 자체는 그대로)', () => {
    expect(reverseRoute(NS_ROUTE)).toEqual([...NS_ROUTE].reverse());
  });
  it('원본 배열을 변형하지 않는다', () => {
    const copy = [...NS_ROUTE];
    reverseRoute(NS_ROUTE);
    expect(NS_ROUTE).toEqual(copy);
  });
});

describe('anchorLoopToPoint', () => {
  // 약 180m×220m 사각 순환 코스(시작점=끝점).
  const SQUARE: WalkRouteResponse['coordinates'] = [
    [37.5, 127.0],
    [37.5, 127.002],
    [37.502, 127.002],
    [37.502, 127.0],
    [37.5, 127.0],
  ];

  it('편도 코스는 그대로 반환한다(참조 동일)', () => {
    expect(anchorLoopToPoint(NS_ROUTE, [37.502, 127.0])).toBe(NS_ROUTE);
  });

  it('현재 위치가 기존 출발점 근처면 그대로 반환한다', () => {
    expect(anchorLoopToPoint(SQUARE, [37.5001, 127.0])).toBe(SQUARE);
  });

  it('현재 위치가 경로에서 멀면(>120m) 그대로 반환한다', () => {
    expect(anchorLoopToPoint(SQUARE, [37.51, 127.01])).toBe(SQUARE);
  });

  it('가까운 정점으로 출발점을 돌린다 — 둘레·순환 유지', () => {
    const r = anchorLoopToPoint(SQUARE, [37.5021, 127.002]); // 3번째 정점 북쪽 ~11m
    expect(r).not.toBe(SQUARE);
    expect(r[0]).toEqual([37.502, 127.002]);
    expect(r[r.length - 1]).toEqual(r[0]);
    expect(isLoopRoute(r)).toBe(true);
    expect(polylineLengthKm(r)).toBeCloseTo(polylineLengthKm(SQUARE), 5);
  });

  it('정점 사이(구간 중간)에서는 투영점을 새 출발점으로 삽입하고 둘레를 보존한다', () => {
    const r = anchorLoopToPoint(SQUARE, [37.501, 127.0021]); // 오른쪽 변 중간 근처
    expect(r).not.toBe(SQUARE);
    expect(r[0][0]).toBeCloseTo(37.501, 3);
    expect(r[0][1]).toBeCloseTo(127.002, 4);
    expect(r[r.length - 1]).toEqual(r[0]);
    expect(isLoopRoute(r)).toBe(true);
    expect(polylineLengthKm(r)).toBeCloseTo(polylineLengthKm(SQUARE), 4);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const copy = JSON.parse(JSON.stringify(SQUARE));
    anchorLoopToPoint(SQUARE, [37.5021, 127.002]);
    expect(SQUARE).toEqual(copy);
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

describe('trimRouteToPoint', () => {
  it('현재 위치가 경로 중간에 있으면 앞부분을 잘라내고 잘린 비율을 준다', () => {
    const { coordinates, trimmedFraction } = trimRouteToPoint(NS_ROUTE, NS_ROUTE[1]);
    expect(coordinates).not.toBe(NS_ROUTE);
    expect(trimmedFraction).toBeCloseTo(0.5, 2);
    expect(coordinates[0][0]).toBeCloseTo(NS_ROUTE[1][0], 4);
    expect(coordinates[coordinates.length - 1]).toEqual(NS_ROUTE[NS_ROUTE.length - 1]);
    expect(polylineLengthKm(coordinates)).toBeCloseTo(NS_LEN / 2, 3);
  });

  it('현재 위치가 시작점 근처면 원본을 그대로 반환한다(참조 동일)', () => {
    const r = trimRouteToPoint(NS_ROUTE, NS_ROUTE[0]);
    expect(r.coordinates).toBe(NS_ROUTE);
    expect(r.trimmedFraction).toBe(0);
  });

  it('현재 위치가 경로에서 멀면(경로 위에 없음) 그대로 반환한다', () => {
    const r = trimRouteToPoint(NS_ROUTE, [37.502, 127.01]); // 약 800m 동쪽
    expect(r.coordinates).toBe(NS_ROUTE);
    expect(r.trimmedFraction).toBe(0);
  });

  it('자르고 남는 길이가 너무 짧으면(거의 끝점) 그대로 반환한다', () => {
    const r = trimRouteToPoint(NS_ROUTE, NS_ROUTE[2]);
    expect(r.coordinates).toBe(NS_ROUTE);
    expect(r.trimmedFraction).toBe(0);
  });

  it('좌표가 2개 미만이면 그대로 반환한다', () => {
    expect(trimRouteToPoint([], [37.5, 127.0]).coordinates).toEqual([]);
    const single: WalkRouteResponse['coordinates'] = [[37.5, 127.0]];
    expect(trimRouteToPoint(single, [37.5, 127.0]).coordinates).toBe(single);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const copy = JSON.parse(JSON.stringify(NS_ROUTE));
    trimRouteToPoint(NS_ROUTE, NS_ROUTE[1]);
    expect(NS_ROUTE).toEqual(copy);
  });
});

describe('bearingDeg', () => {
  it('정북/정동/정남/정서를 각각 0/90/180/270°로 준다', () => {
    expect(bearingDeg([37.5, 127.0], [37.6, 127.0])).toBeCloseTo(0, 0);
    expect(bearingDeg([37.5, 127.0], [37.5, 127.1])).toBeCloseTo(90, 0);
    expect(bearingDeg([37.5, 127.0], [37.4, 127.0])).toBeCloseTo(180, 0);
    expect(bearingDeg([37.5, 127.0], [37.5, 126.9])).toBeCloseTo(270, 0);
  });
});

describe('directionArrowAt', () => {
  it('distanceKm 지점 좌표와 rot(= 진행 방향 bearing - 90)을 준다', () => {
    // 정동으로 뻗는 직선(bearing 90) → rot ≈ 0.
    const east: WalkRouteResponse['coordinates'] = [
      [37.5, 127.0],
      [37.5, 127.0 + 0.0114], // 위도 37.5에서 경도 0.0114° ≈ 1km
    ];
    const f = directionArrowAt(east, 0.5)!;
    expect(f.properties!.rot).toBeCloseTo(0, 0);
    // GeoJSON은 [lon, lat] 순서. 중간 지점이라 위도 유지, 경도는 시작과 끝 사이.
    expect(f.geometry.coordinates[1]).toBeCloseTo(37.5, 5);
    expect(f.geometry.coordinates[0]).toBeGreaterThan(127.0);
    expect(f.geometry.coordinates[0]).toBeLessThan(127.0 + 0.0114);
  });

  it('distanceKm가 커질수록 화살표가 경로를 따라 앞으로 이동한다', () => {
    const line: WalkRouteResponse['coordinates'] = [
      [37.5, 127.0],
      [37.55, 127.0],
    ];
    const near = directionArrowAt(line, 0.5)!.geometry.coordinates[1];
    const far = directionArrowAt(line, 100)!.geometry.coordinates[1]; // 경로 길이 초과 → 끝점으로 클램프
    expect(far).toBeGreaterThan(near);
    expect(far).toBeCloseTo(37.55, 5);
  });

  it('좌표 2개 미만이면 null', () => {
    expect(directionArrowAt([[37.5, 127.0]], 0.1)).toBeNull();
  });
});

describe('pointAlongRouteFraction', () => {
  it('fraction 0/1은 시작·끝점, 0.5는 중간 지점을 보간한다', () => {
    expect(pointAlongRouteFraction(NS_ROUTE, 0)).toEqual(NS_ROUTE[0]);
    expect(pointAlongRouteFraction(NS_ROUTE, 1)).toEqual(NS_ROUTE[NS_ROUTE.length - 1]);
    const mid = pointAlongRouteFraction(NS_ROUTE, 0.5)!;
    expect(haversineDistanceKm(NS_ROUTE[0], mid)).toBeCloseTo(NS_LEN / 2, 3);
  });

  it('범위를 벗어난 fraction은 0~1로 클램프하고, 빈 경로는 null', () => {
    expect(pointAlongRouteFraction(NS_ROUTE, -1)).toEqual(NS_ROUTE[0]);
    expect(pointAlongRouteFraction(NS_ROUTE, 2)).toEqual(NS_ROUTE[NS_ROUTE.length - 1]);
    expect(pointAlongRouteFraction([], 0.5)).toBeNull();
  });
});
