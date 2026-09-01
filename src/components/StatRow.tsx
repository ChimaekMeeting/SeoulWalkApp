import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme/tokens';

interface StatItem {
  value: string;
  unit?: string;
  /** detail variant에서만 값 아래에 표시된다 */
  label?: string;
}

interface Props {
  items: StatItem[];
  /**
   * summary = 큰 값 + 아래 단위, 가운데 정렬 (산책 완료 화면)
   * detail  = 값+단위 한 줄 + 아래 라벨, 양끝 정렬 (산책 준비 화면)
   */
  variant?: 'summary' | 'detail';
  style?: StyleProp<ViewStyle>;
}

/** 거리·시간·칼로리 같은 수치를 가로로 나열하는 공통 행. */
export function StatRow({ items, variant = 'summary', style }: Props) {
  const summary = variant === 'summary';
  return (
    <View style={[summary ? styles.rowAround : styles.rowBetween, style]}>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          {summary ? (
            <>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryUnit}>{item.unit}</Text>
            </>
          ) : (
            <>
              <Text style={styles.detailValue}>
                {item.value}
                {item.unit ? <Text style={styles.detailUnit}> {item.unit}</Text> : null}
              </Text>
              <Text style={styles.detailLabel}>{item.label}</Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowAround: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    gap: spacing.xs,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
  },
  summaryUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.ink,
  },
  detailUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
});
