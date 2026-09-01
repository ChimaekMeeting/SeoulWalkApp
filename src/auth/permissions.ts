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

async function readLocationStatus(): Promise<PermissionState> {
  if (hasDebugFixedLocation) return 'granted';
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
}

async function isPedometerUsable(): Promise<boolean> {
  try {
    return await Pedometer.isAvailableAsync();
  } catch {
    return false;
  }
}

async function readPedometerStatus(): Promise<PermissionState> {
  if (!(await isPedometerUsable())) return 'denied';
  const { status } = await Pedometer.getPermissionsAsync();
  return status;
}

export async function readPermissionSnapshot(): Promise<PermissionSnapshot> {
  const [location, pedometer] = await Promise.all([
    readLocationStatus(),
    readPedometerStatus(),
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

/** 이미 허용돼 있으면 OS가 다이얼로그 없이 즉시 granted를 돌려준다(중복 요청 아님). */
export async function requestLocationPermission(): Promise<PermissionState> {
  if (hasDebugFixedLocation) return 'granted';
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status;
}

export async function requestPedometerPermission(): Promise<PermissionState> {
  if (!(await isPedometerUsable())) return 'denied';
  const { status } = await Pedometer.requestPermissionsAsync();
  return status;
}
