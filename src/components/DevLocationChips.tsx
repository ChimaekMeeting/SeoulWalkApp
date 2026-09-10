import React from 'react';
import { DevChip } from './DevChip';
import { WalkRouteResponse } from '../types/prewalk';
import { setDevLocationOverride } from '../config/devLocationOverride';
import { useDevLocationOverride } from '../hooks/useDevLocationOverride';
import { pointAlongRouteFraction } from '../utils/geo';

interface Props {
  /** GPS 오버라이드 지점을 뽑을 경로(보통 산책 대상 순환 코스). */
  routeCoords: WalkRouteResponse['coordinates'];
}

// 경로 시작점부터의 진행 비율. 순환 코스면 저장된 출발점에서 각각 이만큼 떨어진 경로 위 지점.
const FRACTIONS = [0.25, 0.5, 0.75] as const;

/**
 * 개발 빌드 전용 — 실제 GPS 대신 경로상의 25/50/75% 지점으로 위치를 덮어써, 순환 코스 시작점
 * 재정렬(startWalk의 anchorLoopToPoint)·경로 이탈·재매칭 동작을 눈으로 확인한다. "실제 GPS" 칩으로
 * 오버라이드를 해제한다. `__DEV__`가 아니면 아무것도 렌더하지 않는다.
 *
 * 칩들만(래퍼 View 없이) 렌더하므로 배치는 쓰는 쪽에서 정한다.
 */
export function DevLocationChips({ routeCoords }: Props) {
  const override = useDevLocationOverride();
  if (!__DEV__) return null;

  const isActive = (pt: [number, number] | null) =>
    pt != null &&
    override != null &&
    override.latitude === pt[0] &&
    override.longitude === pt[1];

  return (
    <>
      {FRACTIONS.map(fraction => {
        const pt = pointAlongRouteFraction(routeCoords, fraction);
        return (
          <DevChip
            key={fraction}
            label={`${isActive(pt) ? '● ' : ''}GPS ${fraction * 100}%`}
            onPress={() => {
              if (pt) setDevLocationOverride({ latitude: pt[0], longitude: pt[1] });
            }}
          />
        );
      })}
      <DevChip
        label={`${override == null ? '● ' : ''}실제 GPS`}
        onPress={() => setDevLocationOverride(null)}
      />
    </>
  );
}
