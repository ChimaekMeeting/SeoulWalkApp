import { LocationInfo, WalkRouteResponse } from '../types/prewalk';
import { mapConfig } from '../config/mapConfig';
import { env } from '../config/env';

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

const WORLD_TILE_PX = 256;

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
 * (Google Maps의 getBoundsZoomLevel과 동일한 공식). Mapbox Camera의 imperative
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

/** Google Polyline Algorithm(precision 5)로 [lat, lon] 좌표열을 인코딩한다(Mapbox Static Images path overlay용). */
function encodePolyline(points: [number, number][]): string {
  let result = '';
  let prevLat = 0;
  let prevLon = 0;
  for (const [lat, lon] of points) {
    const lat5 = Math.round(lat * 1e5);
    const lon5 = Math.round(lon * 1e5);
    result += encodeSignedNumber(lat5 - prevLat) + encodeSignedNumber(lon5 - prevLon);
    prevLat = lat5;
    prevLon = lon5;
  }
  return result;
}

function encodeSignedNumber(num: number): string {
  let sgn = num << 1;
  if (num < 0) sgn = ~sgn;
  return encodeNumber(sgn);
}

function encodeNumber(num: number): string {
  let encoded = '';
  let n = num;
  while (n >= 0x20) {
    encoded += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  encoded += String.fromCharCode(n + 63);
  return encoded;
}

// Mapbox Studio에서 라벨 레이어를 지운 커스텀 스타일 (기록 카드 썸네일 전용, 글자 없음)
const THUMBNAIL_STYLE_USERNAME = 'kuty2004';
const THUMBNAIL_STYLE_ID = 'cmrw0ecps003b01ss3khn6csv';

/**
 * 실제 산책 경로 좌표로 작은 지도 썸네일 URL을 만든다(기록 카드용).
 * 위 커스텀 스타일을 쓰므로 지명/도로명 글자가 없다.
 * 좌표가 너무 많으면 URL 길이 제한에 걸리므로 최대 30개 점으로 샘플링한다.
 * 토큰이 없거나 좌표가 비어있으면 null을 반환한다.
 */
export function buildRouteThumbnailUrl(coordinates: number[][], size = 56): string | null {
  if (!coordinates.length || !env.MAPBOX_PUBLIC_ACCESS_TOKEN) return null;

  const maxPoints = 30;
  const step = Math.max(1, Math.floor(coordinates.length / maxPoints));
  const sampled = coordinates
    .filter((_, i) => i % step === 0)
    .map(([lat, lon]) => [lat, lon] as [number, number]);
  const encoded = encodePolyline(sampled);
  // RouteLayer.tsx의 실제 산책 경로 안내 색상(#4A90E2)과 통일
  const overlay = `path-3+4A90E2-0.9(${encodeURIComponent(encoded)})`;

  return (
    `https://api.mapbox.com/styles/v1/${THUMBNAIL_STYLE_USERNAME}/${THUMBNAIL_STYLE_ID}/static/${overlay}/auto/${size}x${size}@2x` +
    `?padding=4&attribution=false&logo=false&access_token=${env.MAPBOX_PUBLIC_ACCESS_TOKEN}`
  );
}
