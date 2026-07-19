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
