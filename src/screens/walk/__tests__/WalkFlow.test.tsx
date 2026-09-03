/**
 * WalkFlow: prep 단계에선 tracker를 든 WalkInProgressScreen이 아예 마운트되지 않고,
 * "산책 시작" 이후엔 그 시점의 경로로 고정된다(산책 중 스냅 교체 무시)는 것을 검증.
 * 자식 화면은 props만 기록하는 스텁으로 갈아끼운다(Mapbox 등 무거운 의존성 회피).
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const calls: Record<string, any> = {};

jest.mock('../WalkPrepScreen', () => ({
  WalkPrepScreen: (p: any) => {
    calls.prep = p;
    return null;
  },
}));
jest.mock('../WalkInProgressScreen', () => ({
  WalkInProgressScreen: (p: any) => {
    calls.walk = p;
    return null;
  },
}));
jest.mock('../WalkCompleteScreen', () => ({
  WalkCompleteScreen: (p: any) => {
    calls.complete = p;
    return null;
  },
}));
jest.mock('../WalkEndConfirmModal', () => ({ WalkEndConfirmModal: () => null }));
jest.mock('../../../hooks/useAndroidBackHandler', () => ({ useAndroidBackHandler: () => {} }));

import { WalkFlow } from '../WalkFlow';
import { WalkRouteResponse } from '../../../types/prewalk';

const mkRoute = (id: number): WalkRouteResponse =>
  ({
    id,
    total_km: 1,
    mode: 'loop',
    coordinates: [
      [37.5, 127.0],
      [37.5, 127.01],
    ],
  }) as unknown as WalkRouteResponse;

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

function mount(route: WalkRouteResponse, snapPending = false) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <WalkFlow
        routeResult={route}
        currentLocation={null}
        routeSnapPending={snapPending}
        onExitToHome={jest.fn()}
      />,
    );
  });
  return renderer;
}

it('prep 단계에서는 WalkInProgressScreen(=tracker)이 마운트되지 않고, snapPending이 전달된다', () => {
  mount(mkRoute(1), true);
  expect(calls.prep).toBeDefined();
  expect(calls.prep.snapPending).toBe(true);
  expect(calls.walk).toBeUndefined();
});

it('"산책 시작" 이후 부모가 경로를 교체해도 walking 화면은 시작 시점 경로로 고정된다', () => {
  const r1 = mkRoute(1);
  const r2 = mkRoute(2);
  const renderer = mount(r1);

  ReactTestRenderer.act(() => calls.prep.onStart(r1.coordinates));
  expect(calls.walk).toBeDefined();
  expect(calls.walk.routeResult).toBe(r1);

  // 스냅 완료로 부모의 routeResult가 r2로 바뀌어도 walking 화면은 r1 유지.
  ReactTestRenderer.act(() => {
    renderer.update(
      <WalkFlow
        routeResult={r2}
        currentLocation={null}
        routeSnapPending={false}
        onExitToHome={jest.fn()}
      />,
    );
  });
  expect(calls.walk.routeResult).toBe(r1);
});

it('산책 준비 화면에서 순환 코스 방향을 반대로 골랐으면(onStart에 다른 좌표 배열) 그 좌표로 산책이 시작된다', () => {
  const r1 = mkRoute(1);
  const reversedCoords = [...r1.coordinates].reverse();
  mount(r1);

  ReactTestRenderer.act(() => calls.prep.onStart(reversedCoords));
  expect(calls.walk.routeResult.coordinates).toBe(reversedCoords);
  // 좌표만 바뀌고 나머지 필드(총 거리·모드 등)는 원본 routeResult 그대로 유지된다.
  expect(calls.walk.routeResult.total_km).toBe(r1.total_km);
  expect(calls.walk.routeResult.mode).toBe(r1.mode);
});
