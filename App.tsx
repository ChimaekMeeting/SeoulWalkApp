import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Mapbox from '@rnmapbox/maps';
import { env } from './src/config/env';
import { AppBootstrapProvider, useAppBootstrap } from './src/auth/AppBootstrap';
import { navigationRef } from './src/navigation/navigationRef';
import { BrandSplashScreen } from './src/screens/BrandSplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SurveyScreen } from './src/screens/SurveyScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { LocationPermissionScreen } from './src/screens/LocationPermissionScreen';
import { ActivityPermissionScreen } from './src/screens/ActivityPermissionScreen';
import { MainRouter } from './src/screens/MainRouter';
import { colors } from './src/theme/tokens';
import type { RootStackParamList } from './src/types/navigation';

Mapbox.setAccessToken(env.MAPBOX_PUBLIC_ACCESS_TOKEN);

const Stack = createNativeStackNavigator<RootStackParamList>();

// 온보딩/설문/권한 확인 중 공통으로 쓰는 로딩 화면. AppBootstrapProvider가 상태를 보고
// navigation.replace()로 다음 화면을 결정하는 동안 잠깐 보여준다.
function LoadingScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.mintDeep} />
    </View>
  );
}

function OnboardingScreenContainer() {
  const { onboardingDone } = useAppBootstrap();
  return <OnboardingScreen onDone={onboardingDone} />;
}

function LoginScreenContainer() {
  const { signIn, loginError } = useAppBootstrap();
  return <LoginScreen onLogin={signIn} error={loginError} />;
}

function SurveyScreenContainer() {
  const { surveyDone } = useAppBootstrap();
  return <SurveyScreen onDone={surveyDone} />;
}

function LocationPermissionScreenContainer() {
  const { permissionStatus, requestLocationPermission } = useAppBootstrap();
  // 이 화면은 permissionStatus가 'granted'가 아닐 때만 라우팅된다('checking'은 Loading 화면이 먼저 잡음).
  return (
    <LocationPermissionScreen
      status={permissionStatus === 'denied' ? 'denied' : 'undetermined'}
      onRequest={requestLocationPermission}
    />
  );
}

function ActivityPermissionScreenContainer() {
  const { activityStatus, grantActivityPermission, denyActivityPermission, skipActivityPermission } =
    useAppBootstrap();
  return (
    <ActivityPermissionScreen
      status={activityStatus === 'denied' ? 'denied' : 'undetermined'}
      onGranted={grantActivityPermission}
      onDenied={denyActivityPermission}
      onSkip={skipActivityPermission}
    />
  );
}

function MainRouterContainer() {
  const { signOut, userId, resetSurvey, ensureWalkable } = useAppBootstrap();
  return (
    <MainRouter
      onLogout={signOut}
      userId={userId}
      onResetSurvey={resetSurvey}
      ensureWalkable={ensureWalkable}
    />
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="BrandSplash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrandSplash" component={BrandSplashScreen} />
      <Stack.Screen name="Loading" component={LoadingScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreenContainer} />
      <Stack.Screen name="Login" component={LoginScreenContainer} />
      <Stack.Screen name="Survey" component={SurveyScreenContainer} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreenContainer} />
      <Stack.Screen name="ActivityPermission" component={ActivityPermissionScreenContainer} />
      <Stack.Screen name="Home" component={MainRouterContainer} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <BottomSheetModalProvider>
            <AppBootstrapProvider>
              <RootNavigator />
            </AppBootstrapProvider>
          </BottomSheetModalProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
