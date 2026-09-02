const { withGradleProperties, AndroidConfig } = require('@expo/config-plugins');

// @react-native-seoul/kakao-login's own `overrideKakaoSDKVersion` plugin option
// doesn't actually work: it writes to `project.ext['react-native'].versions.kakao.sdk`,
// but the library's android/build.gradle only ever reads a flat `kakaoSdkVersion`
// (via `rootProject.ext.has('kakaoSdkVersion')`, falling back to the library's own
// bundled RNKakaoLogins_kakaoSdkVersion=2.20.1 — still true as of the library's
// latest 6.0.4 release). Per the library's README ("Android gradle의 root
// project의 ext에 RNKakaoLogins_ 를 제외한 버전을 명시"), the supported override is a
// root-level `kakaoSdkVersion` gradle property, which Gradle auto-exposes as a
// rootProject ext property that getExtOrDefault() checks first.
//
// Kakao's 2026-09-02 security advisory requires Android SDK >= 2.25.0
// (services on 2.24.0 or below are affected); pin it here until the wrapper
// ships a fixed default.
const KAKAO_SDK_VERSION = '2.25.0';

const withKakaoSdkVersion = (config) => {
  return withGradleProperties(config, (config) => {
    config.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      config.modResults,
      'kakaoSdkVersion',
      KAKAO_SDK_VERSION
    );
    return config;
  });
};

module.exports = withKakaoSdkVersion;
