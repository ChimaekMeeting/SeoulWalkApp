import { Coordinates } from '../types/location';
import { DEBUG_FIXED_COORDS } from './debugLocation';

/**
 * 개발 빌드 전용 — 실행 중에 GPS 좌표를 임의 지점으로 갈아끼우는 런타임 스위치.
 *
 * useLocation·useWatchLocation이 이 store를 구독해서, 값이 null이 아니면 실제 GPS 대신 이
 * 좌표를 쓴다(파란 점·진행률 트래커·startWalk의 anchorLoopToPoint 입력까지 전부 이 좌표 기준).
 * "GPS를 순환 경로 위 다른 지점으로 옮겨" 시작점 재정렬·경로 이탈·재매칭을 눈으로 확인하는 용도.
 *
 * 초기값은 EXPO_PUBLIC_DEBUG_FIXED_LOCATION(설정돼 있으면) — 예전 고정 좌표 디버그와 같은 출발선.
 * 프로덕션(`__DEV__` false)에서는 setter가 no-op이라 항상 그 초기값에 고정된다.
 */

let override: Coordinates | null = DEBUG_FIXED_COORDS;
const listeners = new Set<() => void>();

/** 현재 적용 중인 오버라이드 좌표(없으면 null). useSyncExternalStore의 getSnapshot으로도 쓴다. */
export function getDevLocationOverride(): Coordinates | null {
  return override;
}

/** 오버라이드 좌표를 설정하거나(null이면) 해제하고 구독자에게 알린다. 프로덕션에선 무시된다. */
export function setDevLocationOverride(next: Coordinates | null): void {
  if (!__DEV__) return;
  if (next === override) return;
  override = next;
  listeners.forEach(listener => listener());
}

/** 오버라이드 변경 구독. 해제 함수를 돌려준다(useSyncExternalStore 규약). */
export function subscribeDevLocationOverride(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
