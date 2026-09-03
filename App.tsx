import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Mapbox from '@rnmapbox/maps';
import { env } from './src/config/env';
import { AppBootstrapProvider, useAppBootstrap } from './src/auth/AppBootstrap';
import { navigationRef } from './src/navigation/navigationRef';
import { BrandSplashScreen, BRAND_SPLASH_BG } from './src/screens/BrandSplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SurveyScreen } from './src/screens/SurveyScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { LocationPermissionScreen } from './src/screens/LocationPermissionScreen';
import { ActivityPermissionScreen } from './src/screens/ActivityPermissionScreen';
import { toPromptStatus, toPedometerPromptStatus } from './src/auth/permissions';
import { MainRouter } from './src/screens/MainRouter';
import { colors } from './src/theme/tokens';
import type { RootStackParamList } from './src/types/navigation';

Mapbox.setAccessToken(env.MAPBOX_PUBLIC_ACCESS_TOKEN);

const Stack = createNativeStackNavigator<RootStackParamList>();

// 온보딩/설문/권한 확인 중 공통으로 쓰는 로딩 화면. AppBootstrapProvider가 상태를 보고
// navigation.replace()로 다음 화면을 결정하는 동안 잠깐 보여준다.
// 브랜드 스플래시(BrandSplashScreen, 검정 배경) 바로 다음에 이어지는 화면이라 같은 배경색을
// 써서 색이 튀지 않게 하고, 무슨 화면인지 모른 채 빈 스피너만 보이지 않도록 안내 문구를 곁들인다.
// (예전엔 colors.mintDeep/bgSoft로 민트그린이었는데, 그건 채팅 UI 전용 색이라 흑백 위주인
// ROUDI 브랜드 톤과 안 맞았다.)
function LoadingScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.card} />
      <Text style={styles.splashLabel}>불러오는 중…</Text>
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
  return (
    <LocationPermissionScreen
      status={toPromptStatus(permissionStatus)}
      onRequest={requestLocationPermission}
    />
  );
}

function ActivityPermissionScreenContainer() {
  const { activityStatus, grantActivityPermission, denyActivityPermission, skipActivityPermission } =
    useAppBootstrap();
  return (
    <ActivityPermissionScreen
      status={toPedometerPromptStatus(activityStatus)}
      onGranted={grantActivityPermission}
      onDenied={denyActivityPermission}
      onSkip={skipActivityPermission}
    />
  );
}

function MainRouterContainer() {
  const { signOut, userId, resetSurvey, ensureWalkable, locationGranted } = useAppBootstrap();
  return (
    <MainRouter
      onLogout={signOut}
      userId={userId}
      onResetSurvey={resetSurvey}
      ensureWalkable={ensureWalkable}
      locationGranted={locationGranted}
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
    backgroundColor: BRAND_SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
});
