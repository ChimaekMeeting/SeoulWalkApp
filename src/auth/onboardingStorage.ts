import * as SecureStore from 'expo-secure-store';

const KEY = 'has_seen_onboarding';

export const onboardingStorage = {
  getHasSeen: () => SecureStore.getItemAsync(KEY),
  markSeen: () => SecureStore.setItemAsync(KEY, 'true'),
};
