import axios from 'axios';
import { env } from '../config/env';
import { authStorage } from '../auth/authStorage';

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
