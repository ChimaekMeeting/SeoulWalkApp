import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import RNShare, { Social } from 'react-native-share';
import { toggleFavoriteRoute } from '../../api/routes';
import { estimateSteps } from '../../utils/walkEstimate';
import { buildRouteThumbnailUrl } from '../../utils/geo';
import { colors, radii, spacing } from '../../theme/tokens';
import { RouteMapView } from '../../components/map';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';

// Meta(Facebook) Developers에 등록한 앱 ID — Instagram 스토리 직행 공유(shareSingle)에 필수.
const INSTAGRAM_APP_ID = '1282650127107639';

interface Props {
  routeResult: WalkRouteResponse;
  currentLocation: LocationInfo | null;
  traveledKm: number;
  elapsedMs: number;
  /** 실제 만보계 걸음 수(6b에서 측정). 만보계를 못 쓴 경우 null이면 거리 기반 추정치를 대신 보여준다. */
  steps?: number | null;
  /** WalkRouteResponse에 아직 route id가 없어 optional — 없으면 즐겨찾기 비활성. */
  routeId?: number;
  onHome: () => void;
}

export function WalkCompleteScreen({
  routeResult,
  currentLocation,
  traveledKm,
  elapsedMs,
  steps: measuredSteps,
  routeId,
  onHome,
}: Props) {
  const [isFavorite, setIsFavorite] = useState(routeResult.is_favorite ?? false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [instaSharing, setInstaSharing] = useState(false);
  const shareCardRef = useRef<ViewShotRef>(null);

  const minutes = Math.round(elapsedMs / 60000);
  const steps = measuredSteps ?? estimateSteps(traveledKm);
  const thumbnailUrl = buildRouteThumbnailUrl(routeResult.coordinates, 320);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await shareCardRef.current?.capture?.();
      await RNShare.open({
        url: uri,
        message: `방금 ${traveledKm.toFixed(1)}km, ${minutes}분 동안 산책했어요! 🚶`,
        failOnCancel: false,
      });
    } catch {
      // 캡처 실패/공유 취소 등 — 무시
    } finally {
      setSharing(false);
    }
  };

  const handleInstagramStoryShare = async () => {
    if (instaSharing) return;
    setInstaSharing(true);
    try {
      const uri = await shareCardRef.current?.capture?.();
      if (uri) {
        await RNShare.shareSingle({
          social: Social.InstagramStories,
          appId: INSTAGRAM_APP_ID,
          stickerImage: uri,
          backgroundTopColor: colors.mintDeep,
          backgroundBottomColor: '#04302a',
        });
      }
    } catch {
      // 인스타그램 미설치/공유 취소 등 — 무시
    } finally {
      setInstaSharing(false);
    }
  };

  const handleFavorite = async () => {
    if (routeId == null || favoritePending) return;
    setFavoritePending(true);
    try {
      const updated = await toggleFavoriteRoute(routeId);
      setIsFavorite(updated.is_favorite);
    } finally {
      setFavoritePending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Text style={styles.header}>산책 완료!</Text>

      <View style={styles.celebrate}>
        <Text style={styles.celebrateIcon}>🎉</Text>
        <Text style={styles.celebrateTitle}>축하합니다!</Text>
      </View>

      <View style={styles.statRow}>
        <Stat value={traveledKm.toFixed(1)} unit="km" />
        <Stat value={`${minutes}`} unit="분" />
        <Stat value={steps.toLocaleString()} unit="걸음" />
      </View>

      <View style={styles.routePreview}>
        <RouteMapView
          mode="overview"
          currentLocation={currentLocation}
          previewRoute={routeResult.coordinates}
          fitRouteOnMount
          showZoomControls={false}
          style={styles.routePreviewMap}
        />
      </View>

      {/* 화면엔 안 보이고 공유 이미지 캡처용으로만 쓰는 카드 — 실시간 지도 대신 라벨 없는 정적 지도를 써서 캡처 결과가 항상 일정하다. */}
      <View style={styles.hiddenCaptureArea} pointerEvents="none">
        <ViewShot
          ref={shareCardRef}
          style={styles.shareCard}
          options={{ format: 'png', quality: 0.95 }}
        >
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

      <View style={styles.actionRow}>
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          style={({ pressed }) => [
            styles.secondaryButton,
            sharing && styles.secondaryButtonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText} numberOfLines={1}>
            {sharing ? '공유중...' : '🔗 공유'}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleFavorite}
          disabled={routeId == null || favoritePending}
          style={({ pressed }) => [
            styles.secondaryButton,
            (routeId == null || favoritePending) && styles.secondaryButtonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText} numberOfLines={1}>
            {isFavorite ? '★ 즐겨찾기됨' : '☆ 즐겨찾기'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleInstagramStoryShare}
        disabled={instaSharing}
        style={({ pressed }) => [
          styles.instagramButton,
          instaSharing && styles.secondaryButtonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.instagramButtonText}>
          {instaSharing ? '공유 준비 중...' : '📸 인스타 스토리로 공유'}
        </Text>
      </Pressable>

      <Pressable
        onPress={onHome}
        style={({ pressed }) => [styles.homeButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.homeButtonText}>홈으로</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

function ShareStat({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.shareStat}>
      <Text style={styles.shareStatValue}>{value}</Text>
      <Text style={styles.shareStatUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: spacing.xl,
  },
  header: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginTop: spacing.md,
  },
  celebrate: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  celebrateIcon: {
    fontSize: 40,
  },
  celebrateTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xxl,
  },
  stat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  routePreview: {
    marginTop: spacing.xl,
    height: 160,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#f2fbf7',
  },
  routePreviewMap: {
    flex: 1,
  },
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  secondaryButtonDisabled: {
    opacity: 0.4,
  },
  secondaryButtonText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '700',
  },
  instagramButton: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: '#fce3ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instagramButtonText: {
    color: '#c2185b',
    fontSize: 14,
    fontWeight: '800',
  },
  homeButton: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
