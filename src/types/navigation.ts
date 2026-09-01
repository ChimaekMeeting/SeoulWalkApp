// Phase B: App.tsx의 상태 기반 분기 로직을 실제 Stack.Screen들로 쪼갠 것.
// 각 화면 전환은 상태(AppBootstrap 컨텍스트)가 바뀔 때 navigationRef.replace()로 이뤄진다 —
// 화면들끼리 서로를 navigate()로 직접 호출하지 않는다(전부 상태 파생 결과).
export type RootStackParamList = {
  BrandSplash: undefined;
  Loading: undefined; // 온보딩/설문/권한 확인 중 공통으로 쓰는 스피너 화면
  Onboarding: undefined;
  Login: undefined;
  Survey: undefined;
  LocationPermission: undefined;
  ActivityPermission: undefined;
  Home: undefined;
};

export type RootScreenName = keyof RootStackParamList;
