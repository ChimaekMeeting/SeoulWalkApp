import { WalkMode } from '../types/prewalk';

export const WALK_MODE_LABEL: Record<WalkMode, string> = {
  [WalkMode.CIRCULAR_RANDOM]: '순환 코스',
  [WalkMode.ONEWAY_SHORTEST]: '편도 코스',
  [WalkMode.ONEWAY_RANDOM]: '편도 코스',
};
