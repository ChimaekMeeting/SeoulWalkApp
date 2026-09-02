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
