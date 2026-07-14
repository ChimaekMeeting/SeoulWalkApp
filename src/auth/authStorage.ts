import * as SecureStore from 'expo-secure-store';

const KAKAO_USER_ID_KEY = 'kakao_user_id';

export const authStorage = {
  saveUserId: (userId: string) =>
    SecureStore.setItemAsync(KAKAO_USER_ID_KEY, userId),
  getUserId: () => SecureStore.getItemAsync(KAKAO_USER_ID_KEY),
  removeUserId: () => SecureStore.deleteItemAsync(KAKAO_USER_ID_KEY),
};
