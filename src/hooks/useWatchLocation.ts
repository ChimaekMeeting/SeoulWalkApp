import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Coordinates } from '../types/location';
import { useDevLocationOverride } from './useDevLocationOverride';
import { debugLog } from '../utils/logger';

/**
 * 산책 중(6b) 실시간 위치 추적용 훅. 1회성 조회만 하는 useLocation과 달리
 * 위치가 바뀔 때마다 계속 갱신된다. 위치 권한은 이미 허용된 상태에서
 * 마운트된다고 가정한다(App.tsx의 권한 플로우를 통과한 뒤 진입).
 *
 * 개발용 GPS 오버라이드(`EXPO_PUBLIC_DEBUG_FIXED_LOCATION` 또는 DevLocationChips로 경로 위
 * 지점 선택)가 걸려 있으면 useLocation과 동일하게 실제 GPS watch 대신 그 좌표를 쓴다. 오버라이드가
 * 바뀌면 watch를 걷어내고 새 좌표를 반영하고, 해제되면 실제 watch를 다시 건다.
 */
export function useWatchLocation() {
  const debugOverride = useDevLocationOverride();
  const [coords, setCoords] = useState<Coordinates | null>(debugOverride);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (debugOverride) {
      setCoords(debugOverride);
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
  }, [debugOverride]);

  return { coords };
}
