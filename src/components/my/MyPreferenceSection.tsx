import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { MyPreferenceItem } from './MyPreferenceItem';
import { PREFERENCE_TAGS } from '../../data/onboarding';
import { getSurvey, postSurvey } from '../../api/survey';

/** 마이페이지의 '내 산책 취향' 섹션 — 태그를 토글하면 즉시 서버에 저장한다. */
export function MyPreferenceSection() {
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
    setSelected(prev => {
      const next = { ...prev, [label]: !prev[label] };

      const tags = PREFERENCE_TAGS.filter(tag => next[tag]);
      postSurvey({ tags }).catch(() => {
        // 저장 실패 시 토글 이전 상태로 되돌림
        setSelected(prev);
      });

      return next;
    });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>내 산책 취향</Text>
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
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.containerBackground,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  heading: {
    fontWeight: '900',
    fontSize: 16,
  },
});
