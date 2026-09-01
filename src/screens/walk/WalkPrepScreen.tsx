import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteMapView } from '../../components/map';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatRow } from '../../components/StatRow';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { WALK_MODE_LABEL } from '../../utils/walkMode';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  onStart: () => void;
  onBack: () => void;
}

export function WalkPrepScreen({ routeResult, currentLocation, onStart, onBack }: Props) {
  const durationMinutes = estimateDurationMinutes(routeResult.total_km);
  const kcal = estimateKcal(routeResult.total_km);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="산책 준비" onBack={onBack} plain align="center" />

      <View style={styles.mapCard}>
        <RouteMapView
          mode="overview"
          currentLocation={currentLocation}
          previewRoute={routeResult.coordinates}
          fitRouteOnMount
          style={styles.map}
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.modeLabel}>{WALK_MODE_LABEL[routeResult.mode]}</Text>
        <StatRow
          variant="detail"
          items={[
            { label: '거리', value: routeResult.total_km.toFixed(1), unit: 'km' },
            { label: '예상 시간', value: `${durationMinutes}`, unit: '분' },
            { label: '예상 칼로리', value: `${kcal}`, unit: 'kcal' },
          ]}
        />
      </View>

      <Button label="▶ 산책 시작" onPress={onStart} style={styles.startButton} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
  },
  mapCard: {
    marginHorizontal: spacing.lg,
    height: 300,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.mapPreviewBg,
  },
  map: {
    flex: 1,
  },
  infoCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.md,
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  startButton: {
    marginHorizontal: spacing.lg,
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
