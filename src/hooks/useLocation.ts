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
 * 조회 순서: getLastKnownPositionAsync(즉시)로 지도를 먼저 이동시킨 뒤,
 * getCurrentPositionAsync로 정밀 좌표를 갱신한다. 정밀 조회가 실패해도 last known이
 * 있으면 그 좌표를 유지하고 error로 취급하지 않는다(실내·GPS 콜드스타트 대비).
 *
 * 실패를 조용히 삼키지 않는다:
 * - timeout(기본 10초)·GPS 미획득·권한 취소를 각각 error로 구분해 반환
 *   (단, last known 좌표라도 확보한 경우엔 권한 취소만 error로 올린다)
 * - 좌표가 계속 null인 "실패" 상태와 "아직 로딩 중"을 isLoading으로 구분
 * - retry()로 앱 재시작 없이 다시 시도
 */

export type LocationErrorReason =
  | 'permission_denied' // 위치 권한 자체가 없음
  | 'unavailable' // 권한은 있으나 GPS/네트워크 등으로 좌표를 못 얻음
  | 'timeout' // 제한 시간 안에 좌표를 못 얻음
  | null;

/**
 * 좌표의 "신선도" 상태. `coords`/`error`만으로는 "지금 보이는 좌표가 방금 잡은 최신 GPS인지,
 * 아니면 캐시(last known)인지"를 알 수 없어서 별도로 노출한다. 지도 카메라를 언제 현재 위치로
 * 옮길지, "최신 위치를 못 가져왔다"는 안내를 언제 띄울지 판단하는 데 쓴다.
 *
 * - 'initial'    : 아직 위치 요청 전
 * - 'loading'    : 최신 GPS 조회 중
 * - 'last_known' : 이전(캐시) 위치만 확보 — 최신 GPS는 아직/실패. coords는 있지만 stale.
 * - 'current'    : 최신 GPS 위치 확보
 * - 'error'      : 위치 조회 실패이고 쓸 수 있는 좌표도 없음
 */
export type LocationStatus = 'initial' | 'loading' | 'last_known' | 'current' | 'error';

export interface UseLocationResult {
  coords: Coordinates | null;
  isLoading: boolean;
  error: LocationErrorReason;
  /**
   * 좌표 신선도. 'last_known'이면 coords는 있으나 최신 GPS가 아니다(정밀 조회 중이거나 실패).
   * 이 경우 error는 null로 두어(대화 입력 등을 막지 않기 위해) 하드 에러와 구분하되, 여기서
   * "최신 아님"을 계속 보존한다.
   */
  status: LocationStatus;
  /** 실제 좌표 획득을 다시 시도한다. 성공 시 좌표, 실패 시 null을 돌려준다(상태도 함께 갱신). */
  retry: () => Promise<Coordinates | null>;
}

interface Options {
  /** 위치 권한이 확인된 상태에서만 true. AppBootstrap의 locationGranted를 넘긴다. 기본 true. */
  enabled?: boolean;
}

const LOCATION_TIMEOUT_MS = 10_000;
// 이보다 오래된 last known 좌표는 seed하지 않는다 — 며칠 전 다른 도시에서 잡힌 캐시로
// 지도를 날려버리면 "현재 위치가 엉뚱한 곳"으로 보이기 때문.
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
// 최초 정밀 조회가 timeout/unavailable로 실패했을 때 자동 재시도 횟수(권한 문제면 재시도 안 함).
const MAX_AUTO_RETRIES = 3;

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
  const [status, setStatus] = useState<LocationStatus>(
    DEBUG_FIXED_COORDS != null ? 'current' : enabled ? 'loading' : 'initial',
  );
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0);

  const mountedRef = useRef(true);
  // 매 시도마다 증가. 늦게 도착한 이전 요청이 최신 상태를 덮어쓰지 않도록 비교용.
  const requestIdRef = useRef(0);
  // 동시에 여러 개 실행되지 않도록(빠른 연타 retry 등) in-flight 여부.
  const inFlightRef = useRef(false);
  // 진행 중인 조회의 Promise. 중복 호출 시 새 조회를 띄우지 않고 이걸 그대로 await 하게 해서,
  // retry()를 "대화/메시지 전송 직전 최신 좌표 확보" 용도로 await 할 수 있게 한다.
  const inFlightPromiseRef = useRef<Promise<Coordinates | null> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const performFetch = useCallback(async (): Promise<Coordinates | null> => {
    if (DEBUG_FIXED_COORDS) {
      if (mountedRef.current) {
        setCoords(DEBUG_FIXED_COORDS);
        setIsLoading(false);
        setError(null);
        setStatus('current');
      }
      return DEBUG_FIXED_COORDS;
    }

    if (!enabled) {
      if (mountedRef.current) {
        setIsLoading(false);
        setError('permission_denied');
        setStatus('error');
      }
      debugLog('Location', 'permission granted: false (enabled=false) → skip', { enabled });
      return null;
    }

    inFlightRef.current = true;
    const myId = ++requestIdRef.current;
    if (mountedRef.current) {
      setIsLoading(true);
      setError(null);
      setStatus('loading');
    }
    debugLog('Location', 'permission granted: true', { enabled });
    debugLog('Location', 'current request started', { requestId: myId });

    // 마지막으로 알려진 위치: 즉시 반환되므로 정밀 좌표를 기다리는 동안 지도를 먼저 이동시킨다.
    // 실내·GPS 콜드스타트로 getCurrentPositionAsync가 느리거나 실패해도 최소한 근처는 잡힌다.
    // 단 이건 "최신 위치"가 아니므로 status는 'last_known'으로 남겨 stale임을 보존한다.
    let lastKnown: Coordinates | null = null;
    try {
      const known = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
      });
      if (known) {
        lastKnown = {
          latitude: known.coords.latitude,
          longitude: known.coords.longitude,
        };
        const ageMs =
          typeof known.timestamp === 'number' ? Date.now() - known.timestamp : null;
        debugLog('Location', 'last known', { hasCoords: true, ageMs });
        if (myId === requestIdRef.current && mountedRef.current) {
          setCoords(lastKnown);
          setStatus('last_known');
          debugLog('Location', 'coords state updated (last known)', {
            hasCoords: true,
            status: 'last_known',
          });
        }
      } else {
        debugLog('Location', 'last known', { hasCoords: false, ageMs: null });
      }
    } catch {
      // last known 조회 실패는 무시하고 정밀 조회로 진행.
    }

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
      debugLog('Location', 'current received', {
        requestId: myId,
        hasCoords: true,
        accuracy: position.coords.accuracy ?? null,
      });
      if (myId !== requestIdRef.current || !mountedRef.current) {
        debugLog('useLocation', 'stale success ignored', { requestId: myId });
        return next;
      }
      setCoords(next);
      setIsLoading(false);
      setError(null);
      setStatus('current');
      debugLog('Location', 'coords state updated', {
        requestId: myId,
        hasCoords: true,
        status: 'current',
      });
      return next;
    } catch (err) {
      let reason: Exclude<LocationErrorReason, null> =
        err instanceof LocationTimeoutError ? 'timeout' : 'unavailable';
      // 조회 도중 설정에서 권한이 취소됐을 수도 있으니 한 번 더 확인.
      try {
        const { status: permissionStatus } = await Location.getForegroundPermissionsAsync();
        if (permissionStatus !== 'granted') reason = 'permission_denied';
      } catch {
        // 권한 재확인 자체가 실패하면 원래 reason 유지.
      }
      if (myId !== requestIdRef.current || !mountedRef.current) {
        debugLog('useLocation', 'stale failure ignored', { requestId: myId, reason });
        return lastKnown;
      }
      // 정밀 좌표는 못 얻었지만 last known으로 지도는 이동시킨 상태면 하드 에러로 다루지 않는다
      // (대화 입력 차단·에러 버블 방지). error는 null로 두되, status는 'last_known'으로 남겨
      // "최신 위치를 가져오지 못했다"는 사실을 숨기지 않고 보존한다.
      if (lastKnown && reason !== 'permission_denied') {
        setIsLoading(false);
        setError(null);
        setStatus('last_known');
        debugLog('Location', 'precise fix failed, keeping last known (stale)', {
          requestId: myId,
          reason,
          status: 'last_known',
        });
        return lastKnown;
      }
      setIsLoading(false);
      setError(reason);
      setStatus('error');
      debugLog('Location', 'current request failed, no usable coords', {
        requestId: myId,
        reason,
        status: 'error',
      });
      return null;
    } finally {
      inFlightRef.current = false;
      inFlightPromiseRef.current = null;
    }
  }, [enabled]);

  // performFetch를 감싸 "이미 진행 중이면 그 Promise를 그대로 돌려준다". 이렇게 해야 retry()를
  // await 했을 때(대화 시작·메시지 전송 직전) 중복 조회 없이 진행 중 조회 결과를 받을 수 있다.
  const fetchCoords = useCallback((): Promise<Coordinates | null> => {
    if (inFlightRef.current && inFlightPromiseRef.current) {
      debugLog('useLocation', 'dedupe: awaiting in-flight request');
      return inFlightPromiseRef.current;
    }
    const promise = performFetch();
    inFlightPromiseRef.current = promise;
    return promise;
  }, [performFetch]);

  useEffect(() => {
    fetchCoords();
  }, [fetchCoords]);

  // enabled(권한 허용 여부)가 바뀌면 자동 재시도 카운터를 리셋한다.
  useEffect(() => {
    setAutoRetryAttempt(0);
  }, [enabled]);

  // 정밀 조회가 timeout/unavailable로 실패하고 쓸 좌표도 없으면(status='error', 권한 문제는 제외)
  // 몇 번 자동 재시도한다. 홈 지도용 1회성 훅이라 사용자가 직접 '다시 시도'를 누르지 않아도,
  // GPS 콜드스타트가 뒤늦게 잡히면 지도가 현재 위치로 옮겨가도록 한다.
  // (last known을 이미 확보한 경우는 그 좌표를 쓰므로 여기서 재시도하지 않는다 — 5분 이내 캐시만 seed됨.)
  useEffect(() => {
    if (DEBUG_FIXED_COORDS || !enabled) return;
    if (status !== 'error') return; // 로딩 중·최신 확보·last known 확보면 재시도 안 함
    if (error === 'permission_denied') return; // 권한 문제는 재시도 무의미
    if (autoRetryAttempt >= MAX_AUTO_RETRIES) return;

    const delayMs = (autoRetryAttempt + 1) * 3000;
    debugLog('Location', 'auto-retry scheduled', {
      attempt: autoRetryAttempt + 1,
      delayMs,
      error,
    });
    const timer = setTimeout(() => {
      setAutoRetryAttempt(n => n + 1);
      fetchCoords();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [status, error, autoRetryAttempt, enabled, fetchCoords]);

  const retry = useCallback(() => {
    setAutoRetryAttempt(0);
    return fetchCoords();
  }, [fetchCoords]);

  return { coords, isLoading, error, status, retry };
}
