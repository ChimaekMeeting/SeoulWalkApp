import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  traveledKm: number;
  minutes: number;
  steps: number;
  thumbnailUrl: string | null;
}

/**
 * 화면엔 안 보이고 공유 이미지 캡처용으로만 쓰는 카드 — 실시간 지도 대신 라벨 없는 정적 지도를 써서
 * 캡처 결과가 항상 일정하다. 부모가 ref로 `capture()`를 호출해 PNG URI를 얻는다.
 */
export const ShareCard = forwardRef<ViewShotRef, Props>(function ShareCard(
  { traveledKm, minutes, steps, thumbnailUrl },
  ref,
) {
  return (
    <View style={styles.hiddenCaptureArea} pointerEvents="none">
      <ViewShot ref={ref} style={styles.shareCard} options={{ format: 'png', quality: 0.95 }}>
        <Text style={styles.shareBrandText}>🚶 ROUDIE</Text>

        <View style={styles.shareCelebrate}>
          <Text style={styles.shareCelebrateIcon}>🎉</Text>
          <Text style={styles.shareCelebrateTitle}>축하합니다!</Text>
        </View>

        <View style={styles.shareHeroStat}>
          <Text style={styles.shareHeroValue}>{traveledKm.toFixed(1)}</Text>
          <Text style={styles.shareHeroUnit}>km 걸었어요</Text>
        </View>

        <View style={styles.shareStatRow}>
          <ShareStat value={`${minutes}`} unit="분" />
          <View style={styles.shareStatDivider} />
          <ShareStat value={steps.toLocaleString()} unit="걸음" />
        </View>

        {thumbnailUrl ? (
          <View style={styles.shareRoutePreview}>
            <Image source={{ uri: thumbnailUrl }} style={styles.shareRoutePreviewImage} />
          </View>
        ) : null}
      </ViewShot>
    </View>
  );
});

function ShareStat({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.shareStat}>
      <Text style={styles.shareStatValue}>{value}</Text>
      <Text style={styles.shareStatUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenCaptureArea: {
    position: 'absolute',
    top: 0,
    left: -9999,
    width: 320 + spacing.xl * 2,
  },
  shareCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
  },
  shareBrandText: {
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: colors.mintDeep,
  },
  shareCelebrate: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  shareCelebrateIcon: {
    fontSize: 36,
  },
  shareCelebrateTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },
  shareHeroStat: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  shareHeroValue: {
    fontSize: 52,
    fontWeight: '900',
    color: colors.mintDeep,
    lineHeight: 58,
  },
  shareHeroUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  shareStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  shareStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.line,
  },
  shareStat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  shareStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111',
  },
  shareStatUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  shareRoutePreview: {
    marginTop: spacing.xl,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#f4f4f4',
  },
  shareRoutePreviewImage: {
    width: '100%',
    aspectRatio: 1,
  },
});
