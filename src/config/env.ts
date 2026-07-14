export const env = {
  MAPBOX_PUBLIC_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_ACCESS_TOKEN || '',
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  KAKAO_NATIVE_APP_KEY: process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || '',
};
