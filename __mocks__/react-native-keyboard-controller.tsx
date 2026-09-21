// react-native-keyboard-controller는 네이티브 모듈이라 jest(RN 컴포넌트 렌더 테스트) 환경에서는
// 링크되어 있지 않다 — 실제 키보드 동작 검증은 이 목으로 할 수 없고 실기기에서 확인해야 한다.
// 여기서는 App/HomeScreen 렌더 테스트가 깨지지 않도록 최소한의 통과용 구현만 둔다.
import React from 'react';
import { View } from 'react-native';

export const KeyboardProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

export const KeyboardStickyView = React.forwardRef((props: any, ref: any) => (
  <View ref={ref} {...props} />
));

export const useKeyboardAnimation = () => ({ height: { interpolate: () => 0 }, progress: { interpolate: () => 0 } });
export const useReanimatedKeyboardAnimation = () => ({ height: { value: 0 }, progress: { value: 0 } });
export const useResizeMode = () => {};
