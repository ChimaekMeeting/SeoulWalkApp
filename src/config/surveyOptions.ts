// 산책 취향 설문(SurveyScreen)과 마이페이지 '내 산책 취향'(MyPreferenceSection)이 공유하는
// 선택지. 두 화면 모두 같은 /api/user/survey 엔드포인트로 저장한다.
//
// ⚠️ 백엔드의 태그 → 가중치(weights_*) 매핑이 아직 확정되지 않았다. 확정 전까지 tagValue는
//    라벨과 같은 문자열을 그대로 보낸다 — 확정되면 여기 tagValue만 백엔드 키에 맞추면 되고
//    화면(label)은 건드릴 필요 없다.

import { DistanceOption } from '../types/survey';

interface SurveyTag {
  id: string;
  label: string;
  tagValue: string;
}

export const SURVEY_TAGS: SurveyTag[] = [
  { id: 'comfort', label: '편안한 길', tagValue: '편안한 길' },
  { id: 'safety', label: '안전한 길', tagValue: '안전한 길' },
  { id: 'nature', label: '자연이 많은 길', tagValue: '자연이 많은 길' },
];

interface DistanceChoice {
  value: DistanceOption;
  label: string;
  sub: string;
}

export const DISTANCE_OPTIONS: DistanceChoice[] = [
  { value: 'slow', label: '~2km', sub: '가볍게' },
  { value: 'normal', label: '2~4km', sub: '적당히' },
  { value: 'fast', label: '4km+', sub: '활발하게' },
];

// GET /api/user/survey는 선택한 거리 버킷 대신 default_target_km(숫자)만 돌려준다.
// 마이페이지에서 현재 선택을 다시 보여주려면 대략적으로 되돌려야 한다 — DISTANCE_OPTIONS의
// 라벨 경계(~2 / 2~4 / 4+)에 맞췄고, 백엔드 값이 확정되면 조정한다.
export function targetKmToDistanceOption(km: number | null): DistanceOption | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km <= 2) return 'slow';
  if (km <= 4) return 'normal';
  return 'fast';
}
