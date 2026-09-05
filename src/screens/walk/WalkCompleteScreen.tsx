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
  /** 경로 진행 거리(km). 화면 헤드라인 거리값. */
  routeProgressKm: number;
  /** 실측 이동거리(km) — 경로를 벗어나 걸은 구간 포함. 걸음 수 추정에 쓴다. 없으면 routeProgressKm 사용. */
  actualDistanceKm?: number;
  elapsedMs: number;
  /** 실제 만보계 걸음 수(6b에서 측정). 만보계를 못 쓴 경우 null이면 거리 기반 추정치를 대신 보여준다. */
  steps?: number | null;
  /** WalkRouteResponse에 아직 route id가 없어 optional — 없으면 즐겨찾기 비활성. */
  routeId?: number;
  /** 완료 요약을 확인하고 다음(산책로 평가) 화면으로 넘어갈 때. */
  onNext: () => void;
}

// 완주 여부(종착점 도착 / 중간 종료)와 무관하게 완료 화면은 동일하게 보여준다 —
// "걸은 만큼 인정"이 이 앱의 방침이라 종료 방식을 화면에서 구분하지 않는다.
export function WalkCompleteScreen({
  routeResult,
  currentLocation,
  routeProgressKm,
  actualDistanceKm,
  elapsedMs,
  steps: measuredSteps,
  routeId,
  onNext,
}: Props) {
  const [isFavorite, setIsFavorite] = useState(routeResult.is_favorite ?? false);
  const [favoritePending, setFavoritePending] = useState(false);

  const minutes = Math.round(elapsedMs / 60000);
  const steps = measuredSteps ?? estimateSteps(actualDistanceKm ?? routeProgressKm);

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
          { value: routeProgressKm.toFixed(1), unit: 'km' },
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

      <Button label="산책로 평가하기" onPress={onNext} style={styles.nextButton} />
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
  nextButton: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
