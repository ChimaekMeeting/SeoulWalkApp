/**
 * useTurnByTurn: route가 바뀌지 않는 한 buildTurnSteps가 다시 계산되지 않는지, routeProgressKm이
 * 올라갈 때마다 다음 턴이 올바르게 갱신되는지, 턴 지점 근처에서 진동이 스텝당 한 번만 울리는지 검증.
 * useWalkProgress.test.tsx와 같은 Probe + react-test-renderer 패턴.
 */
import React from 'react';
import { Vibration } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { useTurnByTurn } from '../useTurnByTurn';
import * as turnByTurnUtils from '../../utils/turnByTurn';
import { WalkRouteResponse } from '../../types/prewalk';

// 북쪽으로 350m 가다가 동쪽으로 90도 우회전해 300m 더 가는 경로 — 우회전 1개 + arrive.
const ROUTE: WalkRouteResponse['coordinates'] = [
  [37.5, 127.0],
  [37.5031, 127.0],
  [37.5031, 127.0038],
];

type HookResult = ReturnType<typeof useTurnByTurn>;

function renderProbe(initialProgressKm: number) {
  const box: { current: HookResult } = { current: null as never };
  function Probe({ progressKm }: { progressKm: number }) {
    box.current = useTurnByTurn(ROUTE, progressKm);
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Probe progressKm={initialProgressKm} />);
  });
  return {
    box,
    rerender: (progressKm: number) =>
      ReactTestRenderer.act(() => renderer.update(<Probe progressKm={progressKm} />)),
    unmount: () => ReactTestRenderer.act(() => renderer.unmount()),
  };
}

let buildSpy: jest.SpyInstance;
let vibrateSpy: jest.SpyInstance;
beforeEach(() => {
  buildSpy = jest.spyOn(turnByTurnUtils, 'buildTurnSteps');
  vibrateSpy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
});
afterEach(() => {
  buildSpy.mockRestore();
  vibrateSpy.mockRestore();
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

it('route가 안 바뀌면 buildTurnSteps를 다시 호출하지 않는다', () => {
  const { rerender, unmount } = renderProbe(0);
  expect(buildSpy).toHaveBeenCalledTimes(1);
  rerender(0.1);
  rerender(0.2);
  expect(buildSpy).toHaveBeenCalledTimes(1);
  unmount();
});

it('턴 지점 15m 이내로 들어오면 한 번만 진동한다', () => {
  const { rerender, unmount } = renderProbe(0.34); // 턴(atKm≈0.35)까지 약 10m
  expect(vibrateSpy).toHaveBeenCalledTimes(1);

  rerender(0.345); // 같은 턴에 더 가까워짐 — 다시 울리지 않음
  expect(vibrateSpy).toHaveBeenCalledTimes(1);

  rerender(0); // 다시 멀어져도(비정상 케이스) 이미 울린 스텝이면 재울림 없음
  expect(vibrateSpy).toHaveBeenCalledTimes(1);
  unmount();
});

it('모든 턴을 지나 다음 스텝이 없으면 진동하지 않는다', () => {
  const { unmount } = renderProbe(10); // 경로 끝을 훨씬 지남
  expect(vibrateSpy).not.toHaveBeenCalled();
  unmount();
});
