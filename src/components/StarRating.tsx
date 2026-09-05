import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme/tokens';

interface Props {
  /** 현재 별점(0~max). 0이면 아직 선택 전. */
  value: number;
  onChange: (value: number) => void;
  max?: number;
  /** 별 하나의 글자 크기(px). 기본 32. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** 탭해서 1~max점을 매기는 별점 입력. 라벨·레이아웃은 호출부에서 감싼다. */
export function StarRating({ value, onChange, max = 5, size = 32, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: max }, (_, i) => {
        const score = i + 1;
        const filled = score <= value;
        return (
          <Pressable
            key={score}
            onPress={() => onChange(score)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${score}점`}
            accessibilityState={{ selected: filled }}
          >
            <Text style={[{ fontSize: size }, filled ? styles.filled : styles.empty]}>
              {filled ? '★' : '☆'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filled: {
    color: colors.ink,
  },
  empty: {
    color: colors.line,
  },
});
