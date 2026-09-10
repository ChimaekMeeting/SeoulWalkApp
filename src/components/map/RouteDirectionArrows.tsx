import React from 'react';
import Mapbox from '@rnmapbox/maps';
import { WalkRouteResponse } from '../../types/prewalk';
import { routeCoordinatesToLineString } from '../../utils/geo';

interface Props {
  route: WalkRouteResponse['coordinates'];
}

/**
 * 경로 선을 따라 일정 간격으로 화살표(▶) 기호를 찍는다. Mapbox GL이 symbolPlacement: 'line'일
 * 때 각 기호를 그 지점의 선 방향에 맞춰 자동으로 회전시켜주므로, 별도 계산 없이 "이 경로가
 * 어느 방향으로 이어지는지"를 문자만으로 표시할 수 있다.
 *
 * 산책 중(walk) 화면 전용 — 진행/미진행 색 구분(TraveledSplitRouteLayers)이 "어디까지 걸었는지"를,
 * 이 화살표는 "어느 방향이 진행 방향인지"를 보여준다. 산책 준비(overview) 화면은 선이 수직일 때
 * ▶ 방향이 애매하다는 피드백에 따라 흐르는 점선(RouteDirectionFlow)을 쓴다.
 */
export function RouteDirectionArrows({ route }: Props) {
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
