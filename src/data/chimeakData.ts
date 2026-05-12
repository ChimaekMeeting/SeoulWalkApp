export type PersonaId = 'killtime' | 'exercise' | 'healing';
export type CourseType = 'loop' | 'oneway';

export type Course = {
  id: string;
  title: string;
  subtitle: string;
  type: CourseType;
  distance: number;
  duration: number;
  kcal: number;
  elev: 'easy' | 'flat' | 'medium';
  persona: PersonaId[];
  tags: string[];
  color: string;
  mood: string;
  badges: string[];
  waypoints: string[];
  blurb: string;
};

export const courses: Course[] = [
  {
    id: 'c1',
    title: '북악 능선 한바퀴',
    subtitle: '도심 속 능선길 · 야경 포인트 3곳',
    type: 'loop',
    distance: 4.2,
    duration: 62,
    kcal: 248,
    elev: 'medium',
    persona: ['healing', 'exercise'],
    tags: ['#야경', '#능선', '#한적함'],
    color: '#0f8f74',
    mood: '달',
    badges: ['AI 추천', '오늘 트렌딩'],
    waypoints: ['창의문', '북악팔각정', '말바위쉼터', '와룡공원', '창의문'],
    blurb:
      '저녁 7시의 능선. 도심 야경과 솔향이 같이 따라옵니다. 가파른 구간 한 군데, 천천히 가면 충분합니다.',
  },
  {
    id: 'c2',
    title: '성수 골목 카페 산책',
    subtitle: '카페 6곳을 잇는 순환 코스',
    type: 'loop',
    distance: 2.6,
    duration: 38,
    kcal: 142,
    elev: 'easy',
    persona: ['killtime'],
    tags: ['#골목', '#카페', '#사진'],
    color: '#f59e0b',
    mood: '커피',
    badges: ['킬링타임', '오늘 1위'],
    waypoints: ['뚝섬역 2번', '연무장길', '성수카페거리', '서울숲입구', '뚝섬역'],
    blurb:
      '심심한 오후를 정리하기 좋은 골목 코스. 평지가 대부분이고 사진 찍기 좋은 모서리가 많아요.',
  },
  {
    id: 'c3',
    title: '한강 마포 → 여의도',
    subtitle: '편도 직진 · 일몰 추천',
    type: 'oneway',
    distance: 5.8,
    duration: 84,
    kcal: 348,
    elev: 'flat',
    persona: ['exercise', 'healing'],
    tags: ['#한강', '#일몰', '#평지'],
    color: '#38aeea',
    mood: '일몰',
    badges: ['편도', '대중교통 연계'],
    waypoints: ['마포역 4번', '마포대교 남단', '여의나루역', '여의도공원'],
    blurb:
      '편도로 끊고 지하철로 복귀하는 코스. 일몰 30분 전 출발하면 노을과 야경을 모두 잡을 수 있어요.',
  },
  {
    id: 'c4',
    title: '서촌 골목 미술관 루프',
    subtitle: '작은 갤러리 4곳 · 천천히',
    type: 'loop',
    distance: 1.9,
    duration: 32,
    kcal: 96,
    elev: 'flat',
    persona: ['killtime', 'healing'],
    tags: ['#서촌', '#갤러리', '#짧게'],
    color: '#c084fc',
    mood: '미술',
    badges: ['30분', '초보 추천'],
    waypoints: ['경복궁역', '보안여관', '대오서점', '통의동', '경복궁역'],
    blurb:
      '30분만 비어도 OK. 갤러리는 무료 입장이 많고 골목이 좁아 차가 거의 다니지 않아요.',
  },
  {
    id: 'c5',
    title: '남산 둘레길 야간',
    subtitle: '편도 5km · 케이블카 복귀',
    type: 'oneway',
    distance: 5.1,
    duration: 78,
    kcal: 312,
    elev: 'medium',
    persona: ['exercise'],
    tags: ['#남산', '#야간', '#운동'],
    color: '#9f4f44',
    mood: '러닝',
    badges: ['운동 모드', '케이블카'],
    waypoints: ['남산도서관', '북측순환로', '국립극장', 'N서울타워'],
    blurb:
      '꾸준한 오르막. 케이블카 막차 시간 체크. 운동 페르소나 기준으로 가장 자주 추천되는 코스입니다.',
  },
  {
    id: 'c6',
    title: '청계천 새벽 산책',
    subtitle: '편도 3km · 출근 전',
    type: 'oneway',
    distance: 3,
    duration: 45,
    kcal: 178,
    elev: 'flat',
    persona: ['healing'],
    tags: ['#새벽', '#청계천', '#물소리'],
    color: '#2baec7',
    mood: '물결',
    badges: ['이른 아침', '조용함'],
    waypoints: ['광화문', '청계광장', '광장시장', '동대문역'],
    blurb: '아침 6시 출발 추천. 물소리만 들리는 구간이 길어 통화와 생각 정리에 좋아요.',
  },
];

export const personas: Record<
  PersonaId,
  {label: string; icon: string; color: string; greet: string}
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

export const chatbotFlow = [
  {q: '오늘 기분 어때요?', a: ['상쾌해요', '보통이에요', '지쳤어요', '복잡해요']},
  {q: '얼마나 걸을 수 있어요?', a: ['30분 이내', '1시간 정도', '2시간 이상']},
  {q: '어떤 길이 끌리세요?', a: ['조용한 골목', '한강·물가', '능선·전망', '카페가 많은 곳']},
  {q: '돌아오는 방식은요?', a: ['순환 — 출발지로', '편도 — 대중교통 복귀']},
];

export const recentWalks = [
  {date: '5/9 토', course: '북악 능선 한바퀴', dist: 4.2, time: '01:02', rating: 5, note: '야경이 진짜였다'},
  {date: '5/7 목', course: '청계천 새벽 산책', dist: 3.0, time: '00:44', rating: 4, note: '출근 전이라 더 좋음'},
  {date: '5/5 일', course: '서촌 골목 미술관 루프', dist: 1.9, time: '00:33', rating: 4, note: '갤러리 한 곳 문 닫음'},
];
