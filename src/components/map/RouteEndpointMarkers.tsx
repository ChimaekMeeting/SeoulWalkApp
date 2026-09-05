import React from 'react';
import Mapbox from '@rnmapbox/maps';
import { WalkRouteResponse } from '../../types/prewalk';
import { isLoopRoute } from '../../utils/geo';
import { colors } from '../../theme/tokens';

interface Props {
  route: WalkRouteResponse['coordinates'];
}

/**
 * 경로 시작/끝 지점에 라벨이 달린 원 마커를 그린다. 순환 코스는 시작=끝이라 "출발" 하나만
 * 찍는다(편도는 "출발"/"도착" 둘 다).
 *
 * 경로선과 같은 GL ShapeSource/CircleLayer로 그려서 경로선과 정확히 같은 타이밍에 나타난다(한때
 * MarkerView(뷰 오버레이)로 바꿔봤는데, 지도 스타일 로딩 + 첫 GPS 확보를 다 기다린 뒤에야 띄울 수
 * 있어서 뜨는 데 시간이 꽤 걸렸다). AppMapView가 이 컴포넌트를 경로선보다 나중에 렌더링해 원이
 * 선 위에 그려지게 하므로("선-원-선"으로 이어져 보임), 순환 코스처럼 선이 자기 자신과 겹치는
 * 자리에서도 원이 선에 묻히지 않는다. 단, 사용자 위치 점(puck)은 이 원보다도 더 위에 그려지는
 * 것으로 보여서(Mapbox 네이티브 SDK가 puck을 항상 최상단에 합성하는 듯), 사용자가 정확히 그
 * 좌표에 서 있는 동안엔 puck에 가려질 수 있다 — 알려진 트레이드오프.
 */
export function RouteEndpointMarkers({ route }: Props) {
  if (route.length < 2) return null;

  const start = route[0];
  const end = route[route.length - 1];

  const features: GeoJSON.Feature<GeoJSON.Point>[] = isLoopRoute(route)
    ? [pointFeature(start, '출발', 'start')]
    : [pointFeature(start, '출발', 'start'), pointFeature(end, '도착', 'end')];

  const data: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: 'FeatureCollection', features };

  return (
    <Mapbox.ShapeSource id="route-endpoints-source" shape={data}>
      <Mapbox.CircleLayer
        id="route-endpoints-circle"
        style={{
          circleRadius: 9,
          circleColor: ['match', ['get', 'kind'], 'end', colors.coral, colors.ink],
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
          textHaloColor: 'rgba(0,0,0,0.75)',
          textHaloWidth: 1.5,
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
  kind: 'start' | 'end',
): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    properties: { label, kind },
    geometry: { type: 'Point', coordinates: [lon, lat] },
  };
}
