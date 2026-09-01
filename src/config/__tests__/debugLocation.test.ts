/**
 * DEBUG_FIXED_COORDS 파싱 규칙 테스트.
 * env 모듈을 갈아끼우고 debugLocation을 새로 import 해서 모듈 최상위 파싱을 재평가한다.
 */

function loadWith(raw: string) {
  jest.resetModules();
  jest.doMock('../env', () => ({ env: { DEBUG_FIXED_LOCATION: raw } }));
  return require('../debugLocation') as typeof import('../debugLocation');
}

afterEach(() => {
  jest.dontMock('../env');
  jest.resetModules();
});

describe('DEBUG_FIXED_COORDS', () => {
  it('빈 문자열이면 null (실제 GPS 사용)', () => {
    const { DEBUG_FIXED_COORDS, HAS_DEBUG_FIXED_LOCATION } = loadWith('');
    expect(DEBUG_FIXED_COORDS).toBeNull();
    expect(HAS_DEBUG_FIXED_LOCATION).toBe(false);
  });

  it('"위도,경도" 형식이면 좌표로 파싱', () => {
    const { DEBUG_FIXED_COORDS, HAS_DEBUG_FIXED_LOCATION } = loadWith('37.5665,126.978');
    expect(DEBUG_FIXED_COORDS).toEqual({ latitude: 37.5665, longitude: 126.978 });
    expect(HAS_DEBUG_FIXED_LOCATION).toBe(true);
  });

  it('공백이 섞여도 파싱', () => {
    const { DEBUG_FIXED_COORDS } = loadWith(' 37.5665 , 126.978 ');
    expect(DEBUG_FIXED_COORDS).toEqual({ latitude: 37.5665, longitude: 126.978 });
  });

  it('숫자로 파싱 불가하면 null (granted 오취급 방지)', () => {
    expect(loadWith('seoul').DEBUG_FIXED_COORDS).toBeNull();
    expect(loadWith('37.5665').DEBUG_FIXED_COORDS).toBeNull();
    expect(loadWith('37.5665,').DEBUG_FIXED_COORDS).toBeNull();
  });
});
