import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { WalkMode, WalkRouteResponse, WalkRouteStatus } from '../../types/prewalk';
import { RouteHistoryItem } from '../../types/routes';
import { getRouteHistories, toggleFavoriteRoute } from '../../api/routes';
import { estimateDurationMinutes } from '../../utils/walkEstimate';
import { buildRouteThumbnailUrl } from '../../utils/geo';
import { reverseGeocodePlaceName } from '../../utils/reverseGeocode';
import { colors, radii, spacing } from '../../theme/tokens';

const HISTORY_MODE_LABEL: Record<string, string> = {
  [WalkMode.CIRCULAR_RANDOM]: '순환 코스',
  [WalkMode.ONEWAY_SHORTEST]: '편도 코스',
  [WalkMode.ONEWAY_RANDOM]: '편도 코스',
};

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_LABEL[date.getDay()]}`;
}

type HistoryFilter = 'recent' | 'favorite';

/* 저장된 경로 기록을 다시 산책 시작(6a)에 쓸 수 있도록 WalkRouteResponse 형태로 변환한다. */
function routeHistoryToWalkRoute(history: RouteHistoryItem): WalkRouteResponse {
  return {
    status: WalkRouteStatus.SUCCESS,
    mode: history.mode as WalkMode,
    coordinates: history.coordinates as [number, number][],
    total_km: history.total_km,
    id: history.id,
    is_favorite: history.is_favorite,
  };
}

/* 이름만으로 구분되지 않는 같은 모드의 경로들을 구분하기 위해, 좌표를 실제 장소명으로 역지오코딩해 보여준다. */
function HistoryPlaceLabel({ history }: { history: RouteHistoryItem }) {
  const [originName, setOriginName] = useState<string | null>(null);
  const [destName, setDestName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    reverseGeocodePlaceName(history.origin_lat, history.origin_lon).then(name => {
      if (!cancelled) setOriginName(name);
    });
    if (history.destination_lat != null && history.destination_lon != null) {
      reverseGeocodePlaceName(history.destination_lat, history.destination_lon).then(name => {
        if (!cancelled) setDestName(name);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [history.id, history.origin_lat, history.origin_lon, history.destination_lat, history.destination_lon]);

  if (!originName) return null;

  return (
    <Text style={styles.historyCardPlace} numberOfLines={1}>
      {destName ? `${originName} → ${destName}` : `${originName} 출발`}
    </Text>
  );
}

interface RouteHistoryListProps {
  filter: HistoryFilter;
  onSelectRoute: (route: WalkRouteResponse) => void;
}

function RouteHistoryList({ filter, onSelectRoute }: RouteHistoryListProps) {
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
                {HISTORY_MODE_LABEL[history.mode] ?? history.mode}
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

interface RecordTabProps {
  /** 경로 기록 카드를 눌렀을 때 그 경로로 다시 산책(6a)을 시작하도록 호출된다. */
  onSelectRoute: (route: WalkRouteResponse) => void;
}

export function RecordTab({ onSelectRoute }: RecordTabProps) {
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('recent');

  return (
    <View style={styles.recordPage}>
      <ScreenHeader title="기록" />
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={styles.historyTabRow}>
          {(
            [
              ['recent', '최근 경로'],
              ['favorite', '즐겨찾기'],
            ] as [HistoryFilter, string][]
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setHistoryFilter(value)}
              style={[
                styles.historyTabPill,
                historyFilter === value && styles.historyTabPillActive,
              ]}
            >
              <Text
                style={[
                  styles.historyTabText,
                  historyFilter === value && styles.historyTabTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <RouteHistoryList filter={historyFilter} onSelectRoute={onSelectRoute} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  recordPage: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingBottom: 76,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },
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
  historyCardPlace: {
    color: '#5c5c5c',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
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
  historyTabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  historyTabPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyTabPillActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  historyTabText: {
    color: '#5c5c5c',
    fontWeight: '900',
    fontSize: 12,
  },
  historyTabTextActive: {
    color: colors.card,
  },
  historyEmptyText: {
    color: '#8a8a8a',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
