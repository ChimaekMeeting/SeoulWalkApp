/**
 * 권한·위치 상태 변화를 개발/QA에서 추적하기 위한 debug 로그.
 *
 * - 개발 빌드(`__DEV__`)에서만 출력한다. 운영 빌드에서는 완전히 무음.
 * - 위치 좌표(위도·경도) 원시값은 절대 넘기지 않는다. 좌표 유무(`hasCoords`)나
 *   권한 상태 문자열 같은 비민감 정보만 `data`에 담는다.
 */
export function debugLog(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!__DEV__) return;
  if (data) {
    console.log(`[perm/loc] ${scope}: ${message}`, data);
  } else {
    console.log(`[perm/loc] ${scope}: ${message}`);
  }
}
