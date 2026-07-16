import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import Mapbox from '@rnmapbox/maps';
import { env } from './src/config/env';
import { useKakaoAuth } from './src/auth/useKakaoAuth';
import { LoginScreen } from './src/screens/LoginScreen';
import { LocationPermissionScreen } from './src/screens/LocationPermissionScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors } from './src/theme/tokens';
import { WalkFlowDevPreview } from './src/screens/walk/WalkFlowDevPreview';

Mapbox.setAccessToken(env.MAPBOX_PUBLIC_ACCESS_TOKEN);

type PermissionStatus = 'checking' | 'granted' | 'denied' | 'undetermined';

function App() {
  const { authState, userId, error, signIn, signOut } = useKakaoAuth();
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>('checking');

  const appState = useRef<AppStateStatus>(AppState.currentState);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionStatus('granted');
    } else if (status === 'denied') {
      setPermissionStatus('denied');
    } else {
      setPermissionStatus('undetermined');
    }
  };

  useEffect(() => {
    if (authState !== 'loggedIn') return;
    checkLocationPermission();
  }, [authState]);

  // 설정 앱에서 돌아왔을 때 권한 상태 재확인
  useEffect(() => {
    if (authState !== 'loggedIn') return;
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appState.current !== 'active' &&
          nextState === 'active' &&
          permissionStatus === 'denied'
        ) {
          checkLocationPermission();
        }
        appState.current = nextState;
      },
    );
    return () => subscription.remove();
  }, [authState, permissionStatus]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
  };

  if (authState === 'loading' || (authState === 'loggedIn' && permissionStatus === 'checking')) {
    return <SplashView />;
  }

  if (authState === 'loggedOut') {
    return (
      <SafeAreaProvider>
        <LoginScreen onLogin={signIn} error={error} />
      </SafeAreaProvider>
    );
  }

  if (permissionStatus === 'undetermined' || permissionStatus === 'denied') {
    return (
      <SafeAreaProvider>
        <LocationPermissionScreen
          status={permissionStatus}
          onRequest={requestLocationPermission}
          onSkip={() => setPermissionStatus('granted')}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <HomeScreen onLogout={signOut} userId={userId} />
      {/* 산책 전·중·후(6a~6d) 화면 미리보기용 개발 전용 버튼. 프리워크 챗봇이 아직 WalkFlow에
          연결되기 전이라 mock 데이터로 열어볼 수 있게 해둠 — __DEV__ 빌드에서만 보이고
          프로덕션에는 렌더되지 않음. src/screens/walk/WalkFlowDevPreview.tsx 참고 */}
      <WalkFlowDevPreview />
    </SafeAreaProvider>
  );
}

function SplashView() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.mintDeep} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
