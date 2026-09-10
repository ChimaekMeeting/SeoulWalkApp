import { useRef, useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import axios from 'axios';
import {
  login,
  logout,
  getProfile,
} from '@react-native-seoul/kakao-login';
import { client } from '../api/client';
import { authStorage } from './authStorage';

type AuthState = 'loading' | 'loggedIn' | 'loggedOut';

interface LoginTokens {
  access_token: string;
  refresh_token: string;
}

const MOBILE_LOGIN_ENDPOINT = '/api/login/kakao/mobile-login';
// Cloud Run 콜드스타트로 첫 요청이 응답을 못 받고 끊기는 일이 잦다("Network Error").
// 재시도 전 컨테이너가 뜰 시간을 준다.
const COLD_START_RETRY_DELAY_MS = 1500;

/**
 * 카카오 access_token을 백엔드에 넘겨 앱 토큰을 발급받는다. 응답을 아예 못 받은
 * 네트워크 오류(axios `err.response` 없음)에 한해 딱 1회 재시도한다 — 서버가 명시적으로
 * 에러(4xx/5xx)를 준 경우엔 재시도해도 소용없으므로 그대로 던진다.
 */
async function postMobileLogin(kakaoAccessToken: string) {
  const body = { access_token: kakaoAccessToken };
  try {
    return await client.post<LoginTokens>(MOBILE_LOGIN_ENDPOINT, body);
  } catch (err) {
    if (!axios.isAxiosError(err) || err.response) throw err;
    console.warn('[KakaoAuth] mobile-login 네트워크 오류 → 1회 재시도');
    await new Promise<void>(resolve => setTimeout(resolve, COLD_START_RETRY_DELAY_MS));
    return client.post<LoginTokens>(MOBILE_LOGIN_ENDPOINT, body);
  }
}

export function useKakaoAuth() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 로그인 절차(카카오 SDK → 프로필 → 백엔드 토큰 발급)가 진행 중인지. 버튼 스피너 표시 +
  // 절차가 끝나기 전 두 번째 탭이 login()을 동시에 또 호출해 SDK가 한쪽을 취소로 뱉는
  // ("두 번 눌러야 됨") 상황을 막는 데 쓴다. ref는 리렌더 사이 즉시성이 필요해 state와 같이 둔다.
  const [signingIn, setSigningIn] = useState(false);
  const signingInRef = useRef(false);

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

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('auth:forceLogout', () => {
      setUserId(null);
      setAuthState('loggedOut');
    });
    return () => sub.remove();
  }, []);

  // 로그인 성공 시엔 signingIn을 일부러 안 내린다(화면이 넘어갈 때까지 스피너 유지).
  // 그래서 로그아웃해 로그인 화면으로 돌아오면 스피너가 계속 돌 수 있는데, authState가
  // loggedOut이 되는 모든 경로(로그아웃·강제 로그아웃·최초 진입)에서 여기서 정리한다.
  useEffect(() => {
    if (authState === 'loggedOut') {
      signingInRef.current = false;
      setSigningIn(false);
    }
  }, [authState]);

  const signIn = async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setSigningIn(true);
    setError(null);
    try {
      const kakaoToken = await login();
      const profile = await getProfile();
      const id = String(profile.id);

      const { data } = await postMobileLogin(kakaoToken.accessToken);
      const saves: Promise<unknown>[] = [
        authStorage.saveUserId(id),
        authStorage.saveTokens(data.access_token, data.refresh_token),
        authStorage.saveNickname(profile.nickname ?? ''),
      ];
      if (profile.email) saves.push(authStorage.saveEmail(profile.email));
      await Promise.all(saves);

      setUserId(id);
      setAuthState('loggedIn');
      // 성공 시엔 signingIn을 내리지 않는다 — 로그인 화면이 다음 화면으로 넘어갈 때까지
      // 스피너를 유지해 버튼 라벨이 잠깐 다시 보이는 깜빡임을 막는다.
      // (화면이 전환되며 컴포넌트가 언마운트되므로 상태를 되돌릴 필요가 없다.)
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      // 사용자가 직접 취소한 경우만 조용히 넘어간다. 그 외 에러는 배너로 보여준다.
      if (!message.includes('cancel')) {
        console.error('[KakaoAuth] signIn failed:', err);
        setError('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
      }
    }
    // 실패·취소로만 여기 도달한다 — 다시 시도할 수 있게 상태를 되돌린다.
    signingInRef.current = false;
    setSigningIn(false);
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

  return { authState, userId, error, signingIn, signIn, signOut };
}
