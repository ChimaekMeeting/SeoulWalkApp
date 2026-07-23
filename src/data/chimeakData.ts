export type PersonaId = 'killtime' | 'exercise' | 'healing';
export type CourseType = 'loop' | 'oneway';

export const personas: Record<
  PersonaId,
  { label: string; icon: string; color: string; greet: string }
> = {
  killtime: {
    label: '킬링타임',
    icon: '☕',
    color: '#f59e0b',
    greet: '30분 정도 시간이 비셨군요. 가볍게 도시 한 조각만 걸어볼까요?',
  },
  exercise: {
    label: '운동',
    icon: '🏃',
    color: '#9f4f44',
    greet: '오늘은 심박을 좀 올려볼까요. 거리와 페이스 모두 챙겨드릴게요.',
  },
  healing: {
    label: '힐링',
    icon: '🌿',
    color: '#0f8f74',
    greet: '복잡한 하루였군요. 사람 적고 물소리 가까운 길로 안내할게요.',
  },
};

export const recentWalks = [
  { date: '5/9 토', course: '북악 능선 한바퀴', dist: 4.2, time: '01:02', rating: 5, note: '야경이 진짜였다' },
  { date: '5/7 목', course: '청계천 새벽 산책', dist: 3.0, time: '00:44', rating: 4, note: '출근 전이라 더 좋음' },
  { date: '5/5 일', course: '서촌 골목 미술관 루프', dist: 1.9, time: '00:33', rating: 4, note: '갤러리 한 곳 문 닫음' },
];
