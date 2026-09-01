import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toggleFavoriteRoute } from '../../api/routes';
import { estimateSteps } from '../../utils/walkEstimate';
import { radii, spacing } from '../../theme/tokens';
import { RouteMapView } from '../../components/map';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  traveledKm: number;
  elapsedMs: number;
  /** 실제 만보계 걸음 수(6b에서 측정). 만보계를 못 쓴 경우 null이면 거리 기반 추정치를 대신 보여준다. */
  steps?: number | null;
  /** WalkRouteResponse에 아직 route id가 없어 optional — 없으면 즐겨찾기 비활성. */
  routeId?: number;
  onHome: () => void;
}

export function WalkCompleteScreen({
  routeResult,
  currentLocation,
  traveledKm,
  elapsedMs,
  steps: measuredSteps,
  routeId,
  onHome,
}: Props) {
  const [isFavorite, setIsFavorite] = useState(routeResult.is_favorite ?? false);
  const [favoritePending, setFavoritePending] = useState(false);

  const minutes = Math.round(elapsedMs / 60000);
  const steps = measuredSteps ?? estimateSteps(traveledKm);

  const handleFavorite = async () => {
    if (routeId == null || favoritePending) return;
    setFavoritePending(true);
    try {
      const updated = await toggleFavoriteRoute(routeId);
      setIsFavorite(updated.is_favorite);
    } finally {
      setFavoritePending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Text style={styles.header}>산책 완료!</Text>

      <View style={styles.celebrate}>
        <Text style={styles.celebrateIcon}>🎉</Text>
        <Text style={styles.celebrateTitle}>축하합니다!</Text>
      </View>

      <View style={styles.statRow}>
        <Stat value={traveledKm.toFixed(1)} unit="km" />
        <Stat value={`${minutes}`} unit="분" />
        <Stat value={steps.toLocaleString()} unit="걸음" />
      </View>

      <View style={styles.routePreview}>
        <RouteMapView
          mode="overview"
          currentLocation={currentLocation}
          previewRoute={routeResult.coordinates}
          fitRouteOnMount
          showZoomControls={false}
          style={styles.routePreviewMap}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={handleFavorite}
          disabled={routeId == null || favoritePending}
          style={({ pressed }) => [
            styles.secondaryButton,
            (routeId == null || favoritePending) && styles.secondaryButtonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText} numberOfLines={1}>
            {isFavorite ? '★ 즐겨찾기됨' : '☆ 즐겨찾기'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onHome}
        style={({ pressed }) => [styles.homeButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.homeButtonText}>홈으로</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: spacing.xl,
  },
  header: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginTop: spacing.md,
  },
  celebrate: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  celebrateIcon: {
    fontSize: 40,
  },
  celebrateTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xxl,
  },
  stat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  routePreview: {
    marginTop: spacing.xl,
    height: 160,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#f2fbf7',
  },
  routePreviewMap: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  secondaryButtonDisabled: {
    opacity: 0.4,
  },
  secondaryButtonText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '700',
  },
  homeButton: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
