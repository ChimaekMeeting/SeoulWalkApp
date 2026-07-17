import { useState, useEffect } from 'react';
import {
  login,
  logout,
  getProfile,
} from '@react-native-seoul/kakao-login';
import { client } from '../api/client';
import { authStorage } from './authStorage';

type AuthState = 'loading' | 'loggedIn' | 'loggedOut';

export function useKakaoAuth() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authStorage.getUserId().then(stored => {
      if (stored) {
        setUserId(stored);
        setAuthState('loggedIn');
      } else {
        setAuthState('loggedOut');
      }
    });
  }, []);

  const signIn = async () => {
    try {
      setError(null);
      const kakaoToken = await login();
      const profile = await getProfile();
      const id = String(profile.id);

      const { data } = await client.post<{ access_token: string; refresh_token: string }>(
        '/api/login/kakao/mobile-login',
        { access_token: kakaoToken.accessToken },
      );
      // TODO: 테스트 끝나면 아래 로그 제거
      console.log('[KakaoProfile] nickname:', profile.nickname, '/ email:', profile.email);

      const saves: Promise<unknown>[] = [
        authStorage.saveUserId(id),
        authStorage.saveTokens(data.access_token, data.refresh_token),
        authStorage.saveNickname(profile.nickname ?? ''),
      ];
      if (profile.email) saves.push(authStorage.saveEmail(profile.email));
      await Promise.all(saves);

      // TODO: 테스트 끝나면 아래 로그 제거
      const savedToken = await authStorage.getAccessToken();
      console.log('[AuthStorage] 저장된 access_token:', savedToken);

      // TODO: 테스트 끝나면 아래 호출 제거 — Authorization 헤더 확인용
      client.get('/api/login/kakao/callback').catch(() => {});

      setUserId(id);
      setAuthState('loggedIn');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      // 사용자가 직접 취소한 경우 에러 표시 안 함
      if (message.includes('cancel') || message.includes('Cancel')) {
        return;
      }
      console.error('[KakaoAuth] signIn failed:', err);
      setError('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const signOut = async () => {
    try {
      await logout();
    } catch (err: unknown) {
      console.error('[KakaoAuth] logout failed:', err);
    } finally {
      await Promise.all([
        authStorage.removeUserId(),
        authStorage.removeTokens(),
        authStorage.removeNickname(),
        authStorage.removeEmail(),
      ]);
      setUserId(null);
      setAuthState('loggedOut');
    }
  };

  return { authState, userId, error, signIn, signOut };
}
