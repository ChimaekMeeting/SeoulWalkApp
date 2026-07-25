import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { WalkMode, WalkRouteResponse } from '../../types/prewalk';
import { RouteHistoryItem } from '../../types/routes';
import { getRouteHistories, toggleFavoriteRoute } from '../../api/routes';
import { estimateDurationMinutes } from '../../utils/walkEstimate';
import { buildRouteThumbnailUrl } from '../../utils/routeThumbnail';
import { formatHistoryDate, routeHistoryToWalkRoute } from '../../utils/routeHistory';
import { WALK_MODE_LABEL } from '../../utils/walkMode';
import { colors, radii, spacing } from '../../theme/tokens';
import { HistoryPlaceLabel } from './HistoryPlaceLabel';

export type HistoryFilter = 'recent' | 'favorite';

interface Props {
  filter: HistoryFilter;
  onSelectRoute: (route: WalkRouteResponse) => void;
}

export function RouteHistoryList({ filter, onSelectRoute }: Props) {
  const [histories, setHistories] = useState<RouteHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getRouteHistories({
      limit: 20,
      is_favorite: filter === 'favorite' ? true : undefined,
    })
      .then(res => {
        if (!cancelled) setHistories(res.histories);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const handleToggleFavorite = async (id: number) => {
    try {
      const updated = await toggleFavoriteRoute(id);
      setHistories(prev =>
        filter === 'favorite' && !updated.is_favorite
          ? prev.filter(h => h.id !== id)
          : prev.map(h => (h.id === id ? updated : h)),
      );
    } catch {
      // 무시: 다음 조회 때 실제 상태로 다시 맞춰짐
    }
  };

  if (loading) {
    return <Text style={styles.historyEmptyText}>불러오는 중...</Text>;
  }
  if (error) {
    return <Text style={styles.historyEmptyText}>경로 기록을 불러오지 못했어요.</Text>;
  }
  if (histories.length === 0) {
    return (
      <Text style={styles.historyEmptyText}>
        {filter === 'favorite' ? '즐겨찾기한 경로가 없어요.' : '아직 산책 기록이 없어요.'}
      </Text>
    );
  }

  return (
    <>
      {histories.map(history => {
        const thumbnailUrl = buildRouteThumbnailUrl(history.coordinates);
        return (
          <Pressable
            key={history.id}
            style={styles.historyCard}
            onPress={() => onSelectRoute(routeHistoryToWalkRoute(history))}
          >
            {thumbnailUrl ? (
              <Image source={{ uri: thumbnailUrl }} style={styles.historyThumb} />
            ) : (
              <View style={styles.historyThumb} />
            )}
            <View style={styles.historyCardBody}>
              <Text style={styles.historyCardTitle}>
                {WALK_MODE_LABEL[history.mode as WalkMode] ?? history.mode}
              </Text>
              <HistoryPlaceLabel history={history} />
              <Text style={styles.historyCardMeta}>
                {history.total_km.toFixed(1)}km · 약 {estimateDurationMinutes(history.total_km)}분
              </Text>
              <Text style={styles.historyCardDate}>{formatHistoryDate(history.created_at)}</Text>
            </View>
            <Pressable
              onPress={() => handleToggleFavorite(history.id)}
              hitSlop={8}
              style={styles.historyCardStar}
            >
              <Text style={styles.starText}>{history.is_favorite ? '★' : '☆'}</Text>
            </Pressable>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  historyThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: '#f4f4f4',
    overflow: 'hidden',
  },
  historyCardBody: {
    flex: 1,
    gap: 2,
  },
  historyCardTitle: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '900',
  },
  historyCardMeta: {
    color: '#5c5c5c',
    fontSize: 12,
    fontWeight: '800',
  },
  historyCardDate: {
    color: '#8a8a8a',
    fontSize: 11,
    fontWeight: '700',
  },
  historyCardStar: {
    paddingLeft: spacing.xs,
  },
  starText: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
  },
  historyEmptyText: {
    color: '#8a8a8a',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
