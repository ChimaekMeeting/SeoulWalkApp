import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';

interface MyPreferenceItemProps {
  label: string;
  value: boolean;
  onPress: () => void;
}

export function MyPreferenceItem({ label, value, onPress }: MyPreferenceItemProps) {
  return (
    <Pressable onPress={onPress} style={[styles.item, value && styles.itemActive]}>
      <Text style={[styles.label, value && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  itemActive: {
    backgroundColor: colors.ink,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  labelActive: {
    color: colors.card,
  },
});
