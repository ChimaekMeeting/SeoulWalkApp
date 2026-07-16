import React, { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteMapView } from '../../components/map';
import { WalkRouteResponse } from '../../types/prewalk';
import { useWatchLocation } from '../../hooks/useWatchLocation';
import { calculateWalkProgress } from '../../utils/walkProgress';
import { radii, spacing } from '../../theme/tokens';

export interface WalkEndSnapshot {
  traveledKm: number;
  elapsedMs: number;
}

interface Props {
  routeResult: WalkRouteResponse;
  onRequestEnd: (snapshot: WalkEndSnapshot) => void;
}

export function WalkInProgressScreen({ routeResult, onRequestEnd }: Props) {
  const { coords } = useWatchLocation();
  const startedAtRef = useRef(Date.now());

  const progress = useMemo(() => {
    if (!coords) return { traveledKm: 0, remainingKm: routeResult.total_km, progressRatio: 0 };
    return calculateWalkProgress(
      [coords.latitude, coords.longitude],
      routeResult.coordinates,
      routeResult.total_km,
    );
  }, [coords, routeResult]);

  const currentLocation = coords
    ? { lat: coords.latitude, lon: coords.longitude, address: null, place_name: null }
    : null;

  const handleEnd = () => {
    onRequestEnd({
      traveledKm: progress.traveledKm,
      elapsedMs: Date.now() - startedAtRef.current,
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.statsSection} edges={['top', 'left', 'right']}>
        <View style={styles.statsHeader}>
          <Text style={styles.traveledKm}>{progress.traveledKm.toFixed(1)} km</Text>
          <Text style={styles.goalKm}>목표 {routeResult.total_km.toFixed(1)}km</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress.progressRatio * 100)}%` }]} />
        </View>
        <View style={styles.statsFooter}>
          <Text style={styles.progressLabel}>{Math.round(progress.progressRatio * 100)}% 걸었어요</Text>
          <Text style={styles.remainingLabel}>남은 거리 {progress.remainingKm.toFixed(1)}km</Text>
        </View>
      </SafeAreaView>

      <View style={styles.mapSection}>
        <RouteMapView
          mode="walk"
          currentLocation={currentLocation}
          route={routeResult.coordinates}
          style={StyleSheet.absoluteFill}
          zoomControlBottomOffset={96}
        />

        <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
          <Pressable
            onPress={handleEnd}
            style={({ pressed }) => [styles.endButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.endButtonText}>■ 산책 종료</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  statsSection: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  mapSection: {
    flex: 1,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  traveledKm: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111',
  },
  goalKm: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9E9E9E',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#111',
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
  },
  remainingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  endButton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
