import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pedometer } from 'expo-sensors';
import { RouteMapView } from '../../components/map';
import { Button } from '../../components/Button';
import { WalkRouteResponse } from '../../types/prewalk';
import { WalkEndSnapshot } from '../../types/walk';
import { useWatchLocation } from '../../hooks/useWatchLocation';
import { WalkProgressTracker, deriveProgress } from '../../utils/walkProgress';
import { colors, spacing } from '../../theme/tokens';

// 진행률이 이 값 이상이면 완주로 보고 완료를 제안한다. 경로 좌표열의 누적 길이와 total_km,
// GPS 투영 오차 때문에 정확히 1.0에는 안 닿을 수 있어 살짝 낮춘다.
const GOAL_REACHED_RATIO = 0.99;

interface Props {
  routeResult: WalkRouteResponse;
  onRequestEnd: (snapshot: WalkEndSnapshot) => void;
  /** 진행률이 목표(≈100%)에 도달했을 때 1회 호출 — 상위(WalkFlow)가 완주 확인 모달을 띄운다. */
  onGoalReached: (snapshot: WalkEndSnapshot) => void;
}

export function WalkInProgressScreen({ routeResult, onRequestEnd, onGoalReached }: Props) {
  const { coords } = useWatchLocation();
  // 폰 자체 뒤로가기/홈 제스처 바에 줌 버튼이 가려지지 않도록 하단 안전영역만큼 더 띄운다.
  const insets = useSafeAreaInsets();
  const startedAtRef = useRef(Date.now());
  const stepsRef = useRef<number | null>(null);
  // GPS 튐 필터링·연속 이탈 확인·직전 매칭 지점 기억을 위해 산책 한 번 동안 상태를 유지하는
  // 트래커. 화면이 마운트된 동안(=산책 한 번) 하나의 인스턴스를 그대로 재사용한다.
  const trackerRef = useRef(new WalkProgressTracker());
  // 완주 제안(onGoalReached)은 한 번만 — "더 걷기"를 눌러도 다시 뜨지 않게.
  const goalFiredRef = useRef(false);

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

  const buildSnapshot = (): WalkEndSnapshot => ({
    traveledKm: progress.traveledKm,
    elapsedMs: Date.now() - startedAtRef.current,
    steps: stepsRef.current,
  });

  const handleEnd = () => {
    onRequestEnd(buildSnapshot());
  };

  // 목표 거리에 도달하면 완주 확인을 1회 제안한다.
  useEffect(() => {
    if (goalFiredRef.current) return;
    if (progress.progressRatio < GOAL_REACHED_RATIO) return;
    goalFiredRef.current = true;
    onGoalReached(buildSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.progressRatio]);

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
          <Button label="■ 산책 종료" onPress={handleEnd} style={styles.endButton} />
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
    backgroundColor: colors.card,
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
    color: colors.ink,
  },
  goalKm: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  remainingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
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
  },
});
