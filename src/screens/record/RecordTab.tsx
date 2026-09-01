import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TabScreen } from '../../components/TabScreen';
import { HistoryFilter, RouteHistoryList } from '../../components/record/RouteHistoryList';
import { WalkRouteResponse } from '../../types/prewalk';
import { colors, spacing } from '../../theme/tokens';

interface RecordTabProps {
  /** 경로 기록 카드를 눌렀을 때 그 경로로 다시 산책(6a)을 시작하도록 호출된다. */
  onSelectRoute: (route: WalkRouteResponse) => void;
}

const FILTERS: [HistoryFilter, string][] = [
  ['recent', '최근 경로'],
  ['favorite', '즐겨찾기'],
];

export function RecordTab({ onSelectRoute }: RecordTabProps) {
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('recent');

  return (
    <TabScreen title="기록">
      <View style={styles.historyTabRow}>
        {FILTERS.map(([value, label]) => {
          const active = historyFilter === value;
          return (
            <Pressable
              key={value}
              onPress={() => setHistoryFilter(value)}
              style={[styles.historyTabPill, active && styles.historyTabPillActive]}
            >
              <Text style={[styles.historyTabText, active && styles.historyTabTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <RouteHistoryList filter={historyFilter} onSelectRoute={onSelectRoute} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  historyTabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  historyTabPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  historyTabPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  historyTabText: {
    color: colors.inkFaint,
    fontWeight: '900',
    fontSize: 12,
  },
  historyTabTextActive: {
    color: colors.card,
  },
});
