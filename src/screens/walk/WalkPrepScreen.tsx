import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteMapView } from '../../components/map';
import { Button } from '../../components/Button';
import { DevChip } from '../../components/DevChip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatRow } from '../../components/StatRow';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { WALK_MODE_LABEL } from '../../utils/walkMode';
import { isLoopRoute, reverseRoute } from '../../utils/geo';
import { colors, radii, shadows, spacing } from '../../theme/tokens';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  /** 도로 스냅(Map Matching)이 아직 진행 중이면 시작 버튼 대신 스냅 바를 띄운다 — 산책 중 경로 교체를 없애기 위함. */
  snapPending: boolean;
  /** 방향 전환 버튼으로 고른 최종 좌표(반전 안 했으면 routeResult.coordinates 그대로)를 넘긴다. */
  onStart: (coordinates: WalkRouteResponse['coordinates']) => void;
  onBack: () => void;
}

export function WalkPrepScreen({
  routeResult,
  currentLocation,
  snapPending,
  onStart,
  onBack,
}: Props) {
  const durationMinutes = estimateDurationMinutes(routeResult.total_km);
  const kcal = estimateKcal(routeResult.total_km);

  // [DEV] 실제 스냅은 1초 안에 끝나 "경로를 도로에 맞추는 중…" 상태를 눈으로 보기 어렵다.
  // 이 토글로 그 상태(시작 버튼 자리에 뜨는 스냅 바)를 붙잡아 둔다.
  const [devForceSnap, setDevForceSnap] = useState(false);
  const snapping = snapPending || devForceSnap;

  // 순환 코스 진행 방향 선택 — 편도는 시작·끝이 고정이라 버튼 자체를 안 보여준다. 산책을
  // 시작하기 전에만 고를 수 있게 해서(산책 중엔 안 바뀜) 진행률 계산이 방향과 무관하게 단순하다.
  const isLoop = useMemo(() => isLoopRoute(routeResult.coordinates), [routeResult.coordinates]);
  const [reversed, setReversed] = useState(false);
  const previewRoute = useMemo(
    () => (reversed ? reverseRoute(routeResult.coordinates) : routeResult.coordinates),
    [reversed, routeResult.coordinates],
  );

  const handleStart = () => onStart(previewRoute);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="산책 준비" onBack={onBack} plain align="center" />

      <View style={styles.mapCard}>
        <RouteMapView
          mode="overview"
          currentLocation={currentLocation}
          previewRoute={previewRoute}
          previewRouteSolid
          showDirectionArrows
          fitRouteOnMount
          style={styles.map}
        />

        {isLoop ? (
          <View style={styles.directionOverlay} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="순환 경로 진행 방향 전환"
              style={styles.directionButton}
              onPress={() => setReversed(v => !v)}
            >
              <Text style={styles.directionButtonText}>⇄ 방향 전환</Text>
            </Pressable>
          </View>
        ) : null}
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

      {__DEV__ ? (
        <View style={styles.devRow}>
          <DevChip
            label={devForceSnap ? '[DEV] 스냅 화면 해제' : '[DEV] 도로 스냅 화면 보기'}
            onPress={() => setDevForceSnap(v => !v)}
          />
        </View>
      ) : null}

      {snapping ? (
        <View style={styles.snapBar}>
          <ActivityIndicator size="small" color={colors.inkMuted} />
          <Text style={styles.snapBarText}>경로를 도로에 맞추는 중…</Text>
        </View>
      ) : (
        <Button label="▶ 산책 시작" onPress={handleStart} style={styles.startButton} />
      )}
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
  directionOverlay: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
  },
  directionButton: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.map,
  },
  directionButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
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
  devRow: {
    marginTop: 'auto',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
  },
  snapBar: {
    height: 52,
    marginHorizontal: spacing.lg,
    marginTop: 'auto',
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  snapBarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  startButton: {
    marginHorizontal: spacing.lg,
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
