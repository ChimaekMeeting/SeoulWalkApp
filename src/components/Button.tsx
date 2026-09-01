import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { colors, radii } from '../theme/tokens';

type Variant = 'primary' | 'secondary';

interface Props {
  label: string;
  onPress: () => void;
  /** primary = 검정 채움 버튼(기본), secondary = 흰 배경 아웃라인 버튼 */
  variant?: Variant;
  disabled?: boolean;
  /** true면 라벨 대신 스피너를 보여주고 눌리지 않는다 */
  loading?: boolean;
  /** 바깥 여백/flex 등 레이아웃 오버라이드용 */
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * 화면 하단 액션 버튼 공통 컴포넌트. 높이 52 · radii.lg 고정이고,
 * 위치(margin) 같은 건 style prop으로 넘긴다.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: Props) {
  const isPrimary = variant === 'primary';
  const blocked = disabled || loading;
  const faded = disabled && !loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        faded && styles.faded,
        (loading || pressed) && !faded && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.card : colors.ink} />
      ) : (
        <Text
          style={[isPrimary ? styles.primaryText : styles.secondaryText, textStyle]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.ink,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  primaryText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  faded: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
