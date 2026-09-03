import React from 'react';
import Mapbox from '@rnmapbox/maps';
import { WalkRouteResponse } from '../../types/prewalk';
import { routeCoordinatesToLineString } from '../../utils/geo';
import { colors } from '../../theme/tokens';

interface Props {
  route: WalkRouteResponse['coordinates'];
  /**
   * 'large'면 화살표를 더 크고 촘촘하게, 테두리(halo)를 진하게 그린다 — WalkPrepScreen의 작은
   * 미리보기 지도(밝은 streets 스타일)에서 기본 크기가 잘 안 보인다는 피드백에 따른 것.
   * 색 자체는 default와 같은 흰 글자+검정 테두리 — halo만 더 굵고 불투명해서 밝은 지도 위에서도
   * 잘 보인다. 기본은 'default'.
   */
  size?: 'default' | 'large';
}

/**
 * 경로 선을 따라 일정 간격으로 화살표(▶) 기호를 찍는다. Mapbox GL이 symbolPlacement: 'line'일
 * 때 각 기호를 그 지점의 선 방향에 맞춰 자동으로 회전시켜주므로, 별도 계산 없이 "이 경로가
 * 어느 방향으로 이어지는지"를 문자만으로 표시할 수 있다.
 *
 * 진행률(routeProgressKm)과 무관하게 항상 경로 전체에 그린다 — 진행/미진행 색 구분(TraveledSplitRouteLayers)은
 * "어디까지 걸었는지"를, 이 화살표는 "어느 방향이 진행 방향인지"를 보여준다. 특히 순환 코스처럼
 * 출발점과 도착점이 겹쳐서 마커만으로는 방향을 알 수 없는 경우, 산책을 시작하기도 전(진행률 0%)에도
 * 이 화살표만으로 어느 쪽으로 걸어야 하는지 바로 알 수 있어야 한다.
 */
export function RouteDirectionArrows({ route, size = 'default' }: Props) {
  if (route.length < 2) return null;
  const large = size === 'large';

  return (
    <Mapbox.ShapeSource id="route-direction-source" shape={routeCoordinatesToLineString(route)}>
      <Mapbox.SymbolLayer
        id="route-direction-arrows"
        style={{
          symbolPlacement: 'line',
          symbolSpacing: large ? 40 : 60,
          textField: '▶',
          textSize: large ? 22 : 14,
          textColor: '#FFFFFF',
          textHaloColor: large ? colors.ink : 'rgba(17,17,17,0.65)',
          textHaloWidth: large ? 2 : 1.5,
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
