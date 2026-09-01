import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Coordinates } from '../types/location';
import { DEBUG_FIXED_COORDS } from '../config/debugLocation';
import { debugLog } from '../utils/logger';

/**
 * 홈 화면(경로 생성 챗봇)용 1회성 현재 위치 조회 훅.
 *
 * 이 훅은 **권한을 직접 요청하지 않는다** — 위치 권한은 AppBootstrap이 단일 기준으로
 * 관리하고, 여기서는 `enabled`(=AppBootstrap의 locationGranted)를 받아 좌표만 가져온다.
 * (예전엔 이 훅이 requestForegroundPermissionsAsync를 또 호출해서 권한 상태가 두 곳에서
 *  따로 관리됐다.)
 *
 * 실패를 조용히 삼키지 않는다:
 * - timeout(기본 10초)·GPS 미획득·권한 취소를 각각 error로 구분해 반환
 * - 좌표가 계속 null인 "실패" 상태와 "아직 로딩 중"을 isLoading으로 구분
 * - retry()로 앱 재시작 없이 다시 시도
 */

export type LocationErrorReason =
  | 'permission_denied' // 위치 권한 자체가 없음
  | 'unavailable' // 권한은 있으나 GPS/네트워크 등으로 좌표를 못 얻음
  | 'timeout' // 제한 시간 안에 좌표를 못 얻음
  | null;

export interface UseLocationResult {
  coords: Coordinates | null;
  isLoading: boolean;
  error: LocationErrorReason;
  /** 실제 좌표 획득을 다시 시도한다. 성공 시 좌표, 실패 시 null을 돌려준다(상태도 함께 갱신). */
  retry: () => Promise<Coordinates | null>;
}

interface Options {
  /** 위치 권한이 확인된 상태에서만 true. AppBootstrap의 locationGranted를 넘긴다. 기본 true. */
  enabled?: boolean;
}

const LOCATION_TIMEOUT_MS = 10_000;

class LocationTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LocationTimeoutError()), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function useLocation({ enabled = true }: Options = {}): UseLocationResult {
  const [coords, setCoords] = useState<Coordinates | null>(DEBUG_FIXED_COORDS);
  const [isLoading, setIsLoading] = useState(DEBUG_FIXED_COORDS == null && enabled);
  const [error, setError] = useState<LocationErrorReason>(null);

  const mountedRef = useRef(true);
  // 매 시도마다 증가. 늦게 도착한 이전 요청이 최신 상태를 덮어쓰지 않도록 비교용.
  const requestIdRef = useRef(0);
  // 동시에 여러 개 실행되지 않도록(빠른 연타 retry 등) in-flight 여부.
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchCoords = useCallback(async (): Promise<Coordinates | null> => {
    if (DEBUG_FIXED_COORDS) {
      if (mountedRef.current) {
        setCoords(DEBUG_FIXED_COORDS);
        setIsLoading(false);
        setError(null);
      }
      return DEBUG_FIXED_COORDS;
    }

    if (!enabled) {
      if (mountedRef.current) {
        setIsLoading(false);
        setError('permission_denied');
      }
      debugLog('useLocation', 'skip: location permission not granted');
      return null;
    }

    if (inFlightRef.current) {
      debugLog('useLocation', 'dedupe: request already in flight');
      return null;
    }
    inFlightRef.current = true;
    const myId = ++requestIdRef.current;
    if (mountedRef.current) {
      setIsLoading(true);
      setError(null);
    }
    debugLog('useLocation', 'getCurrentPositionAsync start', { requestId: myId });

    try {
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATION_TIMEOUT_MS,
      );
      const next: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      // 이 요청보다 더 최신 요청이 시작됐거나 언마운트됐으면 상태를 건드리지 않는다.
      if (myId !== requestIdRef.current || !mountedRef.current) {
        debugLog('useLocation', 'stale success ignored', { requestId: myId });
        return next;
      }
      setCoords(next);
      setIsLoading(false);
      setError(null);
      debugLog('useLocation', 'getCurrentPositionAsync success', {
        requestId: myId,
        hasCoords: true,
      });
      return next;
    } catch (err) {
      let reason: Exclude<LocationErrorReason, null> =
        err instanceof LocationTimeoutError ? 'timeout' : 'unavailable';
      // 조회 도중 설정에서 권한이 취소됐을 수도 있으니 한 번 더 확인.
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') reason = 'permission_denied';
      } catch {
        // 권한 재확인 자체가 실패하면 원래 reason 유지.
      }
      if (myId !== requestIdRef.current || !mountedRef.current) {
        debugLog('useLocation', 'stale failure ignored', { requestId: myId, reason });
        return null;
      }
      setIsLoading(false);
      setError(reason);
      debugLog('useLocation', 'getCurrentPositionAsync failed', {
        requestId: myId,
        reason,
      });
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    fetchCoords();
  }, [fetchCoords]);

  const retry = useCallback(() => fetchCoords(), [fetchCoords]);

  return { coords, isLoading, error, retry };
}
