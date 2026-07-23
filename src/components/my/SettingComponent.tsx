import { StyleSheet, Text, Pressable } from "react-native"
import { Feather } from "@expo/vector-icons";

import { colors, spacing } from "../../theme/tokens"

interface SettingComponentProps {
  label: string;
  onPress?: () => void;
}

export function SettingComponent({ label, onPress }: SettingComponentProps) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
    >
      <Text style={styles.label}>{label}</Text>
      <Feather name="chevron-right" size={20} color={colors.ink3} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
})
