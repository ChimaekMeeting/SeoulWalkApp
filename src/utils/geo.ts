import { LocationInfo, WalkRouteResponse } from '../types/prewalk';
import { mapConfig } from '../config/mapConfig';

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
