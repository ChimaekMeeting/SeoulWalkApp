import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { DeviceEventEmitter } from 'react-native';
import { env } from '../config/env';
import { authStorage } from '../auth/authStorage';
import { IMMEDIATE_LOGOUT_STATUSES, REFRESH_THEN_RETRY_STATUSES } from '../types/auth';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// 재발급 엔드포인트 자체는 body-status 검사 대상에서 제외한다 (무한 루프 방지).
const REFRESH_ENDPOINT = '/api/auth/check/refresh_token';

export const client = axios.create({
  baseURL: env.API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Cloud Run 유휴 상태에서 첫 요청(콜드스타트)이 8~10초 걸릴 수 있어 여유 있게 잡음.
  timeout: 20000,
});

client.interceptors.request.use(async (config) => {
  const token = await authStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers.Cookie = `access_token=${token}`;
  }
  return config;
});

client.interceptors.response.use(
  async (response) => {
    const bodyStatus = (response.data as { status?: string } | null)?.status;

    // status 필드가 없거나 인증 관련 값이 아니면 그대로 반환
    if (!bodyStatus) return response;

    const config = response.config as RetryableConfig;

    // 재발급 엔드포인트 응답은 이 로직을 타지 않도록 제외
    if (config.url?.includes(REFRESH_ENDPOINT)) return response;

    // user_not_found: 재발급해도 소용없으므로 즉시 로그아웃
    if (IMMEDIATE_LOGOUT_STATUSES.has(bodyStatus)) {
      await clearAuthAndNotify();
      return Promise.reject(new Error(`[auth] ${bodyStatus}`));
    }

    // access_expired_token, invalid_token: 재발급 후 원래 요청 재시도
    if (REFRESH_THEN_RETRY_STATUSES.has(bodyStatus)) {
      // 재시도 응답도 만료이면 무한 루프 없이 즉시 로그아웃
      if (config._retry) {
        await clearAuthAndNotify();
        return Promise.reject(new Error(`[auth] retry also failed: ${bodyStatus}`));
      }

      config._retry = true;

      const refreshToken = await authStorage.getRefreshToken();
      if (!refreshToken) {
        await clearAuthAndNotify();
        return Promise.reject(new Error('[auth] no refresh token'));
      }

      try {
        const { data } = await axios.get<{ status: string; access_token: string }>(
          `${env.API_BASE_URL}${REFRESH_ENDPOINT}`,
          { headers: { Authorization: `Bearer ${refreshToken}` }, timeout: 20000 },
        );

        if (data.status.toLowerCase() !== 'success') {
          await clearAuthAndNotify();
          return Promise.reject(new Error('[auth] refresh rejected'));
        }

        await authStorage.saveTokens(data.access_token, refreshToken);
        config.headers.Authorization = `Bearer ${data.access_token}`;
        config.headers.Cookie = `access_token=${data.access_token}`;

        return client(config);
      } catch {
        await clearAuthAndNotify();
        return Promise.reject(new Error('[auth] refresh error'));
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;

    if (error.response?.status !== 401 || !config || config._retry) {
      return Promise.reject(error);
    }

    config._retry = true;

    const refreshToken = await authStorage.getRefreshToken();
    if (!refreshToken) {
      await clearAuthAndNotify();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.get<{ status: string; access_token: string }>(
        `${env.API_BASE_URL}${REFRESH_ENDPOINT}`,
        { headers: { Authorization: `Bearer ${refreshToken}` }, timeout: 20000 },
      );

      if (data.status.toLowerCase() !== 'success') {
        await clearAuthAndNotify();
        return Promise.reject(error);
      }

      await authStorage.saveTokens(data.access_token, refreshToken);

      config.headers.Authorization = `Bearer ${data.access_token}`;
      config.headers.Cookie = `access_token=${data.access_token}`;

      return client(config);
    } catch {
      await clearAuthAndNotify();
      return Promise.reject(error);
    }
  },
);

async function clearAuthAndNotify() {
  await Promise.all([
    authStorage.removeUserId(),
    authStorage.removeTokens(),
    authStorage.removeNickname(),
    authStorage.removeEmail(),
  ]);
  DeviceEventEmitter.emit('auth:forceLogout');
}
