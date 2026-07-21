/**
 * 401 자동 재발급 인터셉터 단위 테스트
 *
 * 추가 의존성 없이 Jest + axios 내장 어댑터 교체 방식으로 동작합니다.
 * - expo-secure-store : jest.mock 으로 대체
 * - axios.get (refresh 호출) : jest.spyOn 으로 제어
 * - client 어댑터 : 테스트마다 교체해 401 / 200 을 강제
 */

import axios, { InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';

// 팩토리를 직접 제공해 실제 ESM 모듈을 로드하지 않도록 합니다.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../../config/env', () => ({
  env: { API_BASE_URL: 'http://test.local' },
}));

// client 는 mock 이 등록된 뒤에 import 해야 올바른 baseURL 을 씁니다.
import { client } from '../client';

// ── 타입 편의 ────────────────────────────────────────────────
const mockGetItem = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockSetItem = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

// ── 헬퍼 ────────────────────────────────────────────────────
function make401(config: InternalAxiosRequestConfig) {
  return new axios.AxiosError(
    'Request failed with status code 401',
    'ERR_BAD_RESPONSE',
    config,
    null,
    { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config },
  );
}

function makeOk(config: InternalAxiosRequestConfig, data: unknown = { ok: true }) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

// ── 테스트 ───────────────────────────────────────────────────
describe('401 자동 재발급 인터셉터', () => {
  let originalAdapter: typeof client.defaults.adapter;
  let spyAxiosGet: jest.SpyInstance;

  beforeAll(() => {
    originalAdapter = client.defaults.adapter;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockDeleteItem.mockResolvedValue(undefined);
    // 인터셉터 내부에서 refresh 엔드포인트를 plain axios.get 으로 호출하므로 spyOn 으로 제어
    spyAxiosGet = jest.spyOn(axios, 'get');
  });

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    spyAxiosGet.mockRestore();
  });

  // ── Case 1 ──────────────────────────────────────────────
  test('401 → refresh 성공 → 원래 요청 재시도 → 최종 200 반환', async () => {
    mockGetItem.mockImplementation(async (key) => {
      if (key === 'app_access_token') return 'bad_token';
      if (key === 'app_refresh_token') return 'valid_refresh';
      return null;
    });
    spyAxiosGet.mockResolvedValueOnce({
      data: { status: 'SUCCESS', access_token: 'new_token' },
    });

    let callCount = 0;
    client.defaults.adapter = async (config) => {
      const cfg = config as InternalAxiosRequestConfig;
      callCount++;
      if (callCount === 1) return Promise.reject(make401(cfg)); // 최초 요청: 401
      return makeOk(cfg, { protected: true });                  // 재시도: 200
    };

    const res = await client.get('/api/protected');

    expect(res.data).toEqual({ protected: true });
    expect(callCount).toBe(2); // 최초 시도 + 재시도
    expect(mockSetItem).toHaveBeenCalledWith('app_access_token', 'new_token');
    expect(spyAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('refresh_token'),
      expect.objectContaining({ params: { refresh_token: 'valid_refresh' } }),
    );
  });

  // ── Case 2 ──────────────────────────────────────────────
  test('_retry=true 인 요청이 또 401 이면 재발급 없이 바로 reject (무한 루프 방지)', async () => {
    mockGetItem.mockImplementation(async (key) => {
      if (key === 'app_access_token') return 'bad_token';
      if (key === 'app_refresh_token') return 'valid_refresh';
      return null;
    });
    // refresh 는 성공하지만, 재시도도 401 을 반환하는 시나리오
    spyAxiosGet.mockResolvedValueOnce({
      data: { status: 'SUCCESS', access_token: 'new_token' },
    });

    let callCount = 0;
    client.defaults.adapter = async (config) => {
      callCount++;
      return Promise.reject(make401(config as InternalAxiosRequestConfig));
    };

    await expect(client.get('/api/protected')).rejects.toThrow();

    expect(callCount).toBe(2);            // 최초 + 재시도 1회만
    expect(spyAxiosGet).toHaveBeenCalledTimes(1); // refresh 도 1회만
  });

  // ── Case 3 ──────────────────────────────────────────────
  test('refresh_token 없으면 스토리지 초기화 + auth:forceLogout 이벤트', async () => {
    mockGetItem.mockResolvedValue(null); // 모든 SecureStore 값이 없는 상태
    const spyEmit = jest.spyOn(DeviceEventEmitter, 'emit');

    client.defaults.adapter = async (config) =>
      Promise.reject(make401(config as InternalAxiosRequestConfig));

    await expect(client.get('/api/protected')).rejects.toThrow();

    expect(mockDeleteItem).toHaveBeenCalled();
    expect(spyEmit).toHaveBeenCalledWith('auth:forceLogout');
    expect(spyAxiosGet).not.toHaveBeenCalled(); // refresh 시도 자체를 하지 않음
  });

  // ── Case 4 ──────────────────────────────────────────────
  test('refresh API 가 status: SUCCESS 외 응답 → 스토리지 초기화 + forceLogout', async () => {
    mockGetItem.mockImplementation(async (key) => {
      if (key === 'app_refresh_token') return 'expired_refresh';
      return 'bad_access';
    });
    spyAxiosGet.mockResolvedValueOnce({ data: { status: 'FAIL' } });
    const spyEmit = jest.spyOn(DeviceEventEmitter, 'emit');

    client.defaults.adapter = async (config) =>
      Promise.reject(make401(config as InternalAxiosRequestConfig));

    await expect(client.get('/api/protected')).rejects.toThrow();

    expect(spyEmit).toHaveBeenCalledWith('auth:forceLogout');
    expect(mockDeleteItem).toHaveBeenCalled();
  });

  // ── Case 5 ──────────────────────────────────────────────
  test('refresh API 자체가 네트워크 오류 → 스토리지 초기화 + forceLogout', async () => {
    mockGetItem.mockImplementation(async (key) => {
      if (key === 'app_refresh_token') return 'expired_refresh';
      return 'bad_access';
    });
    spyAxiosGet.mockRejectedValueOnce(new Error('Network Error'));
    const spyEmit = jest.spyOn(DeviceEventEmitter, 'emit');

    client.defaults.adapter = async (config) =>
      Promise.reject(make401(config as InternalAxiosRequestConfig));

    await expect(client.get('/api/protected')).rejects.toThrow();

    expect(spyEmit).toHaveBeenCalledWith('auth:forceLogout');
    expect(mockDeleteItem).toHaveBeenCalled();
  });
});
