import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { RouteHistoryItem } from '../../types/routes';
import { reverseGeocodePlaceName } from '../../utils/reverseGeocode';

/* 이름만으로 구분되지 않는 같은 모드의 경로들을 구분하기 위해, 좌표를 실제 장소명으로 역지오코딩해 보여준다. */
export function HistoryPlaceLabel({ history }: { history: RouteHistoryItem }) {
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

const styles = StyleSheet.create({
  historyCardPlace: {
    color: '#5c5c5c',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
});
