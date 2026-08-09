import { WalkProgressTracker, haversineDistanceKm } from '../walkProgress';
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

// 테스트 안에서 GPS 업데이트 시각을 인위적으로 흘려보내는 헬퍼 — 실제 기기에서 5m마다 갱신되는
// 것과 비슷하게, 매 호출마다 몇 초씩 지난 것으로 취급한다(그래야 속도 필터에 안 걸림).
const START_MS = 1_700_000_000_000;
function tick(stepIndex: number): number {
  return START_MS + stepIndex * 3000; // 3초 간격
}

describe('WalkProgressTracker', () => {
  it('경로 시작점에서는 진행률이 0%에 가깝다', () => {
    const tracker = new WalkProgressTracker();
    const result = tracker.update(ROUTE[0], ROUTE, TOTAL_KM, tick(0));
    expect(result.traveledKm).toBeCloseTo(0, 2);
    expect(result.progressRatio).toBeCloseTo(0, 2);
    expect(result.remainingKm).toBeCloseTo(TOTAL_KM, 2);
  });

  it('경로 끝점에서는 진행률이 100%에 가깝다', () => {
    const tracker = new WalkProgressTracker();
    const result = tracker.update(ROUTE[ROUTE.length - 1], ROUTE, TOTAL_KM, tick(0));
    expect(result.progressRatio).toBeCloseTo(1, 2);
    expect(result.remainingKm).toBeCloseTo(0, 2);
  });

  it('경로를 따라 이동할수록 traveledKm이 단조 증가하고 remainingKm은 단조 감소한다', () => {
    const tracker = new WalkProgressTracker();
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

      const result = tracker.update(current, ROUTE, TOTAL_KM, tick(i));

      expect(result.traveledKm).toBeGreaterThanOrEqual(prevTraveled - 1e-9);
      expect(result.remainingKm).toBeLessThanOrEqual(prevRemaining + 1e-9);
      expect(result.traveledKm + result.remainingKm).toBeCloseTo(TOTAL_KM, 5);

      prevTraveled = result.traveledKm;
      prevRemaining = result.remainingKm;
    }
  });

  it('경로에서 살짝 벗어나도(GPS 오차) 가장 가까운 지점 기준으로 진행률을 계산한다', () => {
    const tracker = new WalkProgressTracker();
    // ROUTE[1] 근처에서 20m 정도 옆으로 벗어난 지점
    const nearRoute1: [number, number] = [ROUTE[1][0] + 0.0002, ROUTE[1][1]];
    const result = tracker.update(nearRoute1, ROUTE, TOTAL_KM, tick(0));
    const distanceFromRoute1 = haversineDistanceKm(nearRoute1, ROUTE[1]);

    expect(distanceFromRoute1).toBeLessThan(0.05); // 50m 이내 오차
    expect(result.progressRatio).toBeGreaterThan(0.1);
    expect(result.progressRatio).toBeLessThan(0.9);
  });

  it('경로에서 벗어나면(다른 길) 그 즉시 진행률 갱신이 보류되고, 계속 벗어나 있는 동안은 늘지 않는다', () => {
    const tracker = new WalkProgressTracker();
    const onRoute = tracker.update(ROUTE[1], ROUTE, TOTAL_KM, tick(0));
    // ROUTE[1]에서 약 300m 옆으로 벗어난 지점 — 완전히 다른 길을 걷는 상황을 흉내
    const farFromRoute: [number, number] = [ROUTE[1][0] + 0.003, ROUTE[1][1]];
    const distanceFromRoute1 = haversineDistanceKm(farFromRoute, ROUTE[1]);
    expect(distanceFromRoute1).toBeGreaterThan(0.05);

    const offRoute1 = tracker.update(farFromRoute, ROUTE, TOTAL_KM, tick(1));
    const offRoute2 = tracker.update(farFromRoute, ROUTE, TOTAL_KM, tick(2));

    // 이탈 중엔 단 한 번만 벗어나도(연속 확인 없이) 즉시 갱신을 보류한다 — 벗어난 상태의
    // "가장 가까운 점" 매칭은 신뢰할 수 없어서(엉뚱한 구간과 가까울 수 있음), 그대로
    // 반영하면 실제로 안 걸은 만큼 진행률이 부풀려질 수 있기 때문이다.
    expect(offRoute1.traveledKm).toBeCloseTo(onRoute.traveledKm, 5);
    expect(offRoute2.traveledKm).toBeCloseTo(onRoute.traveledKm, 5);
  });

  it('경로 이탈 후 원래 경로로 복귀하면, 이탈 중 위치와 무관하게 복귀 지점 기준으로 진행률이 갱신된다', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(ROUTE[0], ROUTE, TOTAL_KM, tick(0)); // 시작점

    // 경로에서 크게 벗어난 지점(다른 길) — 마침 경로 뒤쪽 구간(ROUTE[2] 근처)과 지리적으로
    // 가까운 위치라 해도, 이탈 중엔 반영되면 안 된다(반영되면 아래 있는 값이 부풀려져서,
    // 복귀 후 정상적으로 걸어도 그 부풀려진 값을 넘어서기 전까진 진행률이 안 올라간다).
    const wanderedOff: [number, number] = [ROUTE[2][0] + 0.001, ROUTE[2][1]];
    expect(haversineDistanceKm(wanderedOff, ROUTE[2])).toBeGreaterThan(0.05);
    // 두 지점이 서로 멀리 떨어져 있으니(도보 속도 필터에 안 걸리도록) 충분히 시간 간격을 둔다.
    tracker.update(wanderedOff, ROUTE, TOTAL_KM, START_MS + 5 * 60 * 1000);

    // 실제 경로 위, 시작점 근처(ROUTE[0]~ROUTE[1] 사이)로 복귀
    const result = tracker.update(ROUTE[1], ROUTE, TOTAL_KM, START_MS + 10 * 60 * 1000);

    // 이탈 중 ROUTE[2] 근처로 잘못 반영됐다면 진행률이 이미 60~70% 근처였을 것이다 — 그게
    // 아니라 ROUTE[1] 위치에 맞는(중간 이하) 정상적인 진행률이어야 한다.
    expect(result.progressRatio).toBeGreaterThan(0);
    expect(result.progressRatio).toBeLessThan(0.6);
  });

  it('순환 코스 도착점 근처에서 GPS 오차로 출발점에 더 가깝게 잡혀도 진행률이 뒤로 가지 않는다', () => {
    const tracker = new WalkProgressTracker();
    // 도착점(ROUTE 끝) 근처까지 이미 진행한 상태를 만든다(윈도우 매칭이 도착점 근처를 기억하도록).
    tracker.update(ROUTE[ROUTE.length - 1], ROUTE, TOTAL_KM, tick(0));
    // 출발점(ROUTE[0]) 바로 옆 — 순환 코스에서 도착점이 출발점 근처인 상황을 흉내
    const nearStart: [number, number] = [ROUTE[0][0] + 0.00005, ROUTE[0][1]];

    const result = tracker.update(nearStart, ROUTE, TOTAL_KM, tick(1));
    expect(result.progressRatio).toBeCloseTo(1, 5);
  });

  it('출발점과 도착점이 거의 같은 순환 코스를 막 시작했을 때, 첫 GPS가 도착점 쪽으로 잘못 매칭되지 않는다', () => {
    // 공원 한 바퀴 같은 순환 코스 — 시작점과 도착점이 지리적으로 몇 m밖에 안 떨어져 있다.
    const loopStart: [number, number] = [37.5665, 126.978];
    const loopEnd: [number, number] = [37.56651, 126.97805]; // loopStart에서 약 4~5m
    const loopRoute: WalkRouteResponse['coordinates'] = [
      loopStart,
      [37.568, 126.981],
      [37.569, 126.984],
      [37.567, 126.986],
      loopEnd,
    ];
    const loopTotalKm = loopRoute.reduce(
      (sum, point, i) => (i === 0 ? 0 : sum + haversineDistanceKm(loopRoute[i - 1], point)),
      0,
    );

    const tracker = new WalkProgressTracker();
    // 산책을 막 시작한 시점의 첫 GPS — 지리적으로는 도착점과 거의 같은 위치라(순환 코스 특성),
    // 창(window) 제약이 없다면 전역 최근접 탐색이 도착점(≈100%) 쪽으로 잘못 매칭될 수 있다.
    const result = tracker.update(loopEnd, loopRoute, loopTotalKm, tick(0));

    expect(result.progressRatio).toBeLessThan(0.1);
  });

  it('직전 지점 대비 도보로 말이 안 되는 속도의 GPS 값은 무시한다', () => {
    const tracker = new WalkProgressTracker();
    const onRoute = tracker.update(ROUTE[0], ROUTE, TOTAL_KM, tick(0));

    // 1초 만에 ROUTE 끝(수백 m)까지 순간이동한 것처럼 보이는 값 — 도보로는 불가능한 속도.
    const implausible = tracker.update(
      ROUTE[ROUTE.length - 1],
      ROUTE,
      TOTAL_KM,
      START_MS + 1000, // 1초 뒤
    );

    expect(implausible.traveledKm).toBeCloseTo(onRoute.traveledKm, 5);
  });

  it('경로 창(window) 밖이라도 GPS가 정상적으로 멀리서 다시 잡히면(신호 끊김 등) 전체 경로에서 다시 매칭한다', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(ROUTE[0], ROUTE, TOTAL_KM, tick(0));

    // 충분히 시간이 지난 뒤(속도 필터에 안 걸리도록) 경로 끝 쪽으로 훌쩍 이동 — GPS가 잠깐
    // 끊겼다가 실제로 많이 걸은 뒤 다시 잡힌 상황을 흉내(직전 매칭 지점 기준 윈도우 밖).
    const farAheadMs = START_MS + 60 * 60 * 1000; // 1시간 뒤
    const result = tracker.update(ROUTE[ROUTE.length - 1], ROUTE, TOTAL_KM, farAheadMs);

    expect(result.progressRatio).toBeCloseTo(1, 2);
  });
});
