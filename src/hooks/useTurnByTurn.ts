import { useEffect, useMemo, useRef } from 'react';
import { Vibration } from 'react-native';
import { WalkRouteResponse } from '../types/prewalk';
import { TurnStep, buildTurnSteps, findNextTurnStep } from '../utils/turnByTurn';

// 이 거리(km) 안으로 들어오면 "지금 꺾어야 함" — 짧게 진동 1회.
export const TURN_VIBRATE_DISTANCE_KM = 0.015; // 15m

export interface TurnByTurnInfo {
  step: TurnStep | null;
  distanceToKm: number;
}

/**
 * route에서 턴 지점을 한 번 계산해두고(route는 WalkFlow가 walking 진입 시 얼린 값이라 참조가
 * 안정적 — useMemo가 route가 바뀔 때만 다시 계산), routeProgressKm이 지날 때마다 다음 턴과
 * 남은 거리를 돌려준다. 턴 지점 TURN_VIBRATE_DISTANCE_KM 이내로 처음 들어오는 순간 짧게 진동 1회
 * (스텝별로 한 번만 — ref로 이미 울린 스텝을 기억해 중복 방지, useWalkProgress의 fixKey 중복 방지와
 * 같은 패턴).
 *
 * 화면 안내(Phase A) 전용 — GPS는 useWatchLocation(포그라운드 watch)을 그대로 쓰므로 앱이
 * 백그라운드로 가면(화면 꺼짐 포함) 이 훅도 더는 갱신되지 않는다. 백그라운드에서도 안내가 이어지게
 * 하려면 별도로 expo-task-manager 기반 백그라운드 위치 추적이 필요하다(Phase B, 새 네이티브
 * 의존성 필요 — 아직 미구현).
 */
export function useTurnByTurn(
  route: WalkRouteResponse['coordinates'],
  routeProgressKm: number,
): TurnByTurnInfo {
  const steps = useMemo(() => buildTurnSteps(route), [route]);
  const step = useMemo(() => findNextTurnStep(steps, routeProgressKm), [steps, routeProgressKm]);
  const distanceToKm = step ? Math.max(0, step.atKm - routeProgressKm) : 0;

  const vibratedAtKmRef = useRef<number | null>(null);
  useEffect(() => {
    if (!step || distanceToKm > TURN_VIBRATE_DISTANCE_KM) return;
    if (vibratedAtKmRef.current === step.atKm) return;
    vibratedAtKmRef.current = step.atKm;
    Vibration.vibrate(200);
  }, [step, distanceToKm]);

  return { step, distanceToKm };
}
