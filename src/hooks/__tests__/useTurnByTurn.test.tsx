/**
 * useTurnByTurn: route가 바뀌지 않는 한 resolveTurnSteps가 다시 계산되지 않는지, routeProgressKm이
 * 올라갈 때마다 다음 턴이 올바르게 갱신되는지, 헤드업/최종 두 단계 음성 안내와 진동이 스텝당 한 번씩만
 * 울리는지, backgroundEnabled가 켜지면 백그라운드 위치 태스크를 시작/정리하는지 검증.
 * maneuvers 인자(백엔드 턴바이턴 데이터) 자체의 변환 로직은 utils/turnByTurn.test.ts에서 검증하고,
 * 여기서는 훅이 그 인자를 resolveTurnSteps에 그대로 전달하는지만 확인한다.
 * useWalkProgress.test.tsx와 같은 Probe + react-test-renderer 패턴.
 */
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-speech', () => ({ speak: jest.fn() }));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import React from 'react';
import { Vibration } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import ReactTestRenderer from 'react-test-renderer';
import { useTurnByTurn } from '../useTurnByTurn';
import * as turnByTurnUtils from '../../utils/turnByTurn';
import { Maneuver, WalkRouteResponse } from '../../types/prewalk';

// 북쪽으로 350m 가다가 동쪽으로 90도 우회전해 300m 더 가는 경로 — 우회전 1개 + arrive.
const ROUTE: WalkRouteResponse['coordinates'] = [
  [37.5, 127.0],
  [37.5031, 127.0],
  [37.5031, 127.0038],
];

type HookResult = ReturnType<typeof useTurnByTurn>;

function renderProbe(
  initialProgressKm: number,
  backgroundEnabled = false,
  maneuvers?: Maneuver[] | null,
) {
  const box: { current: HookResult } = { current: null as never };
  function Probe({ progressKm, bg }: { progressKm: number; bg: boolean }) {
    box.current = useTurnByTurn(ROUTE, progressKm, bg, maneuvers);
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <Probe progressKm={initialProgressKm} bg={backgroundEnabled} />,
    );
  });
  return {
    box,
    rerender: (progressKm: number, bg = backgroundEnabled) =>
      ReactTestRenderer.act(() =>
        renderer.update(<Probe progressKm={progressKm} bg={bg} />),
      ),
    unmount: () => ReactTestRenderer.act(() => renderer.unmount()),
  };
}

let buildSpy: jest.SpyInstance;
let vibrateSpy: jest.SpyInstance;
let speakSpy: jest.SpyInstance;
beforeEach(() => {
  buildSpy = jest.spyOn(turnByTurnUtils, 'resolveTurnSteps');
  vibrateSpy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
  speakSpy = jest.spyOn(Speech, 'speak').mockImplementation(() => {});
});
afterEach(() => {
  buildSpy.mockRestore();
  vibrateSpy.mockRestore();
  speakSpy.mockRestore();
  jest.clearAllMocks();
});

it('진행률이 오르면 다음 턴과 남은 거리가 갱신된다', () => {
  const { box, rerender, unmount } = renderProbe(0);
  expect(box.current.step?.kind).toBe('right');
  expect(box.current.distanceToKm).toBeGreaterThan(0);

  rerender(0.2);
  expect(box.current.step?.kind).toBe('right'); // 아직 턴 전
  const before = box.current.distanceToKm;

  rerender(0.34);
  expect(box.current.distanceToKm).toBeLessThan(before);

  rerender(0.5); // 턴을 지남
  expect(box.current.step?.kind).toBe('arrive');
  unmount();
});

it('route가 안 바뀌면 resolveTurnSteps를 다시 호출하지 않는다', () => {
  const { rerender, unmount } = renderProbe(0);
  expect(buildSpy).toHaveBeenCalledTimes(1);
  rerender(0.1);
  rerender(0.2);
  expect(buildSpy).toHaveBeenCalledTimes(1);
  unmount();
});

it('maneuvers를 넘기면 route 기하 계산 대신 그 값을 쓴다', () => {
  // route 기하로는 우회전(atKm≈0.35)이지만, maneuvers가 좌회전을 지정하면 그게 이겨야 한다.
  const maneuvers: Maneuver[] = [
    {
      sequence: 0,
      type: 'start',
      instruction: '출발하세요.',
      location: ROUTE[0],
      node_id: null,
      distance_from_start_m: 0,
      distance_to_maneuver_m: 0,
      bearing_before_deg: null,
      bearing_after_deg: 0,
      turn_angle_deg: null,
    },
    {
      sequence: 1,
      type: 'left',
      instruction: '왼쪽으로 방향을 전환하세요.',
      location: ROUTE[1],
      node_id: null,
      distance_from_start_m: 350,
      distance_to_maneuver_m: 350,
      bearing_before_deg: 0,
      bearing_after_deg: 270,
      turn_angle_deg: 90,
    },
    {
      sequence: 2,
      type: 'arrive',
      instruction: '도착했습니다.',
      location: ROUTE[2],
      node_id: null,
      distance_from_start_m: 650,
      distance_to_maneuver_m: 300,
      bearing_before_deg: 270,
      bearing_after_deg: null,
      turn_angle_deg: null,
    },
  ];
  const { box, unmount } = renderProbe(0, false, maneuvers);
  expect(box.current.step?.kind).toBe('left');
  expect(box.current.step?.atKm).toBeCloseTo(0.35, 5);
  unmount();
});

it('150m 이내로 들어오면 헤드업 음성이 스텝당 한 번만 나온다', () => {
  const { rerender, unmount } = renderProbe(0.19); // 턴(atKm≈0.35)까지 약 160m
  expect(speakSpy).not.toHaveBeenCalled();

  rerender(0.21); // 약 140m — 헤드업 범위 진입
  expect(speakSpy).toHaveBeenCalledTimes(1);

  rerender(0.22); // 아직 같은 턴, 계속 다가감 — 재발화 없음
  expect(speakSpy).toHaveBeenCalledTimes(1);
  unmount();
});

it('헤드업 이후 15m 이내로 들어오면 진동 + 최종 음성이 추가로 한 번 더 나온다', () => {
  const { rerender, unmount } = renderProbe(0.1); // 멀리서 시작 — 아직 아무 것도 안 울림
  expect(vibrateSpy).not.toHaveBeenCalled();
  expect(speakSpy).not.toHaveBeenCalled();

  rerender(0.21); // 헤드업 범위(150m) 진입 — 음성 1회
  expect(speakSpy).toHaveBeenCalledTimes(1);
  expect(vibrateSpy).not.toHaveBeenCalled();

  rerender(0.34); // 최종 범위(15m) 진입 — 진동 + 음성 추가 1회
  expect(vibrateSpy).toHaveBeenCalledTimes(1);
  expect(speakSpy).toHaveBeenCalledTimes(2);

  rerender(0.345); // 같은 턴에 더 가까워짐 — 다시 울리지 않음
  expect(vibrateSpy).toHaveBeenCalledTimes(1);
  expect(speakSpy).toHaveBeenCalledTimes(2);

  rerender(0); // 다시 멀어져도(비정상 케이스) 이미 울린 스텝이면 재울림 없음
  expect(vibrateSpy).toHaveBeenCalledTimes(1);
  unmount();
});

it('모든 턴을 지나 다음 스텝이 없으면 진동·음성 모두 없다', () => {
  const { unmount } = renderProbe(10); // 경로 끝을 훨씬 지남
  expect(vibrateSpy).not.toHaveBeenCalled();
  expect(speakSpy).not.toHaveBeenCalled();
  unmount();
});

it('backgroundEnabled가 true면 마운트 시 백그라운드 위치 태스크를 시작하고, false로 꺼지거나 언마운트되면 중지한다', () => {
  const startSpy = Location.startLocationUpdatesAsync as jest.Mock;
  const stopSpy = Location.stopLocationUpdatesAsync as jest.Mock;

  const { rerender, unmount } = renderProbe(0, true);
  expect(startSpy).toHaveBeenCalledTimes(1);
  expect(stopSpy).not.toHaveBeenCalled();

  rerender(0.1, false); // 권한 철회 등으로 꺼짐 — 정리돼야 함
  expect(stopSpy).toHaveBeenCalledTimes(1);

  rerender(0.1, true); // 다시 켜짐 — 재시작
  expect(startSpy).toHaveBeenCalledTimes(2);

  unmount(); // 마운트 상태로 언마운트 — 한 번 더 정리
  expect(stopSpy).toHaveBeenCalledTimes(2);
});

it('backgroundEnabled가 false면 백그라운드 위치 태스크를 시작하지 않는다', () => {
  const startSpy = Location.startLocationUpdatesAsync as jest.Mock;
  const { unmount } = renderProbe(0, false);
  expect(startSpy).not.toHaveBeenCalled();
  unmount();
});
