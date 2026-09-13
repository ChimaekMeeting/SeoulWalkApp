import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

// 이 거리(px) 이상 수평 이동해야 스와이프로 인정한다.
export const SWIPE_DISTANCE_THRESHOLD = 60;

interface UsePageSwipeGestureOptions {
  /** 현재 페이지 인덱스. */
  index: number;
  /** 전체 페이지 수 — 양 끝에서는 그 방향으로 더 못 넘어가게 막는 데 쓴다. */
  pageCount: number;
  /** 스와이프로 인덱스가 바뀔 때 호출된다(다음 인덱스가 파라미터로 온다). */
  onChange: (nextIndex: number) => void;
  /** false면 제스처를 통째로 비활성화한다(다른 화면이 겹쳐 있을 때 등). */
  enabled?: boolean;
  /** 이 거리(px) 이상 수평 이동해야 페이지 전환으로 인정한다. 기본 SWIPE_DISTANCE_THRESHOLD. */
  distanceThreshold?: number;
}

/**
 * 좌우 스와이프로 페이지 인덱스를 앞뒤로 넘기는 Pan 제스처를 만든다. 기록 탭의 "최근 경로"/
 * "즐겨찾기" 전환(RecordTab)과 하단 탭 바 위의 홈/기록/마이페이지 전환(MainRouter)이 서로
 * 다른 화면 영역에서 같은 좌우 스와이프 로직을 쓰므로, 로직을 중복시키지 않고 여기 한 곳에서
 * 관리한다.
 */
export function usePageSwipeGesture({
  index,
  pageCount,
  onChange,
  enabled = true,
  distanceThreshold = SWIPE_DISTANCE_THRESHOLD,
}: UsePageSwipeGestureOptions) {
  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        // 명확히 수평일 때만 활성화 — 세로 스크롤(ScrollView)과 충돌하지 않게 한다.
        .activeOffsetX([-20, 20])
        .failOffsetY([-16, 16])
        .onEnd(e => {
          'worklet';
          if (
            Math.abs(e.translationX) < distanceThreshold ||
            Math.abs(e.velocityX) <= Math.abs(e.velocityY)
          ) {
            return;
          }
          const nextIndex = e.translationX < 0 ? index + 1 : index - 1;
          if (nextIndex < 0 || nextIndex >= pageCount || nextIndex === index) return;
          runOnJS(onChange)(nextIndex);
        }),
    [index, pageCount, onChange, enabled, distanceThreshold],
  );
}
