import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../Text';
import { colors, radii, spacing } from '../../theme/tokens';

const HINTS: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  examples: string;
}[] = [
  { icon: 'navigate-outline', label: '가는 방식', examples: '목적지까지 · 한 바퀴' },
  { icon: 'time-outline', label: '거리·시간', examples: '"3km 정도" · "30분 정도"' },
  {
    icon: 'shield-checkmark-outline',
    label: '중요한 것',
    examples: '"안전하게" · "편안하게"',
  },
];

// 첫 대화 진입 시(사용자가 아직 아무것도 입력하지 않았을 때)만 인사말 아래에 보이는 조건 힌트 카드.
// 실제 대화 내용이 아니라 입력 예시를 보여주는 고정 UI라 백엔드 응답과 무관하게 렌더링한다.
export function WalkHintCard() {
  return (
    <View style={styles.card}>
      {HINTS.map(hint => (
        <View style={styles.row} key={hint.label}>
          <View style={styles.iconWrap}>
            <Ionicons name={hint.icon} size={16} color={colors.ink} />
          </View>
          <Text style={styles.label}>{hint.label}</Text>
          <Text style={styles.examples} numberOfLines={1}>
            {hint.examples}
          </Text>
        </View>
      ))}
      <Text style={styles.footer}>
        먼저 장소를 알려주시면, 필요한 조건만 물어볼게요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.containerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    width: 62,
  },
  examples: {
    flex: 1,
    color: colors.ink3,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    color: colors.ink3,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});
