import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

// 화면(Screen) 안이 아닌 곳(AppBootstrap의 상태 파생 로직)에서 navigation.replace()를 호출하기 위한
// ref. react-navigation 공식 패턴 — https://reactnavigation.org/docs/navigating-without-navigation-prop/
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
