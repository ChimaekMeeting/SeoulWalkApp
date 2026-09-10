import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MapAppearanceMode } from '../config/mapAppearance';
import { colors, radii, spacing } from '../theme/tokens';

const OPTIONS: { value: MapAppearanceMode; label: string }[] = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

interface Props {
  value: MapAppearanceMode;
  onChange: (value: MapAppearanceMode) => void;
  style?: StyleProp<ViewStyle>;
}

/** 라이트/다크 선택 버튼 2개. DistanceSelector와 같은 모양 — 마이페이지의 지도 모드 선택에 쓴다. */
export function LightDarkSelector({ value, onChange, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      {OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.btn, selected && styles.btnSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  btnSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  labelSelected: {
    color: colors.card,
  },
});
