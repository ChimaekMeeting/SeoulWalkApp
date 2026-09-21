import React, { useEffect, useMemo, useState } from 'react';
import Mapbox from '@rnmapbox/maps';
import { WalkRouteResponse } from '../../types/prewalk';
import { directionArrowAt, polylineLengthKm } from '../../utils/geo';

interface Props {
  route: WalkRouteResponse['coordinates'];
}

// 큰 화살표 하나가 출발점부터 도착점까지 경로 전체를 끊김없이 훑고, 도착하면 다시 출발점으로
// 돌아가 반복한다. SWEEP_MS는 예전에 전체 길이의 17%(0.22-0.05)만 훑던 구간 스윕과 동일한
// 체감 속도를 내도록 역산한 값 — 훑는 구간만 늘리고 속도가 갑자기 빨라 보이지 않게 한다.
const SWEEP_MS = 18800; // 경로 전체를 이 시간에 걸쳐 한 번 훑음 — 느긋하게
const FRAME_MS = 80;

/**
 * 경로 진행 방향을 "출발점에서 도착점까지 천천히 흐르는 큰 화살표 하나"로 보여준다 — 산책 준비
 * 화면(overview)에서 실선 경로 위에 겹쳐 그린다. 도착점에 닿으면 다시 출발점으로 돌아가 반복한다.
 * 산책 중 화면은 진행/미진행 색 구분 + 사용자 퍽이 방향을 알려주므로 여기선 쓰지 않는다.
 */
export function RouteDirectionFlow({ route }: Props) {
  const totalKm = useMemo(() => polylineLengthKm(route), [route]);
  const [distanceKm, setDistanceKm] = useState(0);

  useEffect(() => {
    if (route.length < 2 || totalKm === 0) return;
    setDistanceKm(0);
    const stepKm = (totalKm * FRAME_MS) / SWEEP_MS;
    const timer = setInterval(
      () => setDistanceKm(d => (d + stepKm > totalKm ? 0 : d + stepKm)),
      FRAME_MS,
    );
    return () => clearInterval(timer);
    // route 배열 자체를 의존성에 넣어야 한다 — 순환 코스 방향 전환처럼 route.length/totalKm는
    // 그대로인데 좌표 순서만 뒤집히는 경우에도 애니메이션이 처음(출발점)부터 다시 시작되게 하기 위함.
  }, [route, totalKm]);

  const feature = useMemo(() => directionArrowAt(route, distanceKm), [route, distanceKm]);
  if (!feature) return null;

  return (
    <Mapbox.ShapeSource
      id="route-direction-flow-source"
      shape={{ type: 'FeatureCollection', features: [feature] }}
    >
      <Mapbox.SymbolLayer
        id="route-direction-flow"
        style={{
          textField: '▶',
          textSize: 28,
          textColor: '#FFFFFF',
          textHaloColor: 'rgba(17,17,17,0.75)',
          textHaloWidth: 2,
          textRotate: ['get', 'rot'],
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
