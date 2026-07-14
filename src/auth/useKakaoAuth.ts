import { useState, useEffect } from 'react';
import {
  login,
  logout,
  getProfile,
} from '@react-native-seoul/kakao-login';
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
      await login();
      const profile = await getProfile();
      const id = String(profile.id);
      await authStorage.saveUserId(id);
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
      await authStorage.removeUserId();
      setUserId(null);
      setAuthState('loggedOut');
    }
  };

  return { authState, userId, error, signIn, signOut };
}
