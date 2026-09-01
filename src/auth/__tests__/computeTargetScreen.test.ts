// AppBootstrap는 네이티브 모듈(카카오 로그인·SecureStore 등, jest 미변환)을 타고 들어온다.
// 이 테스트는 순수 함수 computeTargetScreen만 쓰므로 전부 스텁으로 막는다.
jest.mock('@react-native-seoul/kakao-login', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  getProfile: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, BestForNavigation: 6 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));
jest.mock('expo-sensors', () => ({
  Pedometer: {
    isAvailableAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
  },
}));

import { computeTargetScreen } from '../AppBootstrap';

/**
 * computeTargetScreen: 상태 스냅샷 → 보여줄 화면. 순수 함수라 권한 전이 시나리오를 전부
 * 여기서 커버한다(실기기 QA 부담 감소). 우선순위 순서가 바뀌면 이 테스트가 잡아준다.
 */

// "로그인 완료 + 온보딩/설문 통과 + 권한 조회 끝난" 기본 상태. 각 테스트는 필요한 필드만 덮어쓴다.
const base: Parameters<typeof computeTargetScreen>[0] = {
  showBrandSplash: false,
  onboardingStatus: 'seen',
  authState: 'loggedIn',
  surveyStatus: 'completed',
  permissionStatus: 'granted',
  activityStatus: 'granted',
  activityPromptStatus: 'done',
};

describe('computeTargetScreen — 최우선 분기', () => {
  it('브랜드 스플래시는 항상 최우선', () => {
    expect(computeTargetScreen({ ...base, showBrandSplash: true, permissionStatus: 'denied' })).toBe(
      'BrandSplash',
    );
  });

  it('온보딩 미열람이면 Onboarding', () => {
    expect(computeTargetScreen({ ...base, onboardingStatus: 'unseen' })).toBe('Onboarding');
  });

  it('로그아웃 상태면 Login (단, 권한 조회 중엔 Loading이 먼저)', () => {
    expect(computeTargetScreen({ ...base, authState: 'loggedOut' })).toBe('Login');
  });

  it('설문 미완료면 Survey', () => {
    expect(computeTargetScreen({ ...base, surveyStatus: 'pending' })).toBe('Survey');
  });
});

describe('computeTargetScreen — 위치 권한', () => {
  it('granted면 통과', () => {
    expect(computeTargetScreen({ ...base, permissionStatus: 'granted' })).toBe('Home');
  });

  it.each(['undetermined', 'denied'] as const)(
    'granted가 아니면(%s) LocationPermission',
    status => {
      expect(computeTargetScreen({ ...base, permissionStatus: status })).toBe('LocationPermission');
    },
  );

  it('허용 뒤 설정에서 취소(→denied)돼도 다시 LocationPermission으로 잡는다', () => {
    expect(
      computeTargetScreen({ ...base, permissionStatus: 'denied', activityStatus: 'granted' }),
    ).toBe('LocationPermission');
  });
});

describe('computeTargetScreen — 걸음 수 권한', () => {
  it('아직 아무 선택도 안 했고(pending) granted가 아니면 ActivityPermission 한 번', () => {
    expect(
      computeTargetScreen({ ...base, activityStatus: 'undetermined', activityPromptStatus: 'pending' }),
    ).toBe('ActivityPermission');
  });

  it('센서 없음(unavailable)도 한 번은 ActivityPermission', () => {
    expect(
      computeTargetScreen({ ...base, activityStatus: 'unavailable', activityPromptStatus: 'pending' }),
    ).toBe('ActivityPermission');
  });

  it('허용/건너뛰기 완료(done)면 이후 걸음 수가 꺼져도(denied) Home 유지 — 튕기지 않음', () => {
    expect(
      computeTargetScreen({ ...base, activityStatus: 'denied', activityPromptStatus: 'done' }),
    ).toBe('Home');
  });

  it('"거부"만 한 상태(pending)면 계속 ActivityPermission에 남는다', () => {
    expect(
      computeTargetScreen({ ...base, activityStatus: 'denied', activityPromptStatus: 'pending' }),
    ).toBe('ActivityPermission');
  });

  it('granted면 promptStatus와 무관하게 통과', () => {
    expect(
      computeTargetScreen({ ...base, activityStatus: 'granted', activityPromptStatus: 'pending' }),
    ).toBe('Home');
  });
});

describe('computeTargetScreen — 권한 조회 중엔 Loading (깜빡임 방지)', () => {
  it('위치 권한 조회 중', () => {
    expect(computeTargetScreen({ ...base, permissionStatus: 'checking' })).toBe('Loading');
  });

  it('걸음 수 안내 이력(SecureStore) 조회 중', () => {
    expect(computeTargetScreen({ ...base, activityPromptStatus: 'checking' })).toBe('Loading');
  });

  it('걸음 수 권한 조회 중이고 아직 처리 이력 없음', () => {
    expect(
      computeTargetScreen({
        ...base,
        activityStatus: 'checking',
        activityPromptStatus: 'pending',
      }),
    ).toBe('Loading');
  });

  it('걸음 수 권한 조회 중이어도 이미 done이면 Home으로 확정', () => {
    expect(
      computeTargetScreen({
        ...base,
        activityStatus: 'checking',
        activityPromptStatus: 'done',
      }),
    ).toBe('Home');
  });
});
