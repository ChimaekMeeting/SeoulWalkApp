import { useState } from "react"
import { StyleSheet, View, Text } from "react-native"

import { spacing, colors } from "../../theme/tokens"
import { MyPreferenceItem } from "./MyPreferenceItem"
import { PREFERENCE_TAGS } from "../../data/onboarding"

export function MyPreferenceComponent() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const toggle = (label: string) => {
    setSelected(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <View style={styles.background}>
      <Text style={styles.text}>내 산책 취향</Text>
      <View style={styles.row}>
        {PREFERENCE_TAGS.map(label => (
          <MyPreferenceItem
            key={label}
            label={label}
            value={selected[label]}
            onPress={() => toggle(label)}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.containerBackground,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 15,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  text: {
    fontWeight: '900',
    fontSize: 16,
  }
})
