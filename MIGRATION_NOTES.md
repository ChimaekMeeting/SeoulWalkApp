# Expo CLI + Dev Client 마이그레이션 기록

팀이 프론트엔드 개발 환경을 Expo CLI + Dev Client로 통일하기로 하면서, 기존에 있던 순수 React Native CLI(bare workflow) 프로젝트를 Expo로 마이그레이션한 작업 기록입니다. 원래 "담당자 A" 체크리스트는 `create-expo-app`으로 새 프로젝트를 만드는 걸 전제로 했지만, **기존 코드(지도 화면, mock 데이터 등)를 유지하기로 결정**하면서 신규 생성이 아니라 마이그레이션으로 방향을 바꿨습니다.

브랜치: `setting/expo-migration` (아직 `dev`에 머지도, `origin`에 push도 안 된 상태)

## 왜 마이그레이션이 필요했나

기존 저장소는 Expo가 전혀 아니었습니다 — `android/`, `ios/` 폴더가 수동 관리되는 순수 RN CLI 프로젝트였고, Mapbox도 수동 네이티브 링킹으로 붙어 있었습니다. Dev Client를 쓰려면 이 위에 Expo 모듈을 얹고, 최종적으로는 `expo prebuild`로 네이티브 프로젝트를 설정 파일에서 자동 생성하는 방식(CNG, Continuous Native Generation)으로 바꿔야 했습니다.

## 작업 순서 (커밋 8개)

1. **`fix:` Mapbox 액세스 토큰 타이밍 버그 수정** — 마이그레이션 착수 전 베이스라인 테스트 중 발견한 **기존 코드의 버그**(아래 "발견한 버그" 참고)
2. **`setting:` Expo 모듈 + expo-dev-client 설치** (`install-expo-modules`, `expo install`)
3. **`setting:` `app.config.ts` 작성** — 번들 ID, 위치 권한, Mapbox 플러그인 설정
4. **`setting:` 환경변수 `EXPO_PUBLIC_*` 마이그레이션** — `react-native-config` → Expo 표준 방식
5. **`setting:` CNG 전환** — `expo prebuild`로 `android/`·`ios/` 재생성, git에서 제외, 커스텀 Mapbox 토큰 플러그인 작성
6. **`setting:` `eas.json` 개발 빌드 프로필 추가**
7. **`setting:` EAS 프로젝트 연결** (`eas init`)
8. **`docs:` 팀원 온보딩 가이드 추가** (`ONBOARDING.md`)

이후 `eas build --profile development --platform android` 실행 → 성공 → 실기기(에뮬레이터)에 설치해서 최종 검증까지 완료.

## 시행착오 / 막혔던 부분

### 1. 기존 코드에 있던 Mapbox 토큰 레이스 컨디션 버그
`App.tsx`의 `Mapbox.setAccessToken()` 호출이 JS 타이밍상 `MapView` 네이티브 초기화보다 늦게 반영되어, 지도가 아예 안 뜨고 "액세스 토큰 없음" 에러가 나는 버그가 있었습니다. **마이그레이션과 무관한 원래 버그**였고, `mapbox_access_token`라는 이름의 Android 문자열 리소스를 앱 시작 시점부터 갖고 있도록 해서 고쳤습니다.

### 2. `install-expo-modules`가 Kotlin 파일을 잘못 패치
`MainActivity.kt`, `MainApplication.kt`에 `import`문을 `package` 선언보다 앞에 넣어버려서 컴파일 에러가 났습니다. 자동화 도구의 버그로 보이며, 수동으로 순서를 바로잡아 해결했습니다.

### 3. JDK 버전 불일치
시스템 기본 JDK가 26인데, 이 Android Gradle Plugin 버전은 JDK 17을 요구했습니다(`core-for-system-modules.jar` 관련 jlink 에러). `JAVA_HOME`을 JDK 17로 명시해서 해결. (`C:\Users\kuty2\.jdks\ms-17.0.15`)

### 4. 에뮬레이터 저장공간 부족
기본 AVD 데이터 파티션이 6GB뿐이라 앱 설치 중 "not enough space" 에러 발생. 12GB로 늘리고 데이터를 초기화(wipe)해서 해결.

### 5. CNG 전환으로 Mapbox 토큰 리소스가 다시 사라짐
`expo prebuild`가 `android/`를 완전히 재생성하면서, 위 1번에서 수동으로 고친 `mapbox_access_token` 리소스도 같이 날아갔습니다. `@rnmapbox/maps`의 공식 Expo 플러그인은 빌드용 다운로드 토큰만 처리하고 이 런타임 토큰은 처리하지 않는다는 걸 확인 → `plugins/withMapboxAccessToken.js`라는 커스텀 config plugin을 새로 작성해서 재생성 시마다 자동으로 주입되도록 함.

### 6. iOS는 Windows에서 `expo prebuild` 자체가 불가능
`npx expo prebuild --platform ios`를 시도하니 iOS 네이티브 프로젝트 생성은 macOS/Linux에서만 지원한다는 걸 확인. 실수로 기존 `ios/` 폴더를 먼저 지워버려서 백업본으로 복구하는 해프닝도 있었음. **결론: iOS 네이티브 재생성은 EAS 클라우드 빌드가 대신 처리**하므로 로컬에서는 Android만 검증하고 iOS는 그대로 진행 가능(Apple Developer 계정 확보 후).

### 7. "main" 컴포넌트 미등록 에러
CNG가 재생성한 `MainActivity.kt`는 루트 컴포넌트 이름을 Expo 표준인 `"main"`으로 기대하는데, 기존 `index.js`는 `app.json`의 `name`(`"SeoulWalkApp"`)으로 등록하고 있어서 불일치 → 앱이 빨간 에러 화면으로 크래시. `index.js`를 Expo 표준 방식인 `registerRootComponent(App)`로 교체해서 해결.

### 8. Metro 좀비 프로세스 — 가장 시간을 많이 잡아먹은 문제
여러 차례 "Connecting to the development server..."에서 무한정 멈추는 현상이 반복됐습니다. 원인은 **이전에 띄운 Metro 프로세스가 죽지 않고 8081 포트를 계속 점유**하고 있었던 것 — `curl .../status`로 확인하면 "running"이라고 응답은 하는데(TCP 연결과 헬스체크는 살아있음), 실제 번들 요청이나 웹소켓 핸드셰이크는 처리하지 못하는 반쯤 죽은 상태였습니다. **교훈: Metro가 살아있는지 확인할 땐 단순 `/status` 응답뿐 아니라, 실제 새 프로세스인지(PID 비교) + 타임아웃을 걸고 응답 속도까지 확인해야 함.**

### 9. 호스트 PC 메모리 부족으로 인한 에뮬레이터 ANR
Discord, Slack, Chrome 여러 탭, VS Code 등이 동시에 떠 있어서 여유 메모리가 1.4GB까지 떨어졌고, 이로 인해 에뮬레이터 System UI 자체가 응답 불능(ANR) 상태에 빠지는 일이 여러 번 있었습니다. 불필요한 프로그램을 정리해서 여유 메모리를 3~5GB까지 확보한 뒤에야 안정화됨.

### 10. 에뮬레이터 강제종료 후 lock 파일 잔존
반복적으로 `taskkill /F`로 에뮬레이터 프로세스를 죽이다 보니, Android Studio에서 재실행 시 "failed to connect within 5 minutes"로 실패하는 문제가 발생. AVD 폴더의 `hardware-qemu.ini.lock`, `multiinstance.lock` 파일이 남아있던 게 원인 — 삭제 후 정상화.

### 11. 로컬 빌드와 EAS 빌드 서명 키 충돌
로컬 debug.keystore로 서명된 앱이 이미 설치된 상태에서 EAS가 자체 관리 키(remote credentials)로 서명한 APK를 설치하려 하니 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` 에러 발생. 기존 앱을 `adb uninstall`로 지우고 재설치해서 해결.

### 12. (참고) Mapbox 다운로드 토큰은 더 이상 필수가 아님
`@rnmapbox/maps`가 생성한 `android/build.gradle`의 주석에서 "Mapbox가 다운로드 토큰 요구사항을 제거했다"는 걸 확인 — `RNMapboxMapsDownloadToken`을 별도로 발급/관리하지 않아도 빌드가 정상 동작했습니다. 원래 계획에서 우려했던 "토큰 관리 담당자 지정" 이슈가 자연히 해소됨.

## 최종 결과물

- EAS 계정 `kuty2004` / 프로젝트 `@kuty2004/seoulwalkapp` 생성 및 연결
- Android Dev Client APK 클라우드 빌드 성공, 실기기 설치 후 홈 화면·AI 추천·Mapbox 지도 정상 렌더링 확인
- 온보딩 가이드(`ONBOARDING.md`) 작성 완료

## 아직 안 된 것

- `origin`에 push 안 함 — 지금은 로컬 브랜치에만 존재
- iOS 빌드 (Apple Developer 계정 대기)
- B 담당자 작업물과의 merge
- 팀 조직用 EAS 계정으로 프로젝트 이전 (개인 계정 소유 중, 이전 시 빌드/설정 재작업 불필요함은 확인됨)
