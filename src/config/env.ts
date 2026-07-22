export const env = {
  MAPBOX_PUBLIC_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_ACCESS_TOKEN || '',
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  KAKAO_NATIVE_APP_KEY: process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || '',
  INSTAGRAM_APP_ID: process.env.EXPO_PUBLIC_INSTAGRAM_APP_ID || '',
  // 개발 중 실제 GPS 대신 쓸 고정 좌표. "위도,경도" 형식. 비워두면 실제 위치를 사용한다.
  DEBUG_FIXED_LOCATION: process.env.EXPO_PUBLIC_DEBUG_FIXED_LOCATION || '',
};
