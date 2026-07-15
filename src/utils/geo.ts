import { LocationInfo, WalkRouteResponse } from '../types/prewalk';

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
