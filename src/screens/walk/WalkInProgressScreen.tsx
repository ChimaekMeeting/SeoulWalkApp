import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pedometer } from 'expo-sensors';
import { RouteMapView } from '../../components/map';
import { WalkRouteResponse } from '../../types/prewalk';
import { WalkEndSnapshot } from '../../types/walk';
import { useWatchLocation } from '../../hooks/useWatchLocation';
import { WalkProgressTracker, deriveProgress } from '../../utils/walkProgress';
import { radii, spacing } from '../../theme/tokens';

interface Props {
  routeResult: WalkRouteResponse;
  onRequestEnd: (snapshot: WalkEndSnapshot) => void;
}

export function WalkInProgressScreen({ routeResult, onRequestEnd }: Props) {
  const { coords } = useWatchLocation();
  // 폰 자체 뒤로가기/홈 제스처 바에 줌 버튼이 가려지지 않도록 하단 안전영역만큼 더 띄운다.
  const insets = useSafeAreaInsets();
  const startedAtRef = useRef(Date.now());
  const stepsRef = useRef<number | null>(null);
  // GPS 튐 필터링·연속 이탈 확인·직전 매칭 지점 기억을 위해 산책 한 번 동안 상태를 유지하는
  // 트래커. 화면이 마운트된 동안(=산책 한 번) 하나의 인스턴스를 그대로 재사용한다.
  const trackerRef = useRef(new WalkProgressTracker());

  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;
    Pedometer.isAvailableAsync()
      .then(available => {
        if (!available || cancelled) return;
        subscription = Pedometer.watchStepCount(result => {
          stepsRef.current = result.steps;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  const progress = useMemo(() => {
    // coords가 아직 없는 경우는 첫 GPS fix 전뿐이라, 트래커도 아직 0에서 시작한 상태다.
    if (!coords) {
      return deriveProgress(0, routeResult.total_km);
    }
    return trackerRef.current.update(
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
      steps: stepsRef.current,
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
          traveledKm={progress.traveledKm}
          style={StyleSheet.absoluteFill}
          zoomControlBottomOffset={96 + insets.bottom}
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
