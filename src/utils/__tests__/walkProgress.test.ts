import { calculateWalkProgress, haversineDistanceKm } from '../walkProgress';
import { WalkRouteResponse } from '../../types/prewalk';

// 실제 산책 화면(6b)에서 쓰는 것과 같은 형태의 목 경로: 서울시청 근처 4개 좌표.
const ROUTE: WalkRouteResponse['coordinates'] = [
  [37.5665, 126.978],
  [37.567, 126.979],
  [37.566, 126.98],
  [37.565, 126.981],
];
const TOTAL_KM = ROUTE.reduce(
  (sum, point, i) => (i === 0 ? 0 : sum + haversineDistanceKm(ROUTE[i - 1], point)),
  0,
);

describe('calculateWalkProgress', () => {
  it('경로 시작점에서는 진행률이 0%에 가깝다', () => {
    const result = calculateWalkProgress(ROUTE[0], ROUTE, TOTAL_KM);
    expect(result.traveledKm).toBeCloseTo(0, 2);
    expect(result.progressRatio).toBeCloseTo(0, 2);
    expect(result.remainingKm).toBeCloseTo(TOTAL_KM, 2);
  });

  it('경로 끝점에서는 진행률이 100%에 가깝다', () => {
    const result = calculateWalkProgress(ROUTE[ROUTE.length - 1], ROUTE, TOTAL_KM);
    expect(result.progressRatio).toBeCloseTo(1, 2);
    expect(result.remainingKm).toBeCloseTo(0, 2);
  });

  it('경로를 따라 이동할수록 traveledKm이 단조 증가하고 remainingKm은 단조 감소한다', () => {
    const steps = 10;
    let prevTraveled = -1;
    let prevRemaining = Infinity;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // ROUTE 위를 선형 보간한 가상 GPS 지점(실제 산책자가 경로를 따라 걷는 상황을 흉내)
      const segIndex = Math.min(Math.floor(t * (ROUTE.length - 1)), ROUTE.length - 2);
      const segT = t * (ROUTE.length - 1) - segIndex;
      const [lat1, lon1] = ROUTE[segIndex];
      const [lat2, lon2] = ROUTE[segIndex + 1];
      const current: [number, number] = [lat1 + (lat2 - lat1) * segT, lon1 + (lon2 - lon1) * segT];

      const result = calculateWalkProgress(current, ROUTE, TOTAL_KM);

      expect(result.traveledKm).toBeGreaterThanOrEqual(prevTraveled - 1e-9);
      expect(result.remainingKm).toBeLessThanOrEqual(prevRemaining + 1e-9);
      expect(result.traveledKm + result.remainingKm).toBeCloseTo(TOTAL_KM, 5);

      prevTraveled = result.traveledKm;
      prevRemaining = result.remainingKm;
    }
  });

  it('경로에서 살짝 벗어나도(GPS 오차) 가장 가까운 지점 기준으로 진행률을 계산한다', () => {
    // ROUTE[1] 근처에서 20m 정도 옆으로 벗어난 지점
    const nearRoute1: [number, number] = [ROUTE[1][0] + 0.0002, ROUTE[1][1]];
    const result = calculateWalkProgress(nearRoute1, ROUTE, TOTAL_KM);
    const distanceFromRoute1 = haversineDistanceKm(nearRoute1, ROUTE[1]);

    expect(distanceFromRoute1).toBeLessThan(0.05); // 50m 이내 오차
    expect(result.progressRatio).toBeGreaterThan(0.1);
    expect(result.progressRatio).toBeLessThan(0.9);
  });
});
