import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Coordinates } from './useLocation';

/**
 * 산책 중(6b) 실시간 위치 추적용 훅. 1회성 조회만 하는 useLocation과 달리
 * 위치가 바뀔 때마다 계속 갱신된다. 위치 권한은 이미 허용된 상태에서
 * 마운트된다고 가정한다(App.tsx의 권한 플로우를 통과한 뒤 진입).
 */
export function useWatchLocation() {
  const [coords, setCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
      position => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
    ).then(sub => {
      if (cancelled) {
        sub.remove();
        return;
      }
      subscription = sub;
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return { coords };
}
