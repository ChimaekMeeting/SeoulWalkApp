import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { DeviceEventEmitter } from 'react-native';
import { env } from '../config/env';
import { authStorage } from '../auth/authStorage';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const client = axios.create({
  baseURL: env.API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await authStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers.Cookie = `access_token=${token}`;  // 쿠키 추가
  }
  // TODO: 테스트 끝나면 아래 로그 제거
  console.log('[Auth] Authorization header:', config.headers.Authorization ?? '(없음)');
  return config;
});

client.interceptors.response.use(
  (response) => response,
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
        `${env.API_BASE_URL}/api/auth/check/refresh_token`,
        { params: { refresh_token: refreshToken } },
      );

      if (data.status !== 'SUCCESS') {
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
