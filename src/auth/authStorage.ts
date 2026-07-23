import * as SecureStore from 'expo-secure-store';

const KAKAO_USER_ID_KEY = 'kakao_user_id';
const ACCESS_TOKEN_KEY = 'app_access_token';
const REFRESH_TOKEN_KEY = 'app_refresh_token';
const NICKNAME_KEY = 'user_nickname';
const EMAIL_KEY = 'user_email';

export const authStorage = {
  saveUserId: (userId: string) =>
    SecureStore.setItemAsync(KAKAO_USER_ID_KEY, userId),
  getUserId: () => SecureStore.getItemAsync(KAKAO_USER_ID_KEY),
  removeUserId: () => SecureStore.deleteItemAsync(KAKAO_USER_ID_KEY),

  saveTokens: (accessToken: string, refreshToken: string) =>
    Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]),
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setAccessToken: (token: string) =>
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token),
  removeTokens: () =>
    Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]),

  saveNickname: (nickname: string) =>
    SecureStore.setItemAsync(NICKNAME_KEY, nickname),
  getNickname: () => SecureStore.getItemAsync(NICKNAME_KEY),
  removeNickname: () => SecureStore.deleteItemAsync(NICKNAME_KEY),

  saveEmail: (email: string) => SecureStore.setItemAsync(EMAIL_KEY, email),
  getEmail: () => SecureStore.getItemAsync(EMAIL_KEY),
  removeEmail: () => SecureStore.deleteItemAsync(EMAIL_KEY),
};
