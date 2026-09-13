import { useEffect, useMemo, useRef } from 'react';
import { Vibration } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { WalkRouteResponse } from '../types/prewalk';
import {
  TurnStep,
  buildTurnSteps,
  findNextTurnStep,
  formatTurnInstruction,
  TURN_IMMEDIATE_KM,
} from '../utils/turnByTurn';
import { activeWalkSession } from '../utils/activeWalkSession';
import { TURN_BY_TURN_LOCATION_TASK } from '../tasks/turnByTurnBackgroundTask';

// 최종("지금 OO회전") 안내 거리 — turnByTurn.ts가 문구를 "지금"으로 바꾸는 거리와 같다(진동·TTS가
// "지금"이라고 말하는 순간과 문구가 어긋나면 안 되므로 같은 상수를 그대로 쓴다).
export const TURN_VIBRATE_DISTANCE_KM = TURN_IMMEDIATE_KM;
// 헤드업(먼 거리, 음성만) 안내 거리 — 도보 속도(시속 4~5km) 기준 2분 남짓 여유를 준다.
export const TURN_HEADS_UP_DISTANCE_KM = 0.15; // 150m

export interface TurnByTurnInfo {
  step: TurnStep | null;
  distanceToKm: number;
}

/**
 * route에서 턴 지점을 한 번 계산해두고(route는 WalkFlow가 walking 진입 시 얼린 값이라 참조가
 * 안정적 — useMemo가 route가 바뀔 때만 다시 계산), routeProgressKm이 지날 때마다 다음 턴과
 * 남은 거리를 돌려준다. 두 단계로 안내한다 — 스텝별로 각각 한 번만(ref 2개로 중복 방지):
 *  1) TURN_HEADS_UP_DISTANCE_KM 이내: 음성으로 "OOOm 앞 우회전" 미리 안내.
 *  2) TURN_VIBRATE_DISTANCE_KM 이내: 진동 + 음성으로 "지금 우회전". activeWalkSession에
 *     lastAnnouncedAtKm을 기록해 백그라운드 태스크(turnByTurnBackgroundTask.ts)와 중복 안내를
 *     피한다 — 화면이 꺼져 백그라운드로 넘어가는 순간 같은 턴을 또 안내하지 않게.
 *
 * backgroundEnabled가 true면(사용자가 BackgroundGuidancePrompt에서 동의 + 권한 허용) 걷는 동안
 * expo-task-manager 백그라운드 위치 태스크를 시작해 화면이 꺼지거나 앱이 백그라운드로 가도 안내가
 * 이어지게 한다. false면(권한 없음/거부) 이 훅은 useWatchLocation(포그라운드 watch) 갱신에만
 * 반응하는 Phase A 그대로다.
 */
export function useTurnByTurn(
  route: WalkRouteResponse['coordinates'],
  routeProgressKm: number,
  backgroundEnabled = false,
): TurnByTurnInfo {
  const steps = useMemo(() => buildTurnSteps(route), [route]);
  const step = useMemo(() => findNextTurnStep(steps, routeProgressKm), [steps, routeProgressKm]);
  const distanceToKm = step ? Math.max(0, step.atKm - routeProgressKm) : 0;

  const headsUpAtKmRef = useRef<number | null>(null);
  const finalAtKmRef = useRef<number | null>(null);

  useEffect(() => {
    if (!step || distanceToKm > TURN_HEADS_UP_DISTANCE_KM) return;
    if (headsUpAtKmRef.current === step.atKm) return;
    headsUpAtKmRef.current = step.atKm;
    Speech.speak(formatTurnInstruction(step.kind, distanceToKm), { language: 'ko-KR' });
  }, [step, distanceToKm]);

  useEffect(() => {
    if (!step || distanceToKm > TURN_VIBRATE_DISTANCE_KM) return;
    if (finalAtKmRef.current === step.atKm) return;
    finalAtKmRef.current = step.atKm;
    Vibration.vibrate(200);
    Speech.speak(formatTurnInstruction(step.kind, distanceToKm), { language: 'ko-KR' });
    activeWalkSession.update({ lastAnnouncedAtKm: step.atKm });
  }, [step, distanceToKm]);

  // 산책 세션 생명주기 — route가 바뀌지 않는 한(=산책 한 번) 마운트 시 1회 시작, 언마운트 시 정리.
  // 백그라운드 태스크(turnByTurnBackgroundTask.ts)가 React 트리 밖에서 읽을 수 있는 유일한 통로.
  useEffect(() => {
    activeWalkSession.write({
      route,
      lastAnnouncedAtKm: null,
      lastNotifiedAtKm: null,
      startedAt: Date.now(),
    });
    return () => {
      activeWalkSession.clear();
    };
  }, [route]);

  // 백그라운드 위치 태스크 — 켜지면 시작, 꺼지거나(권한 철회 등) 언마운트되면 중지.
  // stopLocationUpdatesAsync는 태스크가 시작 안 된 상태에서 불러도 거부만 될 뿐이라 그냥 무시한다
  // (startLocationUpdatesAsync 완료 여부를 별도로 추적하지 않아도 안전).
  useEffect(() => {
    if (!backgroundEnabled) return;
    Location.startLocationUpdatesAsync(TURN_BY_TURN_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 10,
      foregroundService: {
        notificationTitle: '산책 안내 중',
        notificationBody: '경로를 벗어나지 않도록 안내를 이어가는 중이에요.',
      },
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
    }).catch(err => console.warn('[useTurnByTurn] 백그라운드 위치 시작 실패:', err));

    return () => {
      Location.stopLocationUpdatesAsync(TURN_BY_TURN_LOCATION_TASK).catch(() => {});
    };
  }, [backgroundEnabled]);

  return { step, distanceToKm };
}
