import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toggleFavoriteRoute } from '../../api/routes';
import { estimateSteps } from '../../utils/walkEstimate';
import { colors, radii, spacing } from '../../theme/tokens';
import { RouteMapView } from '../../components/map';
import { Button } from '../../components/Button';
import { StatRow } from '../../components/StatRow';
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

      <StatRow
        style={styles.statRow}
        items={[
          { value: traveledKm.toFixed(1), unit: 'km' },
          { value: `${minutes}`, unit: '분' },
          { value: steps.toLocaleString(), unit: '걸음' },
        ]}
      />

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
        <Button
          label={isFavorite ? '★ 즐겨찾기됨' : '☆ 즐겨찾기'}
          onPress={handleFavorite}
          variant="secondary"
          disabled={routeId == null || favoritePending}
          style={styles.favoriteButton}
          textStyle={styles.favoriteButtonText}
        />
      </View>

      <Button label="홈으로" onPress={onHome} style={styles.homeButton} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
  },
  header: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
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
    color: colors.ink,
  },
  statRow: {
    marginTop: spacing.xxl,
  },
  routePreview: {
    marginTop: spacing.xl,
    height: 160,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.mapPreviewBg,
  },
  routePreviewMap: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  favoriteButton: {
    flex: 1,
    height: 48,
    borderColor: colors.line,
    paddingHorizontal: spacing.xs,
  },
  favoriteButtonText: {
    fontSize: 14,
  },
  homeButton: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
