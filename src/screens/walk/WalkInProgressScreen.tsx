import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pedometer } from 'expo-sensors';
import { RouteMapView } from '../../components/map';
import { Button } from '../../components/Button';
import { DevChip } from '../../components/DevChip';
import { WalkRouteResponse } from '../../types/prewalk';
import { WalkEndSnapshot } from '../../types/walk';
import { useWatchLocation } from '../../hooks/useWatchLocation';
import { useWalkProgress } from '../../hooks/useWalkProgress';
import { resolveEndReason } from '../../utils/walkProgress';
import { polylineLengthKm } from '../../utils/geo';
import { colors, spacing } from '../../theme/tokens';

interface Props {
  routeResult: WalkRouteResponse;
  /** 개발용 — 도로 스냅 전 원본 경로 좌표. [DEV] "원본 경로 보기" 칩으로 빨간 점선 오버레이를 켠다. */
  originalRouteCoordinates?: WalkRouteResponse['coordinates'];
  onRequestEnd: (snapshot: WalkEndSnapshot) => void;
  /** 종착점 geofence로 완료가 확정됐을 때 1회 호출 — 상위(WalkFlow)가 완료 확인 모달을 띄운다. */
  onGoalReached: (snapshot: WalkEndSnapshot) => void;
}

export function WalkInProgressScreen({
  routeResult,
  originalRouteCoordinates,
  onRequestEnd,
  onGoalReached,
}: Props) {
  const { coords } = useWatchLocation();
  // 폰 자체 뒤로가기/홈 제스처 바에 줌 버튼이 가려지지 않도록 하단 안전영역만큼 더 띄운다.
  const insets = useSafeAreaInsets();
  const startedAtRef = useRef(Date.now());
  const stepsRef = useRef<number | null>(null);
  // 완료 제안(onGoalReached)은 한 번만 — "더 걷기"를 눌러도 다시 뜨지 않게.
  const goalFiredRef = useRef(false);
  // [DEV] 스냅 전 원본 경로 오버레이 on/off.
  const [showOriginalRoute, setShowOriginalRoute] = useState(false);

  // 진행률 분모는 백엔드 total_km가 아니라 tracker가 실제 투영에 쓰는 폴리라인의 누적 길이다
  // (직선 현 vs 실도로라 스케일이 달라 total_km로 나누면 종착점에서도 100%에 못 닿는다).
  // routeResult는 WalkFlow가 walking 진입 시점에 얼린 값이라 산책 중 좌표가 바뀌지 않는다.
  const routeLengthKm = useMemo(
    () => polylineLengthKm(routeResult.coordinates),
    [routeResult.coordinates],
  );
  const { progress, dev } = useWalkProgress(coords, routeResult.coordinates, routeLengthKm);

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

  const currentLocation = coords
    ? { lat: coords.latitude, lon: coords.longitude, address: null, place_name: null }
    : null;

  const buildSnapshot = (): WalkEndSnapshot => ({
    routeProgressKm: progress.routeProgressKm,
    routeProgressRatio: progress.routeProgressRatio,
    remainingRouteKm: progress.remainingRouteKm,
    actualDistanceKm: progress.actualDistanceKm,
    elapsedMs: Date.now() - startedAtRef.current,
    steps: stepsRef.current,
    endReason: resolveEndReason(progress.state, coords != null),
  });

  const handleEnd = () => {
    onRequestEnd(buildSnapshot());
  };

  // 종착점 geofence로 완료가 확정되면 완료 확인을 1회 제안한다(진행률 숫자가 아니라 state 기준).
  useEffect(() => {
    if (goalFiredRef.current) return;
    if (progress.state !== 'complete') return;
    goalFiredRef.current = true;
    onGoalReached(buildSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.state]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.statsSection} edges={['top', 'left', 'right']}>
        <View style={styles.statsHeader}>
          <Text style={styles.traveledKm}>{progress.routeProgressKm.toFixed(1)} km</Text>
          <Text style={styles.goalKm}>목표 {routeResult.total_km.toFixed(1)}km</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progress.routeProgressRatio * 100)}%` },
            ]}
          />
        </View>
        <View style={styles.statsFooter}>
          <Text style={styles.progressLabel}>
            {Math.round(progress.routeProgressRatio * 100)}% 걸었어요
          </Text>
          <Text style={styles.remainingLabel}>
            남은 거리 {progress.remainingRouteKm.toFixed(1)}km
          </Text>
        </View>
        {dev ? (
          <View style={styles.devPanel}>
            <Text style={styles.devLabel}>[DEV] state: {progress.state}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.devRow}
            >
              <DevChip label="25%" onPress={() => dev.seek(0.25)} />
              <DevChip label="50%" onPress={() => dev.seek(0.5)} />
              <DevChip label="99%" onPress={() => dev.seek(0.99)} />
              <DevChip label="완주" onPress={dev.complete} />
              <DevChip label="이탈" onPress={dev.offRoute} />
              <DevChip label="GPS 재개" onPress={dev.resume} />
              <DevChip label="0%로 초기화" onPress={dev.reset} />
              {originalRouteCoordinates && originalRouteCoordinates.length > 1 ? (
                <DevChip
                  label={showOriginalRoute ? '원본 경로 숨기기' : '원본 경로 보기'}
                  onPress={() => setShowOriginalRoute(v => !v)}
                />
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </SafeAreaView>

      <View style={styles.mapSection}>
        <RouteMapView
          mode="walk"
          currentLocation={currentLocation}
          route={routeResult.coordinates}
          routeProgressKm={progress.routeProgressKm}
          debugOverlayRoute={showOriginalRoute ? originalRouteCoordinates : undefined}
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
  devPanel: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ff6b35',
    letterSpacing: 0.3,
  },
  devRow: {
    gap: spacing.xs,
    paddingRight: spacing.lg,
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
