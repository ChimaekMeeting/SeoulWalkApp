import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { logout } from '@react-native-seoul/kakao-login';
import { client } from '../../api/client';
import { cachedResource } from '../../hooks/useCachedResource';
import { authStorage } from '../authStorage';
import { useKakaoAuth } from '../useKakaoAuth';

jest.mock('@react-native-seoul/kakao-login', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  getProfile: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  client: { post: jest.fn() },
}));

jest.mock('../../hooks/useCachedResource', () => ({
  cachedResource: { clearAll: jest.fn() },
}));

jest.mock('../authStorage', () => ({
  authStorage: {
    getUserId: jest.fn(),
    getRefreshToken: jest.fn(),
    removeUserId: jest.fn(),
    removeTokens: jest.fn(),
    removeNickname: jest.fn(),
    removeEmail: jest.fn(),
  },
}));

type HookValue = ReturnType<typeof useKakaoAuth>;

const mockedLogout = logout as jest.MockedFunction<typeof logout>;
const mockedPost = client.post as jest.MockedFunction<typeof client.post>;
const mockedStorage = authStorage as jest.Mocked<typeof authStorage>;
const mockedClearAll = cachedResource.clearAll as jest.MockedFunction<
  typeof cachedResource.clearAll
>;

function renderAuthHook() {
  const box: { current: HookValue } = { current: null as never };
  function Probe() {
    box.current = useKakaoAuth();
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Probe />);
  });
  return {
    box,
    flush: () => ReactTestRenderer.act(() => Promise.resolve()),
    unmount: () => ReactTestRenderer.act(() => renderer.unmount()),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedStorage.getUserId.mockResolvedValue('user-1');
  mockedStorage.getRefreshToken.mockResolvedValue('refresh-1');
  mockedStorage.removeUserId.mockResolvedValue(undefined);
  mockedStorage.removeTokens.mockResolvedValue([undefined, undefined]);
  mockedStorage.removeNickname.mockResolvedValue(undefined);
  mockedStorage.removeEmail.mockResolvedValue(undefined);
  mockedLogout.mockResolvedValue(undefined as never);
  mockedPost.mockResolvedValue({ data: { status: 'success' } });
});

it('서버 refresh token을 폐기한 뒤 로컬 인증 정보를 정리한다', async () => {
  const { box, flush, unmount } = renderAuthHook();
  await flush();

  await ReactTestRenderer.act(async () => {
    await box.current.signOut();
  });

  expect(mockedPost).toHaveBeenCalledWith('/api/login/kakao/logout', {
    refresh_token: 'refresh-1',
  });
  expect(mockedLogout).toHaveBeenCalledTimes(1);
  expect(mockedClearAll).toHaveBeenCalledTimes(1);
  expect(mockedStorage.removeUserId).toHaveBeenCalledTimes(1);
  expect(mockedStorage.removeTokens).toHaveBeenCalledTimes(1);
  expect(mockedStorage.removeNickname).toHaveBeenCalledTimes(1);
  expect(mockedStorage.removeEmail).toHaveBeenCalledTimes(1);
  expect(box.current.authState).toBe('loggedOut');
  expect(box.current.userId).toBeNull();
  unmount();
});

it('서버 로그아웃이 실패해도 로컬 인증 정보는 정리한다', async () => {
  const networkError = new Error('network error');
  mockedPost.mockRejectedValueOnce(networkError);
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { box, flush, unmount } = renderAuthHook();
  await flush();

  await ReactTestRenderer.act(async () => {
    await box.current.signOut();
  });

  expect(errorSpy).toHaveBeenCalledWith(
    '[KakaoAuth] server logout failed:',
    networkError,
  );
  expect(mockedClearAll).toHaveBeenCalledTimes(1);
  expect(mockedStorage.removeTokens).toHaveBeenCalledTimes(1);
  expect(box.current.authState).toBe('loggedOut');
  errorSpy.mockRestore();
  unmount();
});

it('refresh token이 없으면 서버 요청 없이 카카오·로컬 로그아웃을 마친다', async () => {
  mockedStorage.getRefreshToken.mockResolvedValueOnce(null);
  const { box, flush, unmount } = renderAuthHook();
  await flush();

  await ReactTestRenderer.act(async () => {
    await box.current.signOut();
  });

  expect(mockedPost).not.toHaveBeenCalled();
  expect(mockedLogout).toHaveBeenCalledTimes(1);
  expect(mockedStorage.removeTokens).toHaveBeenCalledTimes(1);
  expect(box.current.authState).toBe('loggedOut');
  unmount();
});
