import React, { useEffect, useMemo, useState } from 'react';
import Mapbox from '@rnmapbox/maps';
import { WalkRouteResponse } from '../../types/prewalk';
import { directionArrowAt, polylineLengthKm } from '../../utils/geo';

interface Props {
  route: WalkRouteResponse['coordinates'];
}

// 큰 화살표 하나가 경로 전체가 아니라 출발점 부근의 짧은 구간(전체 길이의 SPAN_FROM~SPAN_TO)만
// 천천히 오가며 "여기서 이쪽으로 출발" 방향을 알려준다. 구간 끝에 닿으면 시작으로 되돌아가 반복.
const SPAN_FROM_FRAC = 0.05;
const SPAN_TO_FRAC = 0.22;
const SWEEP_MS = 3200; // 짧은 구간을 이 시간에 걸쳐 한 번 훑음 — 느긋하게
const FRAME_MS = 80;

/**
 * 경로 진행 방향을 "출발점 부근을 천천히 오가는 큰 화살표 하나"로 보여준다 — 산책 준비 화면(overview)
 * 에서 실선 경로 위에 겹쳐 그린다. 산책 중 화면은 진행/미진행 색 구분 + 사용자 퍽이 방향을 알려주므로
 * 여기선 쓰지 않는다.
 */
export function RouteDirectionFlow({ route }: Props) {
  const totalKm = useMemo(() => polylineLengthKm(route), [route]);
  const fromKm = totalKm * SPAN_FROM_FRAC;
  const toKm = totalKm * SPAN_TO_FRAC;
  const [distanceKm, setDistanceKm] = useState(fromKm);

  useEffect(() => {
    if (route.length < 2 || totalKm === 0) return;
    setDistanceKm(fromKm);
    const stepKm = ((toKm - fromKm) * FRAME_MS) / SWEEP_MS;
    const timer = setInterval(
      () => setDistanceKm(d => (d + stepKm > toKm ? fromKm : d + stepKm)),
      FRAME_MS,
    );
    return () => clearInterval(timer);
  }, [route.length, totalKm, fromKm, toKm]);

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
