import { Pressable, StyleSheet, Text } from "react-native"

import { colors, radii, spacing } from "../../theme/tokens"

interface MyPreferenceItemProps {
  label: string;
  value: boolean;
  onPress: () => void;
}

export function MyPreferenceItem({ label, value, onPress }: MyPreferenceItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.item, value && styles.itemActive]}
    >
      <Text style={[styles.label, value && styles.labelActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  item: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 15,
    backgroundColor: colors.card,
  },
  itemActive: {
    backgroundColor: colors.black,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  labelActive: {
    color: colors.card,
  },
})
