import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import Mapbox from '@rnmapbox/maps';
import { env } from './src/config/env';
import { useKakaoAuth } from './src/auth/useKakaoAuth';
import { onboardingStorage } from './src/auth/onboardingStorage';
import { BrandSplashScreen } from './src/screens/BrandSplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { LocationPermissionScreen } from './src/screens/LocationPermissionScreen';
import { ActivityPermissionScreen } from './src/screens/ActivityPermissionScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors } from './src/theme/tokens';

Mapbox.setAccessToken(env.MAPBOX_PUBLIC_ACCESS_TOKEN);

type PermissionStatus = 'checking' | 'granted' | 'denied' | 'undetermined';

function App() {
  const { authState, userId, error, signIn, signOut } = useKakaoAuth();
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>('checking');
  const [activityStatus, setActivityStatus] =
    useState<PermissionStatus>('checking');

  const [showBrandSplash, setShowBrandSplash] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'seen' | 'unseen'>('checking');

  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    onboardingStorage.getHasSeen().then(value => {
      setOnboardingStatus(value === 'true' ? 'seen' : 'unseen');
    });
    const timer = setTimeout(() => setShowBrandSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

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

  // 위치 권한이 확정된 뒤 신체 활동 권한을 확인합니다.
  useEffect(() => {
    if (authState !== 'loggedIn' || permissionStatus !== 'granted') return;
    Pedometer.getPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setActivityStatus('granted');
      } else if (status === 'denied') {
        // 이미 거부한 적 있으면 화면 없이 HomeScreen으로
        setActivityStatus('denied');
      } else {
        setActivityStatus('undetermined');
      }
    });
  }, [authState, permissionStatus]);

  const isCheckingPermissions =
    permissionStatus === 'checking' ||
    (permissionStatus === 'granted' && activityStatus === 'checking');

  if (showBrandSplash) {
    return <BrandSplashScreen />;
  }

  if (onboardingStatus === 'checking') {
    return <SplashView />;
  }

  if (onboardingStatus === 'unseen') {
    return (
      <SafeAreaProvider>
        <OnboardingScreen onDone={() => setOnboardingStatus('seen')} />
      </SafeAreaProvider>
    );
  }

  if (authState === 'loading' || (authState === 'loggedIn' && isCheckingPermissions)) {
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

  if (activityStatus === 'undetermined') {
    return (
      <SafeAreaProvider>
        <ActivityPermissionScreen
          status="undetermined"
          onGranted={() => setActivityStatus('granted')}
          onSkip={() => setActivityStatus('denied')}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <HomeScreen
        onLogout={signOut}
        userId={userId}
        activityPermission={activityStatus === 'granted' ? 'granted' : 'denied'}
      />
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
