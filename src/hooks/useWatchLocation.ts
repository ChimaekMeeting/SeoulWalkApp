import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Coordinates } from '../types/location';
import { DEBUG_FIXED_COORDS } from '../config/debugLocation';
import { debugLog } from '../utils/logger';

/**
 * 산책 중(6b) 실시간 위치 추적용 훅. 1회성 조회만 하는 useLocation과 달리
 * 위치가 바뀔 때마다 계속 갱신된다. 위치 권한은 이미 허용된 상태에서
 * 마운트된다고 가정한다(App.tsx의 권한 플로우를 통과한 뒤 진입).
 *
 * `EXPO_PUBLIC_DEBUG_FIXED_LOCATION`이 설정된 개발 환경에서는 useLocation과 동일하게
 * 실제 GPS 대신 고정 좌표를 쓴다(예전엔 이 훅만 디버그 좌표를 무시해서 디버그 모드로
 * 산책하면 좌표가 안 잡혔다).
 */
export function useWatchLocation() {
  const [coords, setCoords] = useState<Coordinates | null>(DEBUG_FIXED_COORDS);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (DEBUG_FIXED_COORDS) {
      setCoords(DEBUG_FIXED_COORDS);
      return () => {
        mountedRef.current = false;
      };
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
      position => {
        if (cancelled || !mountedRef.current) return;
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp ?? Date.now(),
          accuracy: position.coords.accuracy,
        });
      },
    )
      .then(sub => {
        if (cancelled) {
          sub.remove();
          return;
        }
        subscription = sub;
      })
      .catch(err => {
        debugLog('useWatchLocation', 'watchPositionAsync failed', {
          message: String(err?.message ?? err),
        });
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      subscription?.remove();
    };
  }, []);

  return { coords };
}
