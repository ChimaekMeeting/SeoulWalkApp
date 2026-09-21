/**
 * WalkFlow: prep 단계에선 tracker를 든 WalkInProgressScreen이 아예 마운트되지 않고,
 * "산책 시작" 이후엔 그 시점의 경로로 고정된다(산책 중 스냅 교체 무시)는 것을 검증.
 * 자식 화면은 props만 기록하는 스텁으로 갈아끼운다(Mapbox 등 무거운 의존성 회피).
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const calls: Record<string, any> = {};

const mockSubmitRouteFeedback = jest.fn();
jest.mock('../../../api/routes', () => ({
  submitRouteFeedback: (...args: any[]) => mockSubmitRouteFeedback(...args),
}));

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
jest.mock('../WalkRatingScreen', () => ({
  WalkRatingScreen: (p: any) => {
    calls.rating = p;
    return null;
  },
}));
jest.mock('../WalkEndConfirmModal', () => ({
  WalkEndConfirmModal: (p: any) => {
    if (p.visible) calls.endModal = p;
    return null;
  },
}));
let backHandler: () => boolean = () => true;
jest.mock('../../../hooks/useAndroidBackHandler', () => ({
  useAndroidBackHandler: (fn: () => boolean) => {
    backHandler = fn;
  },
}));
// 실제 expo-location/expo-notifications를 끌어오면 이 orchestration 테스트가 네이티브 모듈
// 부재로 깨진다 — WalkFlow는 이 훅의 결과만 prep/walking 화면에 나눠 내려줄 뿐이라 스텁으로 충분.
const mockBgPermission = {
  status: 'undetermined' as const,
  granted: false,
  refresh: jest.fn(),
  request: jest.fn(),
  openSettings: jest.fn(),
};
jest.mock('../../../hooks/useBackgroundLocationPermission', () => ({
  useBackgroundLocationPermission: () => mockBgPermission,
}));

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
  mockSubmitRouteFeedback.mockReset();
  mockSubmitRouteFeedback.mockResolvedValue({ status: 'success' });
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

it('백그라운드 위치 권한은 prep 화면에서 요청하고, 그 결과(granted)를 walking 화면까지 그대로 들고 간다', () => {
  const r1 = mkRoute(1);
  mount(r1);

  expect(calls.prep.bgPermissionStatus).toBe('undetermined');
  calls.prep.onAllowBackgroundLocation();
  expect(mockBgPermission.request).toHaveBeenCalledTimes(1);

  ReactTestRenderer.act(() => calls.prep.onStart(r1.coordinates));
  expect(calls.walk.backgroundLocationGranted).toBe(mockBgPermission.granted);
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

it('완료 화면의 별점은 서버에 저장된 뒤 onExitToHome을 부른다', async () => {
  const onExit = jest.fn();
  const r1 = mkRoute(1);
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <WalkFlow
        routeResult={r1}
        currentLocation={null}
        routeSnapPending={false}
        onExitToHome={onExit}
      />,
    );
  });

  ReactTestRenderer.act(() => calls.prep.onStart(r1.coordinates));
  ReactTestRenderer.act(() =>
    calls.walk.onRequestEnd({ endReason: 'user_ended_before_destination', elapsedMs: 1000 }),
  );
  ReactTestRenderer.act(() => calls.endModal.onConfirm());
  expect(calls.complete).toBeDefined();

  // "산책로 평가하기" → 홈이 아니라 별점 화면으로.
  ReactTestRenderer.act(() => calls.complete.onNext());
  expect(onExit).not.toHaveBeenCalled();
  expect(calls.rating).toBeDefined();

  // 별점 제출 → API 저장이 끝난 뒤 홈으로.
  await ReactTestRenderer.act(async () => {
    await calls.rating.onSubmit({ safety: 4, comfort: 3, overall: 4 });
  });
  expect(mockSubmitRouteFeedback).toHaveBeenCalledWith(1, {
    rating_safety: 4,
    rating_comfort: 3,
    rating_overall: 4,
  });
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(onExit.mock.calls[0][0]).toMatchObject({ reason: 'ended_early' });
});

it('별점 저장이 실패하면 홈으로 나가지 않고 재시도 오류를 보여준다', async () => {
  mockSubmitRouteFeedback.mockRejectedValueOnce(new Error('network'));
  const onExit = jest.fn();
  const r1 = mkRoute(1);
  mount(r1);
  ReactTestRenderer.act(() => calls.prep.onStart(r1.coordinates));
  ReactTestRenderer.act(() => calls.walk.onRequestEnd({ endReason: 'user_ended_before_destination', elapsedMs: 1000 }));
  ReactTestRenderer.act(() => calls.endModal.onConfirm());
  ReactTestRenderer.act(() => calls.complete.onNext());

  await ReactTestRenderer.act(async () => {
    await calls.rating.onSubmit({ safety: 4, comfort: 3, overall: 4 });
  });

  expect(onExit).not.toHaveBeenCalled();
  expect(calls.rating.errorMessage).toContain('네트워크');
  expect(calls.rating.onSkip).toEqual(expect.any(Function));
});

it('완료 화면에서 평가 없이 나가기와 안드로이드 뒤로가기는 홈으로 이동한다', () => {
  const onExit = jest.fn();
  const r1 = mkRoute(1);
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <WalkFlow
        routeResult={r1}
        currentLocation={null}
        routeSnapPending={false}
        onExitToHome={onExit}
      />,
    );
  });

  ReactTestRenderer.act(() => calls.prep.onStart(r1.coordinates));
  ReactTestRenderer.act(() =>
    calls.walk.onRequestEnd({ endReason: 'user_ended_before_destination', elapsedMs: 1000 }),
  );
  ReactTestRenderer.act(() => calls.endModal.onConfirm());
  expect(calls.complete).toBeDefined();

  expect(calls.complete.onExit).toEqual(expect.any(Function));
  ReactTestRenderer.act(() => calls.complete.onExit());
  expect(onExit).toHaveBeenCalledTimes(1);

  // 완료 화면에서 안드로이드 뒤로가기도 같은 선택적 종료로 처리한다.
  ReactTestRenderer.act(() => {
    backHandler();
  });
  expect(onExit).toHaveBeenCalledTimes(2);
  expect(calls.rating).toBeUndefined();
});
