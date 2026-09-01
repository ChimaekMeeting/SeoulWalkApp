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
  getForegroundPermissionsAsync: jest.fn(),
}));
jest.mock('../../config/debugLocation', () => ({
  DEBUG_FIXED_COORDS: null,
  HAS_DEBUG_FIXED_LOCATION: false,
}));

import { useLocation, UseLocationResult } from '../useLocation';

const mockGetPosition = Location.getCurrentPositionAsync as jest.Mock;
const mockGetPermissions = Location.getForegroundPermissionsAsync as jest.Mock;

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
  return {
    result,
    unmount: () => ReactTestRenderer.act(() => renderer.unmount()),
  };
}

const flush = () => ReactTestRenderer.act(async () => { await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPermissions.mockResolvedValue({ status: 'granted' });
});

it('좌표 획득 성공 → coords 설정, 로딩 종료, error 없음', async () => {
  mockGetPosition.mockResolvedValue({ coords: { latitude: 37.5, longitude: 127 } });
  const { result } = renderUseLocation();
  expect(result.current.isLoading).toBe(true);
  await flush();
  expect(result.current.coords).toEqual({ latitude: 37.5, longitude: 127 });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeNull();
});

it('GPS 실패 → error "unavailable", coords는 null 유지', async () => {
  mockGetPosition.mockRejectedValue(new Error('location unavailable'));
  const { result } = renderUseLocation();
  await flush();
  expect(result.current.coords).toBeNull();
  expect(result.current.error).toBe('unavailable');
  expect(result.current.isLoading).toBe(false);
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
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();
  });
  expect(result.current.error).toBe('timeout');
  jest.useRealTimers();
});

it('enabled=false면 OS 호출 없이 error "permission_denied"', async () => {
  const { result } = renderUseLocation(false);
  await flush();
  expect(mockGetPosition).not.toHaveBeenCalled();
  expect(result.current.error).toBe('permission_denied');
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
