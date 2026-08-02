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
  // Cloud Run 유휴 상태에서 첫 요청(콜드스타트)이 8~10초 걸릴 수 있어 여유 있게 잡음.
  timeout: 20000,
});

client.interceptors.request.use(async (config) => {
  const token = await authStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers.Cookie = `access_token=${token}`;  // 쿠키 추가
  }
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
