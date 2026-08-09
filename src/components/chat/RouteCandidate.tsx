import { Pressable, Text, View, StyleSheet } from 'react-native';
import { WalkMode, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { colors, radii, spacing } from '../../theme/tokens';

const MODE_ICON: Record<WalkMode, string> = {
  [WalkMode.CIRCULAR_RANDOM]: '◯',
  [WalkMode.ONEWAY_SHORTEST]: '→',
  [WalkMode.ONEWAY_RANDOM]: '→',
};

// AI 챗봇이 찾아준 실제 산책 경로(WalkRouteResponse) 후보 1개를 카드 형태로 보여준다.
// 후보가 여러 개일 때 서로 구분할 수 있도록 순번(index)을 받아 "코스 N"으로 표시하고,
// 카드를 누르면 바로 선택되어 onPress가 호출된다.
export function RouteCandidate({
  route,
  index,
  onPress,
}: {
  route: WalkRouteResponse;
  index: number;
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
        <Text style={styles.title}>코스 {index + 1}</Text>
        <Text style={styles.meta}>
          {route.total_km.toFixed(1)}km · {durationMinutes}분 · {kcal}kcal
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
