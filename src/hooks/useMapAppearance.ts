import { useSyncExternalStore } from 'react';
import {
  getMapAppearanceModes,
  setMapAppearanceMode,
  subscribeMapAppearance,
} from '../config/mapAppearance';

/**
 * 현재 지도 라이트/다크 모드({ overview, walk })와 바꾸는 함수. 값이 바뀌면 구독한 컴포넌트가
 * 리렌더된다. AppMapView(지도가 실제로 어떤 스타일을 쓸지)와 MyPageScreen의 선택 버튼(값을
 * 바꾸는 쪽)이 공용으로 쓴다.
 */
export function useMapAppearance() {
  const modes = useSyncExternalStore(
    subscribeMapAppearance,
    getMapAppearanceModes,
    getMapAppearanceModes,
  );
  return { modes, setMode: setMapAppearanceMode };
}
