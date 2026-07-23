import { Pressable, Text, View, StyleSheet } from 'react-native';
import { WalkMode, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { colors, radii, spacing } from '../../theme/tokens';

const MODE_ICON: Record<WalkMode, string> = {
  [WalkMode.CIRCULAR_RANDOM]: '◯',
  [WalkMode.ONEWAY_SHORTEST]: '→',
  [WalkMode.ONEWAY_RANDOM]: '→',
};

// AI 챗봇이 찾아준 실제 산책 경로(WalkRouteResponse)를 카드 형태로 보여준다.
export function RouteCandidate({
  route,
  onPress,
  onRetry,
}: {
  route: WalkRouteResponse;
  onPress: () => void;
  onRetry: () => void;
}) {
  const durationMinutes = estimateDurationMinutes(route.total_km);
  const kcal = estimateKcal(route.total_km);

  return (
    <View>
      <View style={styles.chatLine}>
        <View style={styles.chatIcon}>
          <Text style={styles.chatIconText}>✳</Text>
        </View>
        <View style={styles.cardColumn}>
          <Pressable onPress={onPress} style={styles.card}>
            <View style={styles.icon}>
              <Text style={styles.iconText}>{MODE_ICON[route.mode]}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>Roudi가 찾은 산책 코스</Text>
              <Text style={styles.meta}>
                {route.total_km.toFixed(1)}km · {durationMinutes}분 · {kcal}kcal
              </Text>
            </View>
          </Pressable>
          <View style={styles.chatButtons}>
            <Pressable onPress={onPress} style={styles.ghostButtonSmall}>
              <Text style={styles.ghostButtonText}>산책하기</Text>
            </Pressable>
            <Pressable onPress={onRetry} style={styles.ghostButtonSmall}>
              <Text style={styles.ghostButtonText}>다시 묻기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chatLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  chatIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '900',
  },
  cardColumn: {
    flexShrink: 1,
    width: '82%',
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.containerBackground,
  },
  iconText: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 20,
  },
  body: {
    flex: 1,
    width: '100%',
  },
  type: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.mintDeep,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  meta: {
    color: colors.ink3,
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  chatButtons: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  ghostButtonSmall: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.line2,
    flex: 1,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: colors.ink2,
    fontSize: 12,
    fontWeight: '900',
  },
});
