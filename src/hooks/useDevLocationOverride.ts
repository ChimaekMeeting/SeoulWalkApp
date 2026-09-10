import { useSyncExternalStore } from 'react';
import {
  getDevLocationOverride,
  subscribeDevLocationOverride,
} from '../config/devLocationOverride';

/**
 * 현재 적용 중인 dev GPS 오버라이드 좌표(없으면 null). 값이 바뀌면 구독한 컴포넌트가 리렌더된다.
 * useLocation·useWatchLocation·DevLocationChips가 공용으로 쓴다.
 */
export function useDevLocationOverride() {
  return useSyncExternalStore(
    subscribeDevLocationOverride,
    getDevLocationOverride,
    getDevLocationOverride,
  );
}
