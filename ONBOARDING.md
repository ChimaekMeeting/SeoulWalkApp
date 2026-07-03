# 팀원 온보딩 가이드 — Expo CLI + Dev Client

## 1. 사전 설치 프로그램

| 프로그램 | 비고 |
|---|---|
| Node.js | `package.json`에 `>= 22.11.0` 명시됨. 그 이상 버전 설치 |
| Git | 저장소 clone/pull용 |
| Android Studio | 로컬 에뮬레이터로 테스트하려면 필요 (실기기만 쓴다면 필수는 아님) |

Expo CLI는 별도 전역 설치 불필요 — `npx`로 자동 실행됩니다.

## 2. 코드 받기

```bash
git clone https://github.com/ChimaekMeeting/SeoulWalkApp.git
cd SeoulWalkApp
npm install
```

## 3. `.env` 파일 만들기 (git에 없음, 직접 생성 필요)

프로젝트 루트에 `.env` 파일 생성:

```
EXPO_PUBLIC_MAPBOX_PUBLIC_ACCESS_TOKEN=pk.xxxxx  # 자신의 public token 입력
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

`.env.example` 파일을 참고하면 형식을 확인할 수 있습니다.

## 4. Dev Client 앱 설치 (최초 1회, 기기당 1번만)

Android 실기기 또는 에뮬레이터에 아래 APK를 다운로드해서 설치합니다.

```
https://expo.dev/artifacts/eas/0SlG55GRjXXgw6fPi30GSCoJjav12RwuoL9GOsG8nKM.apk
```

- 이 링크는 로그인 없이 다운로드 가능합니다.
- 실기기라면 이 링크를 폰 브라우저로 열어서 다운로드 → 설치(출처를 알 수 없는 앱 설치 허용 필요).
- 에뮬레이터라면 `adb install -r 파일경로.apk`.

> iOS는 아직 빌드가 없습니다. 빌드 시 Apple Developer 계정이 필요합니다.

## 5. 개발 서버 실행 + 접속

```bash
npm run start
```

(`npx expo start --dev-client` 와 동일 — package.json에 이미 설정되어 있습니다.)

터미널에 QR 코드/서버 정보가 뜨면:

1. 기기에 설치된 **SeoulWalkApp (Development Build)** 앱을 실행합니다.
2. 같은 Wi-Fi에 있으면 자동으로 서버가 뜨거나, "Fetch development servers"로 찾습니다.
3. 안 뜨면 URL을 직접 입력합니다: `exp://<본인_PC_IP>:8081` → Connect.

이후로는 **코드(`src/`, `App.tsx` 등)를 수정할 때마다 재빌드/재설치할 필요 없이** Metro가 자동으로 갱신합니다. 네이티브 라이브러리를 새로 추가하는 경우에만 EAS 재빌드가 필요합니다.

## 6. (선택) EAS 빌드를 직접 돌리고 싶다면

현재 프로젝트는 `kuty2004` 개인 계정 소유이므로, 팀원이 직접 `eas build`를 실행하려면 프로젝트에 협업자로 초대받아야 합니다. 필요하면 아래에서 초대할 수 있습니다.

```
https://expo.dev/accounts/kuty2004/projects/seoulwalkapp/settings
```
