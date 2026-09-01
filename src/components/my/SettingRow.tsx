import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  label: string;
  onPress?: () => void;
  /** 빨간 텍스트로 표시 (로그아웃 등 파괴적 동작) */
  danger?: boolean;
  /** 오른쪽 '>' 화살표 표시 여부 (기본 true) */
  showChevron?: boolean;
}

/** 마이페이지 설정 목록의 한 줄. */
export function SettingRow({ label, onPress, danger, showChevron = true }: Props) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
      {showChevron ? <Feather name="chevron-right" size={20} color={colors.ink3} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  labelDanger: {
    color: '#d75b5b',
  },
});
