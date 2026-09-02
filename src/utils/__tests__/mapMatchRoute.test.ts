import { mergeMatchedRoute } from '../mapMatchRoute';
import { haversineDistanceKm } from '../geo';

type LatLon = [number, number];

// 서울시청 근처 4개 노드.
const RAW: LatLon[] = [
  [37.5665, 126.978],
  [37.5670, 126.979],
  [37.5660, 126.980],
  [37.5650, 126.981],
];

const legKm = (a: LatLon, b: LatLon) => haversineDistanceKm(a, b);

// 두 노드 사이에 중간점 하나를 낀, 도로를 따라가는 듯한 형상(직선에서 ~10m 이내).
function bentGeom(a: LatLon, b: LatLon): LatLon[] {
  const mid: LatLon = [(a[0] + b[0]) / 2 + 0.0001, (a[1] + b[1]) / 2];
  return [a, mid, b];
}

// mergeMatchedRoute가 받는 MatchedLeg. 기본은 "모든 채택 기준 통과", 테스트마다 필요한 필드만 덮어쓴다.
function leg(from: number, to: number, over: Partial<Parameters<typeof mergeMatchedRoute>[1][number]> = {}) {
  return {
    from,
    to,
    geom: bentGeom(RAW[from], RAW[to]),
    matchedKm: legKm(RAW[from], RAW[to]),
    confidence: 0.9,
    snapKm: 0.005,
    maxDevKm: 0.01,
    ...over,
  };
}

describe('mergeMatchedRoute', () => {
  it('채택 기준을 통과한 구간은 스냅 형상으로 바꾼다', () => {
    const l = leg(0, 1);
    const merged = mergeMatchedRoute(RAW, [l]);
    expect(merged).toEqual([RAW[0], l.geom[1], RAW[1], RAW[2], RAW[3]]);
  });

  it('신뢰도가 바닥값 미만이면(쓰레기 매칭) 원본 직선을 유지한다', () => {
    expect(mergeMatchedRoute(RAW, [leg(0, 1, { confidence: 0.02 })])).toEqual(RAW);
  });

  it('스냅 이동거리가 크면(보행망에 없는 길) 원본 직선을 유지한다', () => {
    expect(mergeMatchedRoute(RAW, [leg(1, 2, { snapKm: 0.05 })])).toEqual(RAW);
  });

  it('측방 이탈이 크면(다른 길로 우회) 원본 직선을 유지한다', () => {
    expect(mergeMatchedRoute(RAW, [leg(0, 1, { maxDevKm: 0.06 })])).toEqual(RAW);
  });

  it('우회가 과도하면 원본 직선을 유지한다', () => {
    expect(mergeMatchedRoute(RAW, [leg(0, 1, { matchedKm: legKm(RAW[0], RAW[1]) * 3 })])).toEqual(RAW);
  });

  it('매칭 안 된 중간 노드 구간은 원본 직선으로 메운다', () => {
    const l = leg(0, 1);
    const merged = mergeMatchedRoute(RAW, [l]);
    expect(merged).toEqual([RAW[0], l.geom[1], RAW[1], RAW[2], RAW[3]]);
  });

  it('매칭 결과가 하나도 없으면 원본을 그대로 돌려준다', () => {
    expect(mergeMatchedRoute(RAW, [])).toEqual(RAW);
  });

  it('청크 겹침으로 이미 지난 구간의 leg는 무시한다', () => {
    const wide = leg(0, 2, {
      geom: [...bentGeom(RAW[0], RAW[1]), bentGeom(RAW[1], RAW[2])[1], RAW[2]],
      matchedKm: legKm(RAW[0], RAW[1]) + legKm(RAW[1], RAW[2]),
    });
    const merged = mergeMatchedRoute(RAW, [wide, leg(1, 2)]);
    // 마지막 3번 노드는 매칭 없음 → 원본으로 이어붙는다.
    expect(merged[merged.length - 1]).toEqual(RAW[3]);
  });
});
