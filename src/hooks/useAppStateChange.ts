import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * 앱이 포그라운드로 돌아올 때/백그라운드로 갈 때를 감지하는 공용 훅. AppBootstrap의 권한
 * 재확인, HomeScreen의 비활성 타임아웃 리셋 등 여러 곳에서 "AppState 전환 감지" 로직을
 * 각자 새로 구현하던 걸 하나로 모았다.
 */
export function useAppStateChange({
  onForeground,
  onBackground,
}: {
  onForeground?: () => void;
  onBackground?: () => void;
}) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // 콜백을 deps에 안 넣어도 항상 최신 함수를 쓰도록 ref에 담아둔다 — 매 렌더 리스너를
  // 재등록하지 않기 위함(구독은 마운트 시 한 번만).
  const onForegroundRef = useRef(onForeground);
  const onBackgroundRef = useRef(onBackground);
  onForegroundRef.current = onForeground;
  onBackgroundRef.current = onBackground;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextState !== 'active') {
        onBackgroundRef.current?.();
      } else if (appStateRef.current !== 'active' && nextState === 'active') {
        onForegroundRef.current?.();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);
}
