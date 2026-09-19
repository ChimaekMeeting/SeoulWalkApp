import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { GestureDetector } from 'react-native-gesture-handler';
import { TabScreen } from '../../components/TabScreen';
import { HistoryFilter, RouteHistoryList } from '../../components/record/RouteHistoryList';
import { WalkRouteResponse } from '../../types/prewalk';
import { usePageSwipeGesture } from '../../hooks/usePageSwipeGesture';
import { colors, spacing } from '../../theme/tokens';

interface RecordTabProps {
  /** 현재 필터('최근 경로'/'즐겨찾기'). 탭을 벗어나도 유지되도록 MainRouter가 소유한다. */
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  /** 경로 기록 카드를 눌렀을 때 그 경로로 다시 산책(6a)을 시작하도록 호출된다. */
  onSelectRoute: (route: WalkRouteResponse) => void;
}

// 좌우로 나열된 필터 순서 — 좌→우 스와이프로 이 배열을 앞뒤로 오간다.
const FILTER_ORDER: HistoryFilter[] = ['recent', 'favorite'];

const FILTERS: [HistoryFilter, string][] = [
  ['recent', '최근 경로'],
  ['favorite', '즐겨찾기'],
];

// 화면(헤더·리스트 포함) 어디서 스와이프해도 필터가 전환된다 — 탭 전환 스와이프는 BottomNav
// 위에서만 인식하므로(MainRouter) 이 영역과 겹치지 않는다.
export function RecordTab({ filter, onFilterChange, onSelectRoute }: RecordTabProps) {
  const handleFilterIndexChange = useCallback(
    (nextIndex: number) => {
      const next = FILTER_ORDER[nextIndex];
      if (next) onFilterChange(next);
    },
    [onFilterChange],
  );

  const swipe = usePageSwipeGesture({
    index: FILTER_ORDER.indexOf(filter),
    pageCount: FILTER_ORDER.length,
    onChange: handleFilterIndexChange,
  });

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.fill}>
        <TabScreen title="기록">
          <View style={styles.historyTabRow}>
            {FILTERS.map(([value, label]) => {
              const active = filter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => onFilterChange(value)}
                  style={[styles.historyTabPill, active && styles.historyTabPillActive]}
                >
                  <Text style={[styles.historyTabText, active && styles.historyTabTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <RouteHistoryList filter={filter} onSelectRoute={onSelectRoute} />
        </TabScreen>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
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
