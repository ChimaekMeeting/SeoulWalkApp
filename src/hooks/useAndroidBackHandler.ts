import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * 안드로이드 하드웨어 뒤로가기(`hardwareBackPress`) 연동용 공용 훅.
 *
 * `handler`가 `true`를 반환하면 기본 동작(앱 종료·스택 pop)을 막는다. `false`면 다음
 * 핸들러로 넘어간다. iOS에는 이 이벤트가 없으므로 OS 분기는 불필요하다.
 *
 * `useAppStateChange`와 같은 latest-ref 패턴 — `handler`가 매 렌더 새로 만들어져도 리스너를
 * 재등록하지 않는다. 구독 자체는 `enabled`가 바뀔 때만 붙였다 뗐다 한다.
 */
export function useAndroidBackHandler(handler: () => boolean, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
      handlerRef.current(),
    );
    return () => subscription.remove();
  }, [enabled]);
}
