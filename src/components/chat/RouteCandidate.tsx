import { Pressable, Text, View, StyleSheet } from 'react-native';
import { WalkMode, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { colors, radii, spacing } from '../../theme/tokens';

const MODE_LABEL: Record<WalkMode, string> = {
  [WalkMode.CIRCULAR_RANDOM]: '순환 · LOOP',
  [WalkMode.ONEWAY_SHORTEST]: '편도 · ONE-WAY',
  [WalkMode.ONEWAY_RANDOM]: '편도 · ONE-WAY',
};

const MODE_ICON: Record<WalkMode, string> = {
  [WalkMode.CIRCULAR_RANDOM]: '◯',
  [WalkMode.ONEWAY_SHORTEST]: '→',
  [WalkMode.ONEWAY_RANDOM]: '→',
};

// AI 챗봇이 찾아준 실제 산책 경로(WalkRouteResponse)를 카드 형태로 보여준다.
export function RouteCandidate({
  route,
  onPress,
}: {
  route: WalkRouteResponse;
  onPress: () => void;
}) {
  const durationMinutes = estimateDurationMinutes(route.total_km);
  const kcal = estimateKcal(route.total_km);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>{MODE_ICON[route.mode]}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.type}>{MODE_LABEL[route.mode]}</Text>
        <Text style={styles.title}>RouDi가 찾은 산책 코스</Text>
        <Text style={styles.meta}>
          {route.total_km.toFixed(1)}km · {durationMinutes}분 · {kcal}kcal
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginLeft: 38,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.mint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.mintDeep}22`,
  },
  iconText: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 20,
  },
  body: {
    flex: 1,
  },
  type: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.mintDeep,
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  meta: {
    color: colors.ink3,
    fontSize: 11,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  chevron: {
    color: colors.ink3,
    fontSize: 28,
  },
});
