import { useState, useEffect } from "react"
import { StyleSheet, View, Text } from "react-native"

import { spacing, colors } from "../../theme/tokens"
import { MyPreferenceItem } from "./MyPreferenceItem"
import { PREFERENCE_TAGS } from "../../data/onboarding"
import { getSurvey } from "../../api/survey"

export function MyPreferenceComponent() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getSurvey()
      .then(({ data }) => {
        const tags = data.selected_tags ?? [];
        setSelected(Object.fromEntries(tags.map(t => [t, true])));
      })
      .catch(() => {
        // 실패 시 {} 유지 — 전부 기본 스타일
      });
  }, []);

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
