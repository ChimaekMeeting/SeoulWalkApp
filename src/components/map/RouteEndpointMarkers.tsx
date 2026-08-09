import React from 'react';
import Mapbox from '@rnmapbox/maps';
import { WalkRouteResponse } from '../../types/prewalk';
import { haversineDistanceKm } from '../../utils/geo';
import { colors } from '../../theme/tokens';

// 이 거리 안이면 출발점과 도착점을 사실상 같은 지점(순환 코스)으로 보고 마커 하나로 합쳐서
// "출발·도착"로 표시한다 — 두 마커를 각각 찍으면 같은 자리에 겹쳐서 하나만 있는 것처럼 보인다.
const LOOP_ENDPOINT_THRESHOLD_KM = 0.03; // 30m

interface Props {
  route: WalkRouteResponse['coordinates'];
}

/** 경로 시작/끝 지점에 라벨이 달린 마커를 그린다. 순환 코스면 "출발·도착" 하나로 합친다. */
export function RouteEndpointMarkers({ route }: Props) {
  if (route.length < 2) return null;

  const start = route[0];
  const end = route[route.length - 1];
  const isLoop = haversineDistanceKm(start, end) <= LOOP_ENDPOINT_THRESHOLD_KM;

  const features: GeoJSON.Feature<GeoJSON.Point>[] = isLoop
    ? [pointFeature(start, '출발·도착', 'loop')]
    : [pointFeature(start, '출발', 'start'), pointFeature(end, '도착', 'end')];

  const data: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: 'FeatureCollection', features };

  return (
    <Mapbox.ShapeSource id="route-endpoints-source" shape={data}>
      <Mapbox.CircleLayer
        id="route-endpoints-circle"
        style={{
          circleRadius: 9,
          circleColor: ['match', ['get', 'kind'], 'end', colors.coral, colors.accent],
          circleStrokeWidth: 2,
          circleStrokeColor: '#FFFFFF',
        }}
      />
      <Mapbox.SymbolLayer
        id="route-endpoints-label"
        style={{
          textField: ['get', 'label'],
          textSize: 12,
          textFont: ['Noto Sans Bold'],
          textColor: '#FFFFFF',
          textHaloColor: 'rgba(0,0,0,0.45)',
          textHaloWidth: 1,
          textOffset: [0, -1.6],
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
    </Mapbox.ShapeSource>
  );
}

function pointFeature(
  [lat, lon]: [number, number],
  label: string,
  kind: 'start' | 'end' | 'loop',
): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    properties: { label, kind },
    geometry: { type: 'Point', coordinates: [lon, lat] },
  };
}
