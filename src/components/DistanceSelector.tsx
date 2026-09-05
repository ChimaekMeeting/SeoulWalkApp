import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { DISTANCE_OPTIONS } from '../config/surveyOptions';
import { DistanceOption } from '../types/survey';
import { colors, radii, spacing } from '../theme/tokens';

interface Props {
  value: DistanceOption | null;
  onChange: (value: DistanceOption) => void;
  style?: StyleProp<ViewStyle>;
}

/** 선호 거리(~2km / 2~4km / 4km+) 선택 버튼 3개. 설문 화면과 마이페이지가 공유한다. */
export function DistanceSelector({ value, onChange, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      {DISTANCE_OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.btn, selected && styles.btnSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{opt.label}</Text>
            <Text style={[styles.sub, selected && styles.subSelected]}>{opt.sub}</Text>
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
  sub: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  subSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
});
