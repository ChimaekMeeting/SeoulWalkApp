import { LocationInfo, WalkRouteResponse } from '../types/prewalk';
import { mapConfig } from '../config/mapConfig';

const EARTH_RADIUS_KM = 6371;

/** [lat, lon] 두 점 사이의 대권거리(km). */
export function haversineDistanceKm(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(rLat1) * Math.cos(rLat2) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** 폴리라인([위도, 경도] 배열)의 누적 대권거리(km). 좌표가 2개 미만이면 0. */
export function polylineLengthKm(coords: WalkRouteResponse['coordinates']): number {
  if (!Array.isArray(coords)) return 0;
  let km = 0;
  for (let i = 1; i < coords.length; i++) km += haversineDistanceKm(coords[i - 1], coords[i]);
  return km;
}

// 출발점과 도착점이 이 거리(km) 안이면 사실상 같은 지점 — 순환 코스로 본다.
export const LOOP_ENDPOINT_THRESHOLD_KM = 0.03; // 30m

/** coords가 순환 코스(시작점≈끝점)인지. 좌표가 2개 미만이면 false. */
export function isLoopRoute(coords: WalkRouteResponse['coordinates']): boolean {
  if (!Array.isArray(coords) || coords.length < 2) return false;
  return (
    haversineDistanceKm(coords[0], coords[coords.length - 1]) <= LOOP_ENDPOINT_THRESHOLD_KM
  );
}

/**
 * route 배열의 순서만 뒤집는다(좌표 자체는 그대로) — 순환 코스 진행 방향 선택(WalkPrepScreen의
 * 방향 전환 버튼)용. 아직 산책을 시작하기 전, 진행률이 0인 상태에서만 쓴다 — 산책 도중에 방향을
 * 바꾸는 기능은 진행률 계산이 꼬이는 문제가 있어 빼고, 방향은 산책 시작 전에만 고르게 했다.
 */
export function reverseRoute(
  coords: WalkRouteResponse['coordinates'],
): WalkRouteResponse['coordinates'] {
  return [...coords].reverse();
}

// 순환 코스를 산책 기록에서 다시 시작할 때, 저장된 출발점은 그 경로를 처음 만든 위치에 묶여
// 있어 지금 서 있는 곳과 멀 수 있다. 닫힌 폴리라인이라 둘레·형상은 그대로 두고 시작 인덱스만
// 돌리면 "현재 위치에서 가장 가까운 경로 지점"을 출발점으로 삼을 수 있다.
export const LOOP_ANCHOR_MAX_KM = 0.12; // 현재 위치가 경로에서 이보다 멀면(=경로 위에 없음) 재정렬 안 함
export const LOOP_ANCHOR_MIN_SHIFT_KM = 0.02; // 새 출발점이 기존 출발점과 이보다 가까우면 이득이 없어 그대로 둠

/** base(닫힘 끝점을 뺀 고리 정점열)를 startIdx부터 한 바퀴 도는 열린 좌표열로 만든다. */
function rotateLoopVertices(
  base: WalkRouteResponse['coordinates'],
  startIdx: number,
): WalkRouteResponse['coordinates'] {
  const out: WalkRouteResponse['coordinates'] = [];
  for (let k = 0; k < base.length; k++) out.push(base[(startIdx + k) % base.length]);
  return out;
}

/**
 * 순환 코스(coords)를 현재 위치(point, [위도, 경도])에서 가장 가까운 경로 지점이 출발점이 되도록
 * 시작 인덱스를 돌린다. 코스 둘레·형상·total_km는 그대로다. 아래 경우엔 원본을 그대로 돌려준다
 * (참조 동일):
 *  - 편도 코스(isLoopRoute=false) — 돌릴 수 없다.
 *  - 현재 위치가 경로에서 LOOP_ANCHOR_MAX_KM 넘게 떨어짐 — 경로 위에 있지 않으므로 재정렬해도
 *    소용없다(이 경우는 "현재 위치→출발점 접근선"으로 따로 다룬다).
 *  - 새 출발점이 기존 출발점과 LOOP_ANCHOR_MIN_SHIFT_KM 이내 — 재정렬 이득이 없다.
 *
 * 산책을 시작하기 전(진행률 0, 도로 스냅 전)에만 쓴다 — 산책 중 경로가 바뀌면 진행률 트래커
 * 기준이 흔들린다. reverseRoute(방향 전환)보다 먼저 적용해야 방향 선택이 새 출발점 기준으로 된다.
 */
export function anchorLoopToPoint(
  coords: WalkRouteResponse['coordinates'],
  point: [number, number],
): WalkRouteResponse['coordinates'] {
  if (!isLoopRoute(coords) || coords.length < 4) return coords;

  // 시작점≈끝점의 중복 끝점을 뺀 순수 고리 정점열.
  const base = coords.slice(0, -1);
  const m = base.length;

  let bestSeg = 0;
  let bestDistanceKm = Infinity;
  let bestPoint: [number, number] = base[0];
  for (let i = 0; i < m; i++) {
    const { distanceKm, point: proj } = segmentProjection(point, base[i], base[(i + 1) % m]);
    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      bestSeg = i;
      bestPoint = proj;
    }
  }

  if (bestDistanceKm > LOOP_ANCHOR_MAX_KM) return coords;
  if (haversineDistanceKm(bestPoint, base[0]) <= LOOP_ANCHOR_MIN_SHIFT_KM) return coords;

  // 투영점이 구간 끝 정점에 사실상 붙어 있으면 그 정점부터 돌리고(중복점 방지), 아니면 투영점을
  // 새 출발 정점으로 삽입한다(둘레는 한 구간을 같은 직선상에서 둘로 쪼개는 것이라 보존된다).
  const VERTEX_EPS_KM = 0.001; // 1m
  const nextIdx = (bestSeg + 1) % m;
  let rotated: WalkRouteResponse['coordinates'];
  if (haversineDistanceKm(bestPoint, base[nextIdx]) <= VERTEX_EPS_KM) {
    rotated = rotateLoopVertices(base, nextIdx);
  } else if (haversineDistanceKm(bestPoint, base[bestSeg]) <= VERTEX_EPS_KM) {
    rotated = rotateLoopVertices(base, bestSeg);
  } else {
    rotated = [bestPoint, ...rotateLoopVertices(base, nextIdx)];
  }
  rotated.push(rotated[0]); // 고리를 출발점으로 정확히 닫는다.
  return rotated;
}

// 저장된 경로를 산책 기록에서 다시 시작할 때, 경로 앞부분 노드들이 지금 서 있는 곳보다 뒤에
// 있을 수 있다(편도 경로를 중간부터 다시 걷거나, anchorLoopToPoint로 시작점을 돌린 뒤에도 남은
// 어긋남 등). anchorLoopToPoint가 "인덱스만 돌려" 둘레를 보존하는 것과 달리, 이건 현재 위치가
// 경로 위에 있으면 그 지점까지의 앞부분을 실제로 잘라낸다 — 지도엔 발밑부터 선이 그려지고
// total_km 등 거리값도 잘린 비율만큼 줄인다.
export const ROUTE_TRIM_MAX_OFFROUTE_KM = 0.08; // 현재 위치가 경로에서 이보다 멀면(경로 위에 없음) 자르지 않음
export const ROUTE_TRIM_MIN_KM = 0.05; // 잘려나갈 앞부분이 이보다 짧으면 이득이 없어 원본 유지
export const ROUTE_TRIM_MIN_REMAINING_KM = 0.1; // 자르고 남는 경로가 이보다 짧아지면(거의 끝점 — 오매칭) 자르지 않음

/**
 * route 폴리라인에서 현재 위치(point, [위도, 경도])가 경로 위에 있으면, 시작점부터 현재 위치
 * 투영 지점까지의 앞부분을 잘라내고 { 잘린 좌표열, 잘린 비율(0~1) }을 돌려준다. 잘린 비율로
 * total_km 같은 거리값을 비례 축소하면 된다(폴리라인은 직선 현, total_km는 실도로라 스케일이
 * 달라 절대 km를 빼는 대신 비율로 줄인다). 아래 경우엔 원본을 그대로 돌려준다
 * (참조 동일, trimmedFraction=0):
 *  - 좌표가 2개 미만.
 *  - 현재 위치가 경로에서 ROUTE_TRIM_MAX_OFFROUTE_KM 넘게 떨어짐(경로 위에 없음).
 *  - 잘려나갈 앞부분이 ROUTE_TRIM_MIN_KM 미만(이득 없음 — 새로 만든 경로의 출발점 GPS 흔들림 등).
 *  - 자르고 남는 길이가 ROUTE_TRIM_MIN_REMAINING_KM 미만(거의 끝점 — 잘못된 매칭 방지).
 *
 * 산책을 시작하기 전(진행률 0, 도로 스냅 전)에만 쓴다 — 산책 중 경로가 바뀌면 진행률 트래커
 * 기준이 흔들린다. anchorLoopToPoint·reverseRoute 다음에 적용한다.
 */
export function trimRouteToPoint(
  route: WalkRouteResponse['coordinates'],
  point: [number, number],
): { coordinates: WalkRouteResponse['coordinates']; trimmedFraction: number } {
  const noTrim = { coordinates: route, trimmedFraction: 0 };
  if (!Array.isArray(route) || route.length < 2) return noTrim;

  const totalKm = polylineLengthKm(route);
  const { distanceAlongRouteKm, distanceToRouteKm } = projectOntoRoute(point, route);

  if (!Number.isFinite(distanceToRouteKm) || distanceToRouteKm > ROUTE_TRIM_MAX_OFFROUTE_KM) {
    return noTrim;
  }
  if (distanceAlongRouteKm < ROUTE_TRIM_MIN_KM) return noTrim;
  if (totalKm - distanceAlongRouteKm < ROUTE_TRIM_MIN_REMAINING_KM) return noTrim;

  const { after } = sliceRouteAtDistanceKm(route, distanceAlongRouteKm);
  return { coordinates: after, trimmedFraction: distanceAlongRouteKm / totalKm };
}

/**
 * 점 p([위도, 경도])를 선분 a→b에 사영한다. 위경도를 선분 시작점 위도 기준 평면으로 근사 투영하되
 * 경도축에 cos(위도) 보정을 적용해(서울에서 경도 1°는 위도 1°의 약 0.79배 거리) 사영 비율 t(0~1)와
 * 투영점, 투영점까지의 거리(km)를 구한다. mapMatchRoute.ts의 pointToSegmentKm와 동일한 좌표 모델.
 */
export function segmentProjection(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): { t: number; distanceKm: number; point: [number, number] } {
  const cosLat = Math.cos((a[0] * Math.PI) / 180) || 1;
  const ax = a[1] * cosLat;
  const ay = a[0];
  const bx = b[1] * cosLat;
  const by = b[0];
  const px = p[1] * cosLat;
  const py = p[0];
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
  const point: [number, number] = [ay + t * dy, (ax + t * dx) / cosLat];
  return { t, distanceKm: haversineDistanceKm(p, point), point };
}

/**
 * current를 route 폴리라인의 각 구간에 투영해 가장 가까운 지점을 찾고,
 * 경로 시작점부터 그 지점까지의 누적 거리를 반환한다.
 * 두 점짜리 구간은 등속 보간(선형)으로 투영 지점을 근사한다.
 *
 * @param window 지정하면 route 위 [centerKm - windowKm, centerKm + windowKm] 범위의 구간만 후보로
 *   본다. 순환 코스처럼 경로가 자기 자신과 가까이 지나가는 구간(출발점≈도착점 등)에서, 실제로는
 *   경로 뒤쪽을 걷고 있는데 지리적으로만 가까운 앞쪽 구간에 잘못 매칭되는 걸 막기 위한 것 —
 *   "직전에 있던 지점 근처에서 우선 찾는다"는 제약. 창 안에 후보가 하나도 없으면
 *   distanceToRouteKm는 Infinity로 반환된다(호출부가 창을 넓히거나 전역 탐색으로 폴백).
 */
export function projectOntoRoute(
  current: [number, number],
  route: WalkRouteResponse['coordinates'],
  window?: { centerKm: number; windowKm: number },
): { distanceAlongRouteKm: number; distanceToRouteKm: number } {
  if (!Array.isArray(route) || route.length === 0) {
    return { distanceAlongRouteKm: 0, distanceToRouteKm: Infinity };
  }
  if (route.length === 1) {
    return { distanceAlongRouteKm: 0, distanceToRouteKm: haversineDistanceKm(current, route[0]) };
  }

  let cumulativeKm = 0;
  let bestDistanceAlongRouteKm = 0;
  let bestDistanceToRouteKm = Infinity;

  for (let i = 0; i < route.length - 1; i++) {
    const segStart = route[i];
    const segEnd = route[i + 1];
    const segLengthKm = haversineDistanceKm(segStart, segEnd);

    const { t, distanceKm: distanceToRouteKm } = segmentProjection(current, segStart, segEnd);
    const distanceAlongRouteKm = cumulativeKm + t * segLengthKm;

    const withinWindow =
      !window || Math.abs(distanceAlongRouteKm - window.centerKm) <= window.windowKm;

    if (withinWindow && distanceToRouteKm < bestDistanceToRouteKm) {
      bestDistanceToRouteKm = distanceToRouteKm;
      bestDistanceAlongRouteKm = distanceAlongRouteKm;
    }

    cumulativeKm += segLengthKm;
  }

  return { distanceAlongRouteKm: bestDistanceAlongRouteKm, distanceToRouteKm: bestDistanceToRouteKm };
}

/**
 * route 폴리라인을 시작점부터 distanceKm 지점에서 둘로 자른다(보간된 분할점을 양쪽에 포함해
 * 선이 끊겨 보이지 않게 함). 지도에 "이미 걸은 구간/남은 구간"을 다른 색으로 그릴 때 쓴다.
 */
export function sliceRouteAtDistanceKm(
  route: WalkRouteResponse['coordinates'],
  distanceKm: number,
): { before: WalkRouteResponse['coordinates']; after: WalkRouteResponse['coordinates'] } {
  if (route.length === 0) return { before: [], after: [] };
  if (route.length === 1) return { before: [route[0]], after: [route[0]] };

  const clamped = Math.max(0, distanceKm);
  let cumulativeKm = 0;
  const before: WalkRouteResponse['coordinates'] = [route[0]];

  for (let i = 0; i < route.length - 1; i++) {
    const segStart = route[i];
    const segEnd = route[i + 1];
    const segLengthKm = haversineDistanceKm(segStart, segEnd);

    if (cumulativeKm + segLengthKm < clamped) {
      before.push(segEnd);
      cumulativeKm += segLengthKm;
      continue;
    }

    // 분할점이 이 구간 안에 있다 — 보간해서 정확한 위치를 구하고, 그 지점부터 나머지를 after로.
    const t = segLengthKm === 0 ? 0 : (clamped - cumulativeKm) / segLengthKm;
    const splitPoint: [number, number] = [
      segStart[0] + (segEnd[0] - segStart[0]) * t,
      segStart[1] + (segEnd[1] - segStart[1]) * t,
    ];
    before.push(splitPoint);
    return { before, after: [splitPoint, segEnd, ...route.slice(i + 2)] };
  }

  // clamped가 전체 길이 이상 — 전부 지나온 구간. after는 선이 끊기지 않게 마지막 점만 남긴다.
  return { before, after: [route[route.length - 1]] };
}

/**
 * route 폴리라인에서 시작점부터 전체 길이의 fraction(0~1) 지점에 해당하는 좌표를 보간해 돌려준다.
 * 개발용 GPS 오버라이드(경로 위 25/50/75% 지점으로 위치 이동)에서 쓴다. 좌표가 없으면 null.
 */
export function pointAlongRouteFraction(
  route: WalkRouteResponse['coordinates'],
  fraction: number,
): [number, number] | null {
  if (!Array.isArray(route) || route.length === 0) return null;
  const clamped = Math.max(0, Math.min(1, fraction));
  const { before } = sliceRouteAtDistanceKm(route, polylineLengthKm(route) * clamped);
  return before[before.length - 1] ?? route[0];
}

/**
 * backend LocationInfo(lat/lon)를 Mapbox가 요구하는 [lng, lat] 순서로 변환한다.
 * lat/lon 중 하나라도 없으면 null을 반환한다.
 */
export function locationInfoToMapboxPosition(
  loc?: LocationInfo | null,
): [number, number] | null {
  if (!loc || loc.lat == null || loc.lon == null) return null;
  return [loc.lon, loc.lat];
}

/**
 * WalkRouteResponse.coordinates([위도, 경도] 튜플 배열)를 RouteLayer용 GeoJSON LineString으로 변환한다.
 */
export function routeCoordinatesToLineString(
  coords: WalkRouteResponse['coordinates'],
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coords.map(([lat, lon]) => [lon, lat]),
    },
  };
}

/** a→b 방위각(정북 0°, 시계방향). 두 점이 같으면 0. */
export function bearingDeg(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  if (x === 0 && y === 0) return 0;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * route 폴리라인에서 시작점부터 distanceKm 지점의 좌표와, 그 지점 진행 방향으로 ▶를 돌릴 회전각
 * rot(= bearing - 90; ▶가 동쪽을 가리키므로 이 각으로 돌리면 진행 방향을 가리킨다)을 담은 GeoJSON
 * point feature. RouteDirectionFlow가 화살표 하나를 경로 위에서 흐르게 할 때 프레임마다 distanceKm를
 * 바꿔 호출한다. distanceKm는 [0, 경로 길이]로 클램프된다. 좌표가 2개 미만이면 null.
 */
export function directionArrowAt(
  route: WalkRouteResponse['coordinates'],
  distanceKm: number,
): GeoJSON.Feature<GeoJSON.Point> | null {
  if (!Array.isArray(route) || route.length < 2) return null;

  const segLen = route.slice(1).map((p, i) => haversineDistanceKm(route[i], p));
  const total = segLen.reduce((sum, d) => sum + d, 0);
  const target = Math.max(0, Math.min(distanceKm, total));

  let seg = 0;
  let segStartKm = 0;
  while (seg < segLen.length - 1 && segStartKm + segLen[seg] < target) {
    segStartKm += segLen[seg];
    seg += 1;
  }
  const frac = segLen[seg] > 0 ? (target - segStartKm) / segLen[seg] : 0;
  const a = route[seg];
  const b = route[seg + 1];
  return {
    type: 'Feature',
    properties: { rot: bearingDeg(a, b) - 90 },
    geometry: {
      type: 'Point',
      coordinates: [a[1] + (b[1] - a[1]) * frac, a[0] + (b[0] - a[0]) * frac],
    },
  };
}

export interface LatLonBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function computeRouteBounds(coords: WalkRouteResponse['coordinates']): LatLonBounds | null {
  if (coords.length === 0) return null;
  let minLat = coords[0][0];
  let maxLat = coords[0][0];
  let minLon = coords[0][1];
  let maxLon = coords[0][1];
  for (const [lat, lon] of coords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  return { minLat, maxLat, minLon, maxLon };
}

/** bounds의 중심을 Mapbox [lng, lat] 순서로 반환한다. */
export function centerOfBounds(bounds: LatLonBounds): [number, number] {
  return [(bounds.minLon + bounds.maxLon) / 2, (bounds.minLat + bounds.maxLat) / 2];
}

// Mapbox GL(및 @rnmapbox)은 512px 타일을 쓰므로 zoom 0에서 세계가 512px에 들어온다.
// 256px 타일 기준(구글 슬리피맵) 공식을 그대로 쓰면 결과 줌이 한 단계씩 높게(2배 확대) 나와
// 경로가 화면 밖으로 잘린다 — 타일 크기를 512로 맞춰 그 오프셋을 없앤다.
const WORLD_TILE_PX = 512;

function latRad(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
}

function zoomForFraction(viewportPx: number, fraction: number): number {
  if (fraction <= 0 || viewportPx <= 0) return mapConfig.maxZoom;
  return Math.log2(viewportPx / WORLD_TILE_PX / fraction);
}

/**
 * lat/lon bounds가 주어진 뷰포트(px) 안에 딱 들어오는 줌 레벨을 계산한다
 * (Google Maps의 getBoundsZoomLevel과 같은 공식, 단 WORLD_TILE_PX=512로 Mapbox GL
 * 줌 정의에 맞춤). Mapbox Camera의 imperative
 * fitBounds 대신 이 값을 zoomLevel/centerCoordinate로 선언적으로 넘기면,
 * 이후 수동 줌 버튼과 같은 state를 공유해서 서로 어긋나지 않는다.
 */
export function zoomLevelForBounds(
  bounds: LatLonBounds,
  viewportWidth: number,
  viewportHeight: number,
  paddingPx = 40,
): number {
  const latFraction = (latRad(bounds.maxLat) - latRad(bounds.minLat)) / Math.PI;
  const lonDiff = bounds.maxLon - bounds.minLon;
  const lonFraction = (lonDiff < 0 ? lonDiff + 360 : lonDiff) / 360;

  const latZoom = zoomForFraction(Math.max(viewportHeight - paddingPx * 2, 0), latFraction);
  const lonZoom = zoomForFraction(Math.max(viewportWidth - paddingPx * 2, 0), lonFraction);

  const zoom = Math.min(latZoom, lonZoom);
  return Math.max(mapConfig.minZoom, Math.min(Math.floor(zoom), mapConfig.maxZoom));
}
