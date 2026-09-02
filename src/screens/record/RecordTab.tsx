import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { TabScreen } from '../../components/TabScreen';
import { HistoryFilter, RouteHistoryList } from '../../components/record/RouteHistoryList';
import { WalkRouteResponse } from '../../types/prewalk';
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

// 이 거리(px) 이상 수평 이동해야 필터 전환으로 인정한다.
const SWIPE_DISTANCE_THRESHOLD = 60;

export function RecordTab({ filter, onFilterChange, onSelectRoute }: RecordTabProps) {
  // 화면 전체(헤더·빈 공간 포함) 어디서 스와이프해도 필터가 전환되도록 TabScreen을 통째로 감싼다.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        // 명확히 수평일 때만 활성화 — 세로 스크롤(ScrollView)과 충돌하지 않게 한다.
        .activeOffsetX([-20, 20])
        .failOffsetY([-16, 16])
        .onEnd(e => {
          'worklet';
          if (
            Math.abs(e.translationX) < SWIPE_DISTANCE_THRESHOLD ||
            Math.abs(e.velocityX) <= Math.abs(e.velocityY)
          ) {
            return;
          }
          const index = FILTER_ORDER.indexOf(filter);
          const nextIndex = e.translationX < 0 ? index + 1 : index - 1;
          const next = FILTER_ORDER[nextIndex];
          if (next && next !== filter) runOnJS(onFilterChange)(next);
        }),
    [filter, onFilterChange],
  );

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
