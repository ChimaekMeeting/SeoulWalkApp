import React from 'react';
import Mapbox from '@rnmapbox/maps';
import { WalkRouteResponse } from '../../types/prewalk';
import { routeCoordinatesToLineString } from '../../utils/geo';

/**
 * 경로 선을 따라 일정 간격으로 화살표(▶) 기호를 찍는다. Mapbox GL이 symbolPlacement: 'line'일
 * 때 각 기호를 그 지점의 선 방향에 맞춰 자동으로 회전시켜주므로, 별도 계산 없이 "이 경로가
 * 어느 방향으로 이어지는지"를 문자만으로 표시할 수 있다.
 *
 * 진행률(traveledKm)과 무관하게 항상 경로 전체에 그린다 — 진행/미진행 색 구분(TraveledSplitRouteLayers)은
 * "어디까지 걸었는지"를, 이 화살표는 "어느 방향이 진행 방향인지"를 보여준다. 특히 순환 코스처럼
 * 출발점과 도착점이 겹쳐서 마커만으로는 방향을 알 수 없는 경우, 산책을 시작하기도 전(진행률 0%)에도
 * 이 화살표만으로 어느 쪽으로 걸어야 하는지 바로 알 수 있어야 한다.
 */
export function RouteDirectionArrows({ route }: { route: WalkRouteResponse['coordinates'] }) {
  if (route.length < 2) return null;

  return (
    <Mapbox.ShapeSource id="route-direction-source" shape={routeCoordinatesToLineString(route)}>
      <Mapbox.SymbolLayer
        id="route-direction-arrows"
        style={{
          symbolPlacement: 'line',
          symbolSpacing: 60,
          textField: '▶',
          textSize: 14,
          textColor: '#FFFFFF',
          textHaloColor: 'rgba(17,17,17,0.65)',
          textHaloWidth: 1.5,
          textRotationAlignment: 'map',
          textPitchAlignment: 'map',
          textKeepUpright: false,
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
    </Mapbox.ShapeSource>
  );
}
