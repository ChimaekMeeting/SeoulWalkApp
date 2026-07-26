import { PREFERENCE_TAGS } from '../data/onboarding';

type PreferenceTag = typeof PREFERENCE_TAGS[number];

export interface SurveyOption {
  id: string;
  label: PreferenceTag;
  tagValue: PreferenceTag;
}

export interface SurveyQuestion {
  id: string;
  type: 'single' | 'multi';
  category: string;
  options: SurveyOption[];
}

const opt = (id: string, tag: PreferenceTag): SurveyOption =>
  ({ id, label: tag, tagValue: tag });

// PREFERENCE_TAGS의 부분집합 15개 — 오타 시 tsc 에러
const _SURVEY_TAG_VALUES = [
  '나무 많은', '꽃길', '초록',
  '밤에도 안전한', '큰길', '숨 안 차는', '뛰고 싶은', '운동',
  '볼거리 많은', '야경이 예쁜', '힙한', '조용한', '활기찬',
  '어린이', '반려동물',
] as const satisfies readonly PreferenceTag[];

void _SURVEY_TAG_VALUES; // 사용하지 않는 변수 경고 억제 (타입 검증 전용)

export const surveyQuestions: SurveyQuestion[] = [
  {
    id: 'nature',
    type: 'multi',
    category: '자연',
    options: [
      opt('tree',   '나무 많은'),
      opt('flower', '꽃길'),
      opt('green',  '초록'),
    ],
  },
  {
    id: 'terrain',
    type: 'multi',
    category: '지형·안전',
    options: [
      opt('safe_night', '밤에도 안전한'),
      opt('main_road',  '큰길'),
      opt('easy',       '숨 안 차는'),
      opt('run',        '뛰고 싶은'),
      opt('exercise',   '운동'),
    ],
  },
  {
    id: 'vibe',
    type: 'multi',
    category: '분위기',
    options: [
      opt('sightseeing', '볼거리 많은'),
      opt('night',       '야경이 예쁜'),
      opt('hip',         '힙한'),
      opt('quiet',       '조용한'),
      opt('vibrant',     '활기찬'),
    ],
  },
  {
    id: 'companion',
    type: 'multi',
    category: '동반자',
    options: [
      opt('child', '어린이'),
      opt('pet',   '반려동물'),
    ],
  },
];

if (__DEV__) {
  const count = surveyQuestions.flatMap(q => q.options).length;
  if (count !== 15) {
    console.warn(`[surveyQuestions] 태그 수 불일치: ${count}/15`);
  }
}
