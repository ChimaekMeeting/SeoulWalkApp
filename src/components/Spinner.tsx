import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/tokens';

interface Props {
  /** 지름(px) */
  size?: number;
  color?: string;
  /** 호(테두리) 두께 */
  thickness?: number;
}

/**
 * 회전하는 3/4 원호 스피너 (reanimated 기반).
 *
 * RN 기본 ActivityIndicator는 안드로이드에서 앱이 백그라운드→포그라운드로 돌아오면 멈춘 채
 * 표시되는 버그가 있다(카카오 로그인처럼 외부 앱을 다녀오는 흐름에서 문제). core Animated +
 * useNativeDriver 루프도 이 조합(New Architecture)에서 시작이 잘 안 걸렸다. reanimated는 UI
 * 스레드 워클릿으로 돌아 두 문제 모두 없다.
 */
export function Spinner({ size = 24, color = colors.card, thickness = 3 }: Props) {
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration: 700, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(angle);
  }, [angle]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.arc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          // 단축 속성 borderColor를 쓰면 styles.arc의 borderTopColor: 'transparent'를
          // 덮어써 꽉 찬 원(회전이 안 보임)이 되므로, 3면을 개별로 칠한다.
          borderRightColor: color,
          borderBottomColor: color,
          borderLeftColor: color,
        },
        spinStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  // 위쪽 호를 비워 3/4 원으로 만든다.
  arc: { borderTopColor: 'transparent' },
});
