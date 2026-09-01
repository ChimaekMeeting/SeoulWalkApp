/**
 * useLocation: 좌표 획득 실패를 조용히 삼키지 않는지 검증.
 * expo-location을 목으로 갈아끼우고, 훅을 얇은 테스트 컴포넌트로 감싸 상태 전이를 관찰한다.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import * as Location from 'expo-location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
}));
jest.mock('../../config/debugLocation', () => ({
  DEBUG_FIXED_COORDS: null,
}));

import { useLocation, UseLocationResult } from '../useLocation';

const mockGetPosition = Location.getCurrentPositionAsync as jest.Mock;
const mockGetLastKnown = Location.getLastKnownPositionAsync as jest.Mock;
const mockGetPermissions = Location.getForegroundPermissionsAsync as jest.Mock;

// 마운트된 렌더러를 추적해 afterEach에서 언마운트한다 — useLocation의 자동 재시도
// setTimeout이 테스트 종료 후에도 살아남아 워커가 안 죽는 걸 막는다.
let mounted: ReactTestRenderer.ReactTestRenderer | null = null;

function renderUseLocation(enabled = true) {
  const result: { current: UseLocationResult } = { current: null as never };
  function Probe() {
    result.current = useLocation({ enabled });
    return null;
  }
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Probe />);
  });
  mounted = renderer!;
  return {
    result,
    unmount: () => {
      ReactTestRenderer.act(() => renderer.unmount());
      if (mounted === renderer) mounted = null;
    },
  };
}

const flush = () => ReactTestRenderer.act(async () => { await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetLastKnown.mockResolvedValue(null);
  mockGetPermissions.mockResolvedValue({ status: 'granted' });
});

afterEach(() => {
  if (mounted) {
    const renderer = mounted;
    ReactTestRenderer.act(() => renderer.unmount());
    mounted = null;
  }
});

it('좌표 획득 성공 → coords 설정, 로딩 종료, error 없음', async () => {
  mockGetPosition.mockResolvedValue({ coords: { latitude: 37.5, longitude: 127 } });
  const { result } = renderUseLocation();
  expect(result.current.isLoading).toBe(true);
  await flush();
  expect(result.current.coords).toEqual({ latitude: 37.5, longitude: 127 });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeNull();
  expect(result.current.status).toBe('current');
});

it('GPS 실패 + last known 없음 → error "unavailable", status "error", coords null 유지', async () => {
  mockGetPosition.mockRejectedValue(new Error('location unavailable'));
  const { result } = renderUseLocation();
  await flush();
  expect(result.current.coords).toBeNull();
  expect(result.current.error).toBe('unavailable');
  expect(result.current.status).toBe('error');
  expect(result.current.isLoading).toBe(false);
});

it('정밀 조회 실패해도 last known 있으면 그 좌표 유지, error는 null이지만 status는 "last_known"(stale 보존)', async () => {
  mockGetLastKnown.mockResolvedValue({ coords: { latitude: 37.4, longitude: 126.9 } });
  mockGetPosition.mockRejectedValue(new Error('location unavailable'));
  const { result } = renderUseLocation();
  await flush();
  expect(result.current.coords).toEqual({ latitude: 37.4, longitude: 126.9 });
  expect(result.current.error).toBeNull();
  expect(result.current.status).toBe('last_known');
  expect(result.current.isLoading).toBe(false);
});

it('last known으로 먼저 이동한 뒤 정밀 좌표로 갱신 → status "current"', async () => {
  mockGetLastKnown.mockResolvedValue({ coords: { latitude: 37.4, longitude: 126.9 } });
  mockGetPosition.mockResolvedValue({ coords: { latitude: 37.5, longitude: 127 } });
  const { result } = renderUseLocation();
  await flush();
  expect(result.current.coords).toEqual({ latitude: 37.5, longitude: 127 });
  expect(result.current.error).toBeNull();
  expect(result.current.status).toBe('current');
});

it('last known 있어도 권한이 취소됐으면 error "permission_denied"', async () => {
  mockGetLastKnown.mockResolvedValue({ coords: { latitude: 37.4, longitude: 126.9 } });
  mockGetPosition.mockRejectedValue(new Error('denied'));
  mockGetPermissions.mockResolvedValue({ status: 'denied' });
  const { result } = renderUseLocation();
  await flush();
  expect(result.current.error).toBe('permission_denied');
});

it('실패 + 권한이 취소된 상태 → error "permission_denied"', async () => {
  mockGetPosition.mockRejectedValue(new Error('denied'));
  mockGetPermissions.mockResolvedValue({ status: 'denied' });
  const { result } = renderUseLocation();
  await flush();
  expect(result.current.error).toBe('permission_denied');
});

it('timeout → error "timeout"', async () => {
  jest.useFakeTimers();
  mockGetPosition.mockReturnValue(new Promise(() => {})); // 영원히 pending
  const { result } = renderUseLocation();
  await ReactTestRenderer.act(async () => {
    // getLastKnownPositionAsync(먼저 await되는 값) 마이크로태스크를 먼저 비워
    // withTimeout의 setTimeout이 등록되게 한 뒤 타이머를 진행시킨다.
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();
  });
  expect(result.current.error).toBe('timeout');
  jest.useRealTimers();
});

it('enabled=false면 OS 호출 없이 error "permission_denied", status "error"', async () => {
  const { result } = renderUseLocation(false);
  await flush();
  expect(mockGetPosition).not.toHaveBeenCalled();
  expect(result.current.error).toBe('permission_denied');
  expect(result.current.status).toBe('error');
  expect(result.current.isLoading).toBe(false);
});

it('retry()로 실패 후 재시도 성공', async () => {
  mockGetPosition.mockRejectedValueOnce(new Error('fail'));
  const { result } = renderUseLocation();
  await flush();
  expect(result.current.error).toBe('unavailable');

  mockGetPosition.mockResolvedValueOnce({ coords: { latitude: 1, longitude: 2 } });
  await ReactTestRenderer.act(async () => {
    await result.current.retry();
  });
  expect(result.current.coords).toEqual({ latitude: 1, longitude: 2 });
  expect(result.current.error).toBeNull();
});

it('진행 중 조회가 있을 때 retry()는 새 조회를 띄우지 않고 그 결과를 await 한다', async () => {
  let resolvePos: (v: unknown) => void = () => {};
  mockGetPosition.mockReturnValueOnce(new Promise(r => { resolvePos = r; }));
  const { result } = renderUseLocation();
  // 최초 조회가 아직 pending인 상태에서 retry()를 부른다.
  let retryResult: unknown;
  await ReactTestRenderer.act(async () => {
    const retryPromise = result.current.retry();
    resolvePos({ coords: { latitude: 5, longitude: 6 } });
    retryResult = await retryPromise;
  });
  // getCurrentPositionAsync는 한 번만 호출됐어야 한다(중복 조회 없음).
  expect(mockGetPosition).toHaveBeenCalledTimes(1);
  expect(retryResult).toEqual({ latitude: 5, longitude: 6 });
  expect(result.current.coords).toEqual({ latitude: 5, longitude: 6 });
});

it('언마운트 후 늦게 도착한 응답은 상태를 건드리지 않는다', async () => {
  let resolvePos: (v: unknown) => void = () => {};
  mockGetPosition.mockReturnValue(new Promise(r => { resolvePos = r; }));
  const { result, unmount } = renderUseLocation();
  const before = result.current;
  unmount();
  await ReactTestRenderer.act(async () => {
    resolvePos({ coords: { latitude: 9, longitude: 9 } });
    await Promise.resolve();
  });
  // 언마운트 후이므로 coords가 갱신되지 않아야 한다(경고도 없어야 함).
  expect(result.current).toBe(before);
  expect(result.current.coords).toBeNull();
});
