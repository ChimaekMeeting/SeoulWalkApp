import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteMapView } from '../../components/map';
import { Button } from '../../components/Button';
import { DevChip } from '../../components/DevChip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatRow } from '../../components/StatRow';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { WALK_MODE_LABEL } from '../../utils/walkMode';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  /** 도로 스냅(Map Matching)이 아직 진행 중이면 시작 버튼을 잠근다 — 산책 중 경로 교체를 없애기 위함. */
  snapPending: boolean;
  onStart: () => void;
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
  // 이 토글로 그 상태(힌트 문구 + 시작 버튼 스피너/잠금)를 붙잡아 둔다.
  const [devForceSnap, setDevForceSnap] = useState(false);
  const snapping = snapPending || devForceSnap;

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

      {__DEV__ ? (
        <View style={styles.devRow}>
          <DevChip
            label={devForceSnap ? '[DEV] 스냅 화면 해제' : '[DEV] 도로 스냅 화면 보기'}
            onPress={() => setDevForceSnap(v => !v)}
          />
        </View>
      ) : null}

      {snapping ? (
        <Text style={styles.snapHint}>경로를 도로에 맞추는 중…</Text>
      ) : null}
      <Button
        label="▶ 산책 시작"
        onPress={onStart}
        loading={snapping}
        style={styles.startButton}
      />
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
  devRow: {
    marginTop: 'auto',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
  },
  snapHint: {
    marginTop: 'auto',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
    textAlign: 'center',
  },
  startButton: {
    marginHorizontal: spacing.lg,
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
