import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { spacing } from '../theme/tokens';

/**
 * 개발 빌드 전용 — 화면 상태를 강제로 바꿔보는 작은 칩 버튼.
 * (`__DEV__` 게이팅은 쓰는 쪽에서 한다 — 개발 패널 자체를 통째로 숨기는 경우가 많아서.)
 */
export function DevChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#ff6b35',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    color: '#ff6b35',
    fontSize: 12,
    fontWeight: '800',
  },
});
