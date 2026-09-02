import { Image, Pressable, Text, View, StyleSheet } from 'react-native';
import { WalkMode, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { buildRouteThumbnailUrl } from '../../utils/routeThumbnail';
import { colors, radii, spacing } from '../../theme/tokens';

const THUMB_SIZE = 62;

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
  disabled,
}: {
  route: WalkRouteResponse;
  index: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  const durationMinutes = estimateDurationMinutes(route.total_km);
  const kcal = estimateKcal(route.total_km);
  const thumbnailUrl = buildRouteThumbnailUrl(route.coordinates, THUMB_SIZE);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.icon} />
      ) : (
        <View style={styles.icon}>
          <Text style={styles.iconText}>{MODE_ICON[route.mode]}</Text>
        </View>
      )}
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
  cardPressed: {
    opacity: 0.7,
  },
  cardDisabled: {
    opacity: 0.4,
  },
  icon: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.containerBackground,
    overflow: 'hidden',
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
