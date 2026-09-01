import { env } from './env';
import { Coordinates } from '../types/location';

/**
 * 개발 중 실제 GPS 대신 쓸 고정 좌표(`EXPO_PUBLIC_DEBUG_FIXED_LOCATION`, "위도,경도" 형식).
 * 좌표 조회부(useLocation·useWatchLocation)만 이 값으로 대체하고, 위치 권한 판정에는
 * 관여하지 않는다 — 값이 설정돼 있어도 권한 안내 화면은 실제 OS 상태 기준으로 노출된다.
 * 파싱까지 성공해야 유효한 고정 좌표로 인정하고, 파싱 실패 시엔 null(실제 GPS 사용)이다.
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
