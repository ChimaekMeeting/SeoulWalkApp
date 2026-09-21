import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SeoulWalkApp',
  slug: 'seoulwalkapp',
  scheme: 'seoulwalkapp',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  // OTA(expo-updates): 네이티브 변경 없는 JS/에셋 수정을 스토어 재심사 없이 배포하기 위한 설정.
  // fingerprint 정책 — 네이티브 코드(플러그인·의존성)가 바뀌면 런타임 버전이 자동으로 갈려서,
  // 새 네이티브 빌드가 필요한 JS를 옛날 빌드가 잘못 받아 크래시 나는 걸 막아준다.
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    url: 'https://u.expo.dev/940923dd-b69d-4910-bbdb-d0c0c9d7ba9f',
  },
  ios: {
    bundleIdentifier: 'com.seoulwalkapp',
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        '내 주변 산책 경로를 추천하기 위해 위치 정보를 사용합니다.',
      // 산책 중 화면을 꺼도(백그라운드) 턴바이턴 안내를 이어가기 위한 것 — 선택 기능이라
      // 이 권한을 거부해도 앱은 정상 동작한다(화면이 켜져 있을 때의 안내만 제공).
      NSLocationAlwaysAndWhenInUseUsageDescription:
        '화면이 꺼져 있거나 다른 앱을 쓰는 동안에도 산책 경로 안내(턴 알림)를 이어가기 위해 위치 정보를 사용합니다.',
      NSMotionUsageDescription:
        '산책 중 걸음 수를 측정하기 위해 동작 및 피트니스 정보를 사용합니다.',
      UIBackgroundModes: ['location'],
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
    // 모든 Android 기기에서 키보드가 앱 위를 덮지 않고 현재 창 높이를 줄이게 한다.
    // JS 레이아웃은 이 줄어든 높이를 onLayout으로 측정하며 키보드 높이를 따로 더하지 않는다.
    softwareKeyboardLayoutMode: 'resize',
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACTIVITY_RECOGNITION',
      // 백그라운드 턴바이턴 안내(선택 기능)용. 안드로이드 11+는 이 권한을 다이얼로그로 한 번에
      // 못 받고, "앱 사용 중" 허용 후 설정 앱에서 별도로 "항상 허용"을 켜야 한다
      // (useBackgroundLocationPermission.ts 참고).
      'ACCESS_BACKGROUND_LOCATION',
      // 안드로이드 13+ 알림 런타임 권한 — 턴 알림·백그라운드 위치 추적용 지속 알림에 필요.
      'POST_NOTIFICATIONS',
    ],
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
    // Pins the Kakao Android SDK to a non-vulnerable version — see the plugin
    // for why the library's own `overrideKakaoSDKVersion` option doesn't work.
    './plugins/withKakaoSdkVersion',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          '내 주변 산책 경로를 추천하기 위해 위치 정보를 사용합니다.',
        locationAlwaysAndWhenInUsePermission:
          '화면이 꺼져 있거나 다른 앱을 쓰는 동안에도 산책 경로 안내(턴 알림)를 이어가기 위해 위치 정보를 사용합니다.',
        // 백그라운드 위치 추적 자체(권한 선언)와, 안드로이드에서 그걸 살아있게 하는 포그라운드
        // 서비스(지속 알림 필요) 둘 다 켠다 — 둘 중 하나만 켜면 백그라운드 GPS가 곧 멈춘다.
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-sensors',
      {
        motionPermission: '산책 중 걸음 수를 측정하기 위해 동작 및 피트니스 정보를 사용합니다.',
      },
    ],
    // 커스텀 알림 아이콘/색상은 지정 안 함(리포에 전용 에셋이 아직 없음 — 시스템 기본 아이콘으로
    // 뜬다). 나중에 흰색-투명 단색 아이콘을 assets/에 추가하면 { icon, color } 옵션으로 지정 가능.
    'expo-notifications',
  ],
  extra: {
    eas: {
      projectId: '940923dd-b69d-4910-bbdb-d0c0c9d7ba9f',
    },
  },
});
