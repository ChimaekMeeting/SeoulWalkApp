import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteMapView } from '../../components/map';
import { Button } from '../../components/Button';
import { DevChip } from '../../components/DevChip';
import { DevLocationChips } from '../../components/DevLocationChips';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatRow } from '../../components/StatRow';
import { BackgroundLocationStatus } from '../../hooks/useBackgroundLocationPermission';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { estimateDurationMinutes, estimateKcal } from '../../utils/walkEstimate';
import { WALK_MODE_LABEL } from '../../utils/walkMode';
import { isLoopRoute, reverseRoute } from '../../utils/geo';
import { colors, radii, shadows, spacing } from '../../theme/tokens';
import { WalkEndConfirmModal } from './WalkEndConfirmModal';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  /** 도로 스냅(Map Matching)이 아직 진행 중이면 시작 버튼 대신 스냅 바를 띄운다 — 산책 중 경로 교체를 없애기 위함. */
  snapPending: boolean;
  /** 백그라운드("항상 허용") 위치 권한 상태 — 산책 시작 전에 물어봐 walking 화면까지 이어지게 한다. */
  bgPermissionStatus: BackgroundLocationStatus;
  /** "나중에"를 눌렀는지 — 누르면 이 산책 준비 화면에서는 배너를 다시 안 띄운다. */
  bgPromptDismissed: boolean;
  onAllowBackgroundLocation: () => Promise<boolean>;
  onOpenBackgroundLocationSettings: () => void;
  onDismissBackgroundPrompt: () => void;
  /** 방향 전환 버튼으로 고른 최종 좌표(반전 안 했으면 routeResult.coordinates 그대로)를 넘긴다. */
  onStart: (coordinates: WalkRouteResponse['coordinates']) => void;
  onBack: () => void;
}

export function WalkPrepScreen({
  routeResult,
  currentLocation,
  snapPending,
  bgPermissionStatus,
  bgPromptDismissed,
  onAllowBackgroundLocation,
  onOpenBackgroundLocationSettings,
  onDismissBackgroundPrompt,
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

  // 배너를 시작 버튼 옆에 항상 띄우면 버튼이 2개로 늘어 화면이 복잡해지므로, "산책 시작"을
  // 누른 시점에만 1회성 확인 모달로 물어본다 — 모달의 "나중에"/"허용하기"/"설정 열기" 중 뭘
  // 눌러도(허용 결과와 무관하게) 그대로 산책을 시작한다(선택 기능이라 산책 시작을 막지 않음).
  const needsBgPrompt =
    bgPermissionStatus !== 'granted' && bgPermissionStatus !== 'checking' && !bgPromptDismissed;
  const [bgModalVisible, setBgModalVisible] = useState(false);

  const handleStart = () => {
    if (needsBgPrompt) {
      setBgModalVisible(true);
      return;
    }
    onStart(previewRoute);
  };

  const dismissBgModalAndStart = () => {
    setBgModalVisible(false);
    onStart(previewRoute);
  };

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
          {/* GPS를 경로 위 지점으로 옮긴 뒤 뒤로 나갔다 다시 들어오면 그 위치 기준으로 시작점이 재정렬된다. */}
          <DevLocationChips routeCoords={routeResult.coordinates} />
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

      <WalkEndConfirmModal
        visible={bgModalVisible}
        icon="📍"
        title="화면을 꺼도 경로 안내를 받을까요?"
        subtitle={
          bgPermissionStatus === 'denied'
            ? '설정 앱에서 위치 권한을 "항상 허용"으로 바꾸면, 화면이 꺼지거나 다른 앱을 쓰는 동안에도 턴 안내가 이어져요.'
            : '위치 권한을 "항상 허용"하면 화면이 꺼지거나 다른 앱을 쓰는 동안에도 턴 안내가 이어져요.'
        }
        subtitleStyle={styles.bgModalSubtitle}
        confirmLabel={bgPermissionStatus === 'denied' ? '설정 열기' : '허용하기'}
        cancelLabel="나중에"
        onCancel={() => {
          onDismissBackgroundPrompt();
          dismissBgModalAndStart();
        }}
        onConfirm={async () => {
          if (bgPermissionStatus === 'denied') {
            // 설정 앱으로 나가는 경우라 여기선 기다릴 게 없다 — 사용자가 돌아왔을 때 이미 산책
            // 화면이어야 자연스럽다.
            onOpenBackgroundLocationSettings();
          } else {
            // OS 권한 다이얼로그 응답을 기다린 뒤 산책을 시작해야, walking 화면이 뜨자마자(잠금
            // 화면으로 넘어가도) 포그라운드 서비스 알림이 이미 켜져 있다 — 기다리지 않고 곧장
            // onStart하면 권한 결과가 아직 반영되기 전 렌더로 시작해 알림이 늦게(또는 화면이
            // 꺼진 뒤에야) 뜰 수 있었다.
            await onAllowBackgroundLocation();
          }
          dismissBgModalAndStart();
        }}
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
  // 문단이 화면 끝까지 넓게 퍼지면 읽기 힘들어서, 좌우 여백을 더 줘 가운데로 좁혀 보여준다.
  bgModalSubtitle: {
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  devRow: {
    marginTop: 'auto',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
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
