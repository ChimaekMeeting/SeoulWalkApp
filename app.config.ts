import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SeoulWalkApp',
  slug: 'seoulwalkapp',
  scheme: 'seoulwalkapp',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.seoulwalkapp',
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        '내 주변 산책 경로를 추천하기 위해 위치 정보를 사용합니다.',
    },
  },
  android: {
    package: 'com.seoulwalkapp',
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
  },
  plugins: [
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN,
      },
    ],
  ],
  extra: {
    eas: {
      projectId: undefined,
    },
  },
});
