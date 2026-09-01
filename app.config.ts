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
      NSMotionUsageDescription:
        '산책 중 걸음 수를 측정하기 위해 동작 및 피트니스 정보를 사용합니다.',
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [`kakao${process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY}`],
        },
      ],
      LSApplicationQueriesSchemes: ['kakaokompassauth', 'kakaolink'],
    },
  },
  android: {
    package: 'com.seoulwalkapp',
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'ACTIVITY_RECOGNITION'],
  },
  plugins: [
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN,
      },
    ],
    './plugins/withMapboxAccessToken',
    [
      '@react-native-seoul/kakao-login',
      {
        kakaoAppKey: process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY,
        // Plugin defaults to Kotlin 1.5.10, which is older than the 2.1.20
        // this RN 0.85 project's own gradle/libs.versions.toml pins — override
        // it so the plugin doesn't downgrade the project's Kotlin version.
        kotlinVersion: '2.1.20',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          extraMavenRepos: ['https://devrepo.kakao.com/nexus/content/groups/public/'],
        },
      },
    ],
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          '내 주변 산책 경로를 추천하기 위해 위치 정보를 사용합니다.',
      },
    ],
    [
      'expo-sensors',
      {
        motionPermission: '산책 중 걸음 수를 측정하기 위해 동작 및 피트니스 정보를 사용합니다.',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '940923dd-b69d-4910-bbdb-d0c0c9d7ba9f',
    },
  },
});
