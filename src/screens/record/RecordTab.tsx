import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { HistoryFilter, RouteHistoryList } from '../../components/record/RouteHistoryList';
import { WalkRouteResponse } from '../../types/prewalk';
import { colors, spacing } from '../../theme/tokens';

interface RecordTabProps {
  /** 경로 기록 카드를 눌렀을 때 그 경로로 다시 산책(6a)을 시작하도록 호출된다. */
  onSelectRoute: (route: WalkRouteResponse) => void;
}

export function RecordTab({ onSelectRoute }: RecordTabProps) {
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('recent');

  return (
    <View style={styles.recordPage}>
      <ScreenHeader title="기록" />
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={styles.historyTabRow}>
          {(
            [
              ['recent', '최근 경로'],
              ['favorite', '즐겨찾기'],
            ] as [HistoryFilter, string][]
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setHistoryFilter(value)}
              style={[
                styles.historyTabPill,
                historyFilter === value && styles.historyTabPillActive,
              ]}
            >
              <Text
                style={[
                  styles.historyTabText,
                  historyFilter === value && styles.historyTabTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <RouteHistoryList filter={historyFilter} onSelectRoute={onSelectRoute} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  recordPage: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingBottom: 76,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },
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
    borderColor: colors.border,
  },
  historyTabPillActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  historyTabText: {
    color: '#5c5c5c',
    fontWeight: '900',
    fontSize: 12,
  },
  historyTabTextActive: {
    color: colors.card,
  },
});
