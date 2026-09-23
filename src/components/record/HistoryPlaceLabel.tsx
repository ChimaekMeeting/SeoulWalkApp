import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../Text';
import { RouteHistoryItem } from '../../types/routes';
import {
  peekCachedPlaceName,
  reverseGeocodePlaceName,
} from '../../utils/reverseGeocode';

/* 이름만으로 구분되지 않는 같은 모드의 경로들을 구분하기 위해 출발·도착 장소명을 보여준다.
 * 챗봇을 거쳐 만든 경로는 백엔드가 origin_place_name/destination_place_name(장소명, 없으면 주소
 * origin_address/destination_address)을 이미 채워주므로 그걸 그대로 쓰고, 둘 다 없는 경우(직접
 * 경로 API로 만든 경로·이전 기록)에만 좌표를 역지오코딩한다. */
export function HistoryPlaceLabel({ history }: { history: RouteHistoryItem }) {
  const backendOrigin = history.origin_place_name ?? history.origin_address;
  const backendDest =
    history.destination_lat != null
      ? history.destination_place_name ?? history.destination_address
      : null;

  // 이번 세션에 이미 조회한 좌표면 state 초기값부터 채워서 첫 렌더에 바로 보이게 한다 — useEffect
  // 안에서만 캐시를 확인하면 캐시 히트여도 항상 한 번은 빈 상태로 그려진 뒤에야 갱신됐다.
  const [originName, setOriginName] = useState<string | null>(
    () =>
      backendOrigin ??
      peekCachedPlaceName(history.origin_lat, history.origin_lon) ??
      null,
  );
  const [destName, setDestName] = useState<string | null>(() => {
    if (history.destination_lat == null || history.destination_lon == null)
      return null;
    return (
      backendDest ??
      peekCachedPlaceName(history.destination_lat, history.destination_lon) ??
      null
    );
  });

  useEffect(() => {
    let cancelled = false;
    // 백엔드가 이미 이름(장소명 또는 주소)을 줬으면 역지오코딩 자체를 호출하지 않는다.
    if (backendOrigin == null) {
      reverseGeocodePlaceName(history.origin_lat, history.origin_lon).then(
        name => {
          if (!cancelled) setOriginName(name);
        },
      );
    }
    if (
      backendDest == null &&
      history.destination_lat != null &&
      history.destination_lon != null
    ) {
      reverseGeocodePlaceName(
        history.destination_lat,
        history.destination_lon,
      ).then(name => {
        if (!cancelled) setDestName(name);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    history.id,
    history.origin_lat,
    history.origin_lon,
    history.destination_lat,
    history.destination_lon,
    backendOrigin,
    backendDest,
  ]);

  // 역지오코딩 응답 전엔 자리를 비워두지 않고(레이아웃 점프 방지) 투명한 채로 높이만 예약한다 —
  // 응답이 오면 opacity만 바뀌어 텍스트가 부드럽게 나타나고, 아래 날짜 줄이 밀리지 않는다.
  const label = originName
    ? destName
      ? `${originName} → ${destName}`
      : `${originName} 출발`
    : null;

  return (
    <Text
      style={[styles.historyCardPlace, !label && styles.historyCardPlaceHidden]}
      numberOfLines={1}
    >
      {label ?? ' '}
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
  historyCardPlaceHidden: {
    opacity: 0,
  },
});
