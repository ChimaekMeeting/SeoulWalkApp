import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteMapView } from '../../components/map';
import { LocationInfo, WalkMode, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { radii, spacing } from '../../theme/tokens';

const MODE_LABEL: Record<WalkMode, string> = {
  [WalkMode.CIRCULAR_RANDOM]: '순환 코스',
  [WalkMode.ONEWAY_SHORTEST]: '편도 코스',
  [WalkMode.ONEWAY_RANDOM]: '편도 코스',
};

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
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>산책 준비</Text>
        <View style={styles.headerSpacer} />
      </View>

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
        <Text style={styles.modeLabel}>{MODE_LABEL[routeResult.mode]}</Text>
        <View style={styles.statRow}>
          <Stat label="거리" value={`${routeResult.total_km.toFixed(1)}`} unit="km" />
          <Stat label="예상 시간" value={`${durationMinutes}`} unit="분" />
          <Stat label="예상 칼로리" value={`${kcal}`} unit="kcal" />
        </View>
      </View>

      <Pressable
        onPress={onStart}
        style={({ pressed }) => [styles.startButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.startButtonText}>▶ 산책 시작</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}> {unit}</Text>
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backIcon: {
    fontSize: 22,
    color: '#111',
    width: 32,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111',
  },
  headerSpacer: {
    width: 32,
  },
  mapCard: {
    marginHorizontal: spacing.lg,
    height: 300,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#f2fbf7',
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
    borderColor: '#E0E0E0',
    gap: spacing.md,
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9E9E9E',
  },
  statLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  startButton: {
    marginHorizontal: spacing.lg,
    marginTop: 'auto',
    marginBottom: spacing.lg,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
