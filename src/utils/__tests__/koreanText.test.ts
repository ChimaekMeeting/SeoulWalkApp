import { keepWordsTogether } from '../koreanText';

describe('keepWordsTogether', () => {
  it('스페이스가 아닌 인접 글자 사이에 WORD JOINER를 끼워 넣는다', () => {
    expect(keepWordsTogether('쓰는')).toBe('쓰⁠는');
  });

  it('스페이스는 그대로 유지해 단어 사이 줄바꿈은 그대로 허용한다', () => {
    expect(keepWordsTogether('다른 앱을 쓰는 동안에도')).toBe(
      '다⁠른 앱⁠을 쓰⁠는 동⁠안⁠에⁠도',
    );
  });

  it('한 글자짜리 문자열은 그대로 돌려준다', () => {
    expect(keepWordsTogether('앱')).toBe('앱');
  });

  it('이모지(서로게이트 쌍)·숫자·영문은 건드리지 않는다 — Text에 일괄 적용해도 안전해야 한다', () => {
    // "완주"는 인접한 한글 음절이라 그 사이에만 WORD JOINER가 들어간다 — 나머지(이모지·숫자·영문)는 그대로.
    expect(keepWordsTogether('🎉 3.5km 완주! Good job')).toBe('🎉 3.5km 완⁠주! Good job');
  });
});
