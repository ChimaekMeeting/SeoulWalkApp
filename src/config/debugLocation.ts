import { env } from './env';
import { Coordinates } from '../types/location';

/**
 * 개발 중 실제 GPS 대신 쓸 고정 좌표(`EXPO_PUBLIC_DEBUG_FIXED_LOCATION`, "위도,경도" 형식).
 * 예전에는 permissions.ts(=`!!env.DEBUG_FIXED_LOCATION`)와 useLocation.ts(문자열 파싱)가
 * 각자 판정해서, 값이 잘못 들어가면(파싱 실패) 한쪽은 "granted 취급", 다른 쪽은 "좌표 없음"으로
 * 갈렸다. 이제 파싱까지 성공해야 "디버그 고정 좌표 사용"으로 인정하고 모든 곳이 이 값을 공유한다.
 */
export const DEBUG_FIXED_COORDS: Coordinates | null = (() => {
  const raw = env.DEBUG_FIXED_LOCATION;
  if (!raw) return null;
  const parts = raw.split(',').map((s: string) => s.trim());
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return null;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
})();

/** 디버그 고정 좌표가 유효하게 설정돼 있는지. 위치 권한을 항상 granted로 취급할지 판단에 쓴다. */
export const HAS_DEBUG_FIXED_LOCATION = DEBUG_FIXED_COORDS != null;
