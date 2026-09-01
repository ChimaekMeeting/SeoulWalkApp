export const colors = {
  // ── 앱 전역 UI (흑백 계열) ──
  ink: '#111111', // 제목·본문·기본(primary) 버튼 배경
  black: '#111111', // 구 이름 — ink와 동일, 신규 코드는 ink 사용 (src/components/chat/ 하위호환)
  inkMuted: '#9e9e9e', // 보조 텍스트·비활성 라벨
  inkFaint: '#5c5c5c', // 탭/카드의 더 옅은 라벨
  ink2: '#5f6f6c', // ScreenHeader 우측 보조 텍스트
  ink3: '#91a09c', // 아이콘·이메일 등 흐린 텍스트
  card: '#ffffff', // 카드·화면 배경
  surfaceAlt: '#f5f5f5', // 뱃지 등 옅은 배경
  line: '#e0e0e0', // 기본 보더
  lineStrong: '#c8c8c8', // 아웃라인 버튼 보더
  border: '#e5e7eb', // 기록 목록 카드 보더 (record/ 전용)

  // ── 피드백 ──
  danger: '#c0392b',
  dangerBg: '#fde8e8',
  dangerBorder: '#f5c6c6',

  // ── 배경·지도 미리보기 ──
  bgSoft: '#eef8f4',
  mapPreviewBg: '#f2fbf7',

  // ── 채팅 UI (src/components/chat/ · AppBottomSheet, 민트 계열) ──
  accent: '#0f8f74',
  mintDeep: '#0f8f74',
  coral: '#e4834d',
  containerBackground: '#f4f3ef',
  line2: '#d6e4dd',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const shadows = {
  soft: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  map: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
};
