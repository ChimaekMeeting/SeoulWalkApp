import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { env } from '../config/env';

/**
 * 위치·걸음 수 권한을 OS에 직접 물어보는 로직을 한 곳으로 모은 모듈.
 * 캐시된 상태를 믿지 않고 실제 기능(경로 생성·센서 사용) 직전에 여기서 다시 확인한다.
 *
 * - 위치: 앱 사용에 필수. `EXPO_PUBLIC_DEBUG_FIXED_LOCATION`이 설정된 개발 환경에서는
 *   실제 GPS 대신 고정 좌표를 쓰므로 항상 granted로 취급한다(useLocation.ts와 동일 규칙).
 * - 걸음 수: 선택. 센서 자체가 없는 기기(isAvailableAsync=false)는 denied로 취급한다.
 *   거부되어도 산책은 가능하고 거리 기반 추정치(estimateSteps)로 대체된다.
 */

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface PermissionSnapshot {
  location: PermissionState;
  pedometer: PermissionState;
  locationGranted: boolean;
  pedometerGranted: boolean;
  /** 위치·걸음 수 둘 다 granted */
  allGranted: boolean;
}

const hasDebugFixedLocation = !!env.DEBUG_FIXED_LOCATION;

/** 'read'는 조회, 'request'는 (미결정 시) OS 다이얼로그. 이미 허용됐으면 둘 다 다이얼로그 없이 granted. */
type Mode = 'read' | 'request';

async function locationPermission(mode: Mode): Promise<PermissionState> {
  if (hasDebugFixedLocation) return 'granted';
  const { status } =
    mode === 'read'
      ? await Location.getForegroundPermissionsAsync()
      : await Location.requestForegroundPermissionsAsync();
  return status;
}

async function pedometerPermission(mode: Mode): Promise<PermissionState> {
  // 센서 자체가 없는 기기는 권한을 물어도 소용 없으므로 denied로 취급한다.
  try {
    if (!(await Pedometer.isAvailableAsync())) return 'denied';
  } catch {
    return 'denied';
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
    allGranted: locationGranted && pedometerGranted,
  };
}

export const requestLocationPermission = () => locationPermission('request');
export const requestPedometerPermission = () => pedometerPermission('request');

/** AppBootstrap의 4-state(PermissionState | 'checking')를 권한 화면 prop(2-state)으로 좁힌다. */
export const toPromptStatus = (
  s: PermissionState | 'checking',
): 'undetermined' | 'denied' => (s === 'denied' ? 'denied' : 'undetermined');
