import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { HAS_DEBUG_FIXED_LOCATION } from '../config/debugLocation';

/**
 * 위치·걸음 수 권한을 OS에 직접 물어보는 로직을 한 곳으로 모은 모듈.
 * 캐시된 상태를 믿지 않고 실제 기능(경로 생성·센서 사용) 직전에 여기서 다시 확인한다.
 *
 * - 위치: 앱 사용에 필수. `EXPO_PUBLIC_DEBUG_FIXED_LOCATION`이 설정된 개발 환경에서는
 *   실제 GPS 대신 고정 좌표를 쓰므로 항상 granted로 취급한다(config/debugLocation.ts 공유).
 * - 걸음 수: 선택. 센서 자체가 없는 기기(isAvailableAsync=false)는 'unavailable'로 구분한다
 *   ('denied'와 달리 "설정에서 켜세요" 안내가 무의미하므로). 어느 쪽이든 산책은 가능하고
 *   거리 기반 추정치(estimateSteps)로 대체된다.
 */

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** 위치는 'unavailable'을 반환하지 않는다(센서 개념이 없음). 타입 좁힘용 별칭. */
export type LocationPermissionState = 'granted' | 'denied' | 'undetermined';

export interface PermissionSnapshot {
  location: LocationPermissionState;
  pedometer: PermissionState;
  locationGranted: boolean;
  pedometerGranted: boolean;
  /** 만보계 센서 자체가 없는 기기 */
  pedometerUnavailable: boolean;
  /** 위치·걸음 수 둘 다 granted */
  allGranted: boolean;
}

/** 'read'는 조회, 'request'는 (미결정 시) OS 다이얼로그. 이미 허용됐으면 둘 다 다이얼로그 없이 granted. */
type Mode = 'read' | 'request';

async function locationPermission(mode: Mode): Promise<LocationPermissionState> {
  if (HAS_DEBUG_FIXED_LOCATION) return 'granted';
  const { status } =
    mode === 'read'
      ? await Location.getForegroundPermissionsAsync()
      : await Location.requestForegroundPermissionsAsync();
  return status as LocationPermissionState;
}

async function pedometerPermission(mode: Mode): Promise<PermissionState> {
  // 센서 자체가 없는 기기는 권한을 물어도 소용 없으므로 'unavailable'로 구분한다.
  try {
    if (!(await Pedometer.isAvailableAsync())) return 'unavailable';
  } catch {
    return 'unavailable';
  }
  const { status } =
    mode === 'read'
      ? await Pedometer.getPermissionsAsync()
      : await Pedometer.requestPermissionsAsync();
  return status;
}

export async function readPermissionSnapshot(): Promise<PermissionSnapshot> {
  const [location, pedometer] = await Promise.all([
    locationPermission('read'),
    pedometerPermission('read'),
  ]);
  const locationGranted = location === 'granted';
  const pedometerGranted = pedometer === 'granted';
  return {
    location,
    pedometer,
    locationGranted,
    pedometerGranted,
    pedometerUnavailable: pedometer === 'unavailable',
    allGranted: locationGranted && pedometerGranted,
  };
}

export const requestLocationPermission = () => locationPermission('request');
export const requestPedometerPermission = () => pedometerPermission('request');

/** AppBootstrap의 상태를 위치 권한 화면 prop(2-state)으로 좁힌다. */
export const toPromptStatus = (
  s: PermissionState | 'checking',
): 'undetermined' | 'denied' => (s === 'denied' ? 'denied' : 'undetermined');

/** AppBootstrap의 상태를 걸음 수 권한 화면 prop(3-state)으로 좁힌다. */
export const toPedometerPromptStatus = (
  s: PermissionState | 'checking',
): 'undetermined' | 'denied' | 'unavailable' =>
  s === 'denied' ? 'denied' : s === 'unavailable' ? 'unavailable' : 'undetermined';
