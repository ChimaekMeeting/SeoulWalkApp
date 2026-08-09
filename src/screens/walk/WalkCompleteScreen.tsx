import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ViewShotRef } from 'react-native-view-shot';
import RNShare, { Social } from 'react-native-share';
import { toggleFavoriteRoute } from '../../api/routes';
import { estimateSteps } from '../../utils/walkEstimate';
import { buildRouteThumbnailUrl } from '../../utils/routeThumbnail';
import { colors, radii, spacing } from '../../theme/tokens';
import { RouteMapView } from '../../components/map';
import { ShareCard } from '../../components/walk/ShareCard';
import { env } from '../../config/env';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';

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
    if (instaSharing || !env.INSTAGRAM_APP_ID) return;
    setInstaSharing(true);
    try {
      const uri = await shareCardRef.current?.capture?.();
      if (uri) {
        await RNShare.shareSingle({
          social: Social.InstagramStories,
          appId: env.INSTAGRAM_APP_ID,
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
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
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

      <ShareCard
        ref={shareCardRef}
        traveledKm={traveledKm}
        minutes={minutes}
        steps={steps}
        thumbnailUrl={thumbnailUrl}
      />

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
