/**
 * axios 인터셉터 단위 테스트
 *
 * 추가 의존성 없이 Jest + axios 내장 어댑터 교체 방식으로 동작합니다.
 * - expo-secure-store : jest.mock 으로 대체
 * - axios.get (refresh 호출) : jest.spyOn 으로 제어
 * - client 어댑터 : 테스트마다 교체해 응답을 강제
 */

import axios, { InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../../config/env', () => ({
  env: { API_BASE_URL: 'http://test.local' },
}));

import { client } from '../client';

const mockGetItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItem = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;

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

// ── 공통 설정 ────────────────────────────────────────────────

describe('인터셉터', () => {
  let originalAdapter: typeof client.defaults.adapter;
  let spyAxiosGet: jest.SpyInstance;

  beforeAll(() => {
    originalAdapter = client.defaults.adapter;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockDeleteItem.mockResolvedValue(undefined);
    spyAxiosGet = jest.spyOn(axios, 'get');
  });

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    spyAxiosGet.mockRestore();
  });

  // ════════════════════════════════════════════════════════════
  // HTTP 401 기반 재발급 (기존 동작)
  // ════════════════════════════════════════════════════════════

  describe('HTTP 401 기반 재발급', () => {
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
        if (callCount === 1) return Promise.reject(make401(cfg));
        return makeOk(cfg, { protected: true });
      };

      const res = await client.get('/api/protected');

      expect(res.data).toEqual({ protected: true });
      expect(callCount).toBe(2);
      expect(mockSetItem).toHaveBeenCalledWith('app_access_token', 'new_token');
      expect(spyAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('refresh_token'),
        expect.objectContaining({ headers: { Authorization: 'Bearer valid_refresh' } }),
      );
    });

    test('_retry=true 인 요청이 또 401 이면 재발급 없이 즉시 reject (무한 루프 방지)', async () => {
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
        callCount++;
        return Promise.reject(make401(config as InternalAxiosRequestConfig));
      };

      await expect(client.get('/api/protected')).rejects.toThrow();

      expect(callCount).toBe(2);
      expect(spyAxiosGet).toHaveBeenCalledTimes(1);
    });

    test('refresh_token 없으면 스토리지 초기화 + auth:forceLogout 이벤트', async () => {
      mockGetItem.mockResolvedValue(null);
      const spyEmit = jest.spyOn(DeviceEventEmitter, 'emit');

      client.defaults.adapter = async (config) =>
        Promise.reject(make401(config as InternalAxiosRequestConfig));

      await expect(client.get('/api/protected')).rejects.toThrow();

      expect(mockDeleteItem).toHaveBeenCalled();
      expect(spyEmit).toHaveBeenCalledWith('auth:forceLogout');
      expect(spyAxiosGet).not.toHaveBeenCalled();
    });

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

  // ════════════════════════════════════════════════════════════
  // HTTP 200 + body status 기반 재발급 (신규 동작)
  // ════════════════════════════════════════════════════════════

  describe('HTTP 200 + body status 기반 재발급', () => {
    test('access_expired_token → 재발급 성공 → 원래 요청 재시도 → 정상 응답', async () => {
      mockGetItem.mockImplementation(async (key) => {
        if (key === 'app_access_token') return 'old_token';
        if (key === 'app_refresh_token') return 'valid_refresh';
        return null;
      });
      spyAxiosGet.mockResolvedValueOnce({
        data: { status: 'success', access_token: 'new_token' },
      });

      let callCount = 0;
      client.defaults.adapter = async (config) => {
        callCount++;
        if (callCount === 1) {
          return makeOk(config as InternalAxiosRequestConfig, {
            status: 'access_expired_token',
            survey_completed: false,
          });
        }
        return makeOk(config as InternalAxiosRequestConfig, {
          status: 'success',
          survey_completed: true,
        });
      };

      const res = await client.get('/api/user/survey');

      expect(res.data.survey_completed).toBe(true);
      expect(callCount).toBe(2);
      expect(mockSetItem).toHaveBeenCalledWith('app_access_token', 'new_token');
      expect(spyAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('refresh_token'),
        expect.objectContaining({ headers: { Authorization: 'Bearer valid_refresh' } }),
      );
    });

    test('access_expired_token → 재발급 성공 → 재시도 응답도 만료 → forceLogout (무한 루프 방지)', async () => {
      mockGetItem.mockImplementation(async (key) => {
        if (key === 'app_refresh_token') return 'valid_refresh';
        return 'old_token';
      });
      spyAxiosGet.mockResolvedValueOnce({
        data: { status: 'success', access_token: 'new_token' },
      });
      const spyEmit = jest.spyOn(DeviceEventEmitter, 'emit');

      // 첫 번째·재시도 모두 만료 응답
      client.defaults.adapter = async (config) =>
        makeOk(config as InternalAxiosRequestConfig, {
          status: 'access_expired_token',
          survey_completed: false,
        });

      await expect(client.get('/api/user/survey')).rejects.toThrow();

      expect(spyEmit).toHaveBeenCalledWith('auth:forceLogout');
      expect(spyAxiosGet).toHaveBeenCalledTimes(1); // 재발급은 1회만
    });

    test('invalid_token → 재발급 실패 → forceLogout', async () => {
      mockGetItem.mockImplementation(async (key) => {
        if (key === 'app_refresh_token') return 'some_refresh';
        return 'bad_token';
      });
      spyAxiosGet.mockResolvedValueOnce({ data: { status: 'fail' } });
      const spyEmit = jest.spyOn(DeviceEventEmitter, 'emit');

      client.defaults.adapter = async (config) =>
        makeOk(config as InternalAxiosRequestConfig, { status: 'invalid_token' });

      await expect(client.get('/api/protected')).rejects.toThrow();

      expect(spyEmit).toHaveBeenCalledWith('auth:forceLogout');
      expect(mockDeleteItem).toHaveBeenCalled();
    });

    test('user_not_found → 재발급 없이 즉시 forceLogout', async () => {
      const spyEmit = jest.spyOn(DeviceEventEmitter, 'emit');

      client.defaults.adapter = async (config) =>
        makeOk(config as InternalAxiosRequestConfig, { status: 'user_not_found' });

      await expect(client.get('/api/protected')).rejects.toThrow();

      expect(spyEmit).toHaveBeenCalledWith('auth:forceLogout');
      expect(spyAxiosGet).not.toHaveBeenCalled(); // refresh 시도 없음
      expect(mockDeleteItem).toHaveBeenCalled();
    });

    test('no_path 등 인증 무관 실패 status → 재발급·로그아웃 없이 응답 그대로 반환', async () => {
      const spyEmit = jest.spyOn(DeviceEventEmitter, 'emit');

      client.defaults.adapter = async (config) =>
        makeOk(config as InternalAxiosRequestConfig, {
          status: 'no_path',
          coordinates: [],
        });

      const res = await client.get('/api/prewalk/route');

      expect(res.data.status).toBe('no_path');
      expect(spyEmit).not.toHaveBeenCalledWith('auth:forceLogout');
      expect(spyAxiosGet).not.toHaveBeenCalled();
    });
  });
});
