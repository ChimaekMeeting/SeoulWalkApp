import {
  WalkProgressTracker,
  deriveProgress,
  resolveEndReason,
  REQUIRED_DESTINATION_FIXES,
  REQUIRED_REMATCH_FIXES,
} from '../walkProgress';
import { haversineDistanceKm, polylineLengthKm } from '../geo';
import { WalkRouteResponse } from '../../types/prewalk';

// 남북(경도 고정)으로 뻗은 직선 경로 — 좌표 계산이 단순해 테스트하기 쉽다. 약 0.44km.
const ROUTE: WalkRouteResponse['coordinates'] = [
  [37.5, 127.0],
  [37.501, 127.0],
  [37.502, 127.0],
  [37.503, 127.0],
  [37.504, 127.0],
];
const ROUTE_LEN_KM = polylineLengthKm(ROUTE);

const T0 = 1_700_000_000_000;
const at = (sec: number) => T0 + sec * 1000;

/** 경로 시작점부터 km 지점의 좌표(선형 보간). */
function pointAlong(km: number): [number, number] {
  let acc = 0;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const segLen = haversineDistanceKm(ROUTE[i], ROUTE[i + 1]);
    if (acc + segLen >= km || i === ROUTE.length - 2) {
      const t = segLen === 0 ? 0 : (km - acc) / segLen;
      return [
        ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * t,
        ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * t,
      ];
    }
    acc += segLen;
  }
  return ROUTE[ROUTE.length - 1];
}

/** p에서 동쪽(경로에 수직)으로 meters만큼 떨어진 좌표. */
function offsetEastM(p: [number, number], meters: number): [number, number] {
  const kmPerDegLon = 111.32 * Math.cos((p[0] * Math.PI) / 180);
  return [p[0], p[1] + meters / 1000 / kmPerDegLon];
}

/** 경로 위를 시작점→끝점까지 걸으며 fix를 흘려보낸다. 마지막 스냅샷 반환. */
function walkToEnd(tracker: WalkProgressTracker, stepKm = 0.04, gapSec = 30) {
  let last = tracker.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));
  let sec = gapSec;
  for (let km = stepKm; km < ROUTE_LEN_KM; km += stepKm) {
    last = tracker.update(pointAlong(km), ROUTE, ROUTE_LEN_KM, at(sec));
    sec += gapSec;
  }
  return { last, nextSec: sec };
}

describe('deriveProgress', () => {
  it('음수·NaN·Infinity·0 길이를 방어한다', () => {
    expect(deriveProgress(-1, 3)).toMatchObject({ routeProgressKm: 0, routeProgressRatio: 0 });
    expect(deriveProgress(NaN, 3).routeProgressRatio).toBe(0);
    expect(deriveProgress(1, 0)).toMatchObject({ routeProgressRatio: 0, remainingRouteKm: 0 });
    expect(deriveProgress(1, NaN).routeProgressRatio).toBe(0);
    expect(deriveProgress(5, 3)).toMatchObject({ routeProgressKm: 3, routeProgressRatio: 1 });
    const mid = deriveProgress(1.5, 3);
    expect(mid.routeProgressRatio).toBeCloseTo(0.5, 5);
    expect(mid.remainingRouteKm).toBeCloseTo(1.5, 5);
  });
});

describe('resolveEndReason', () => {
  it('상태와 GPS 가용 여부로 종료 사유를 정한다', () => {
    expect(resolveEndReason('complete', true)).toBe('destination_arrived');
    expect(resolveEndReason('tracking', true)).toBe('user_ended_before_destination');
    expect(resolveEndReason('tracking', false)).toBe('gps_unavailable');
  });
});

describe('WalkProgressTracker — 정상 진행', () => {
  it('시작점에서 tracking으로 전환되고 진행률은 0에 가깝다', () => {
    const tracker = new WalkProgressTracker();
    const r = tracker.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));
    expect(r.state).toBe('tracking');
    expect(r.routeProgressRatio).toBeCloseTo(0, 2);
    expect(r.remainingRouteKm).toBeCloseTo(ROUTE_LEN_KM, 2);
  });

  it('경로를 따라 걸으면 routeProgressKm은 단조 증가, remainingRouteKm은 단조 감소', () => {
    const tracker = new WalkProgressTracker();
    let prevProgress = -1;
    let prevRemaining = Infinity;
    let sec = 0;
    for (let km = 0; km <= ROUTE_LEN_KM; km += 0.04) {
      const r = tracker.update(pointAlong(km), ROUTE, ROUTE_LEN_KM, at(sec));
      expect(r.routeProgressKm).toBeGreaterThanOrEqual(prevProgress - 1e-9);
      expect(r.remainingRouteKm).toBeLessThanOrEqual(prevRemaining + 1e-9);
      expect(r.routeProgressKm + r.remainingRouteKm).toBeCloseTo(ROUTE_LEN_KM, 5);
      prevProgress = r.routeProgressKm;
      prevRemaining = r.remainingRouteKm;
      sec += 30;
    }
  });

  it('경로에서 20m 벗어나도(GPS 오차) 가장 가까운 지점 기준으로 진행률이 오른다', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));
    const r = tracker.update(
      offsetEastM(pointAlong(0.2), 20),
      ROUTE,
      ROUTE_LEN_KM,
      at(60),
    );
    expect(r.state).toBe('tracking');
    expect(r.routeProgressRatio).toBeGreaterThan(0.2);
    expect(r.routeProgressRatio).toBeLessThan(0.8);
  });
});

describe('WalkProgressTracker — 종착점 geofence 완료', () => {
  it('종착점 반경 안 연속 fix로 완료가 확정되고, 이후 GPS가 흔들려도 complete 유지', () => {
    const tracker = new WalkProgressTracker();
    const { nextSec } = walkToEnd(tracker);

    let sec = nextSec;
    let r = tracker.update(pointAlong(ROUTE_LEN_KM), ROUTE, ROUTE_LEN_KM, at(sec));
    for (let i = 1; i < REQUIRED_DESTINATION_FIXES; i++) {
      sec += 30;
      r = tracker.update(pointAlong(ROUTE_LEN_KM), ROUTE, ROUTE_LEN_KM, at(sec));
    }
    expect(r.state).toBe('complete');
    expect(r.routeProgressRatio).toBe(1);
    expect(r.remainingRouteKm).toBe(0);

    // 완료 후 종착점에서 30m 벗어난 fix가 와도 상태·값이 그대로.
    const wobble = tracker.update(
      offsetEastM(pointAlong(ROUTE_LEN_KM), 30),
      ROUTE,
      ROUTE_LEN_KM,
      at(sec + 30),
    );
    expect(wobble.state).toBe('complete');
    expect(wobble.routeProgressRatio).toBe(1);
    expect(wobble).toEqual(r);
  });

  it('백엔드 total_km과 폴리라인 길이가 달라도 종착점 도착 시 ratio는 정확히 1', () => {
    // 진행률 분모는 tracker에 넘긴 routeLengthKm(폴리라인 길이)이지 backendTotalKm가 아니다.
    const tracker = new WalkProgressTracker();
    const { nextSec } = walkToEnd(tracker);
    let sec = nextSec;
    let r = r0(tracker, sec);
    for (let i = 1; i < REQUIRED_DESTINATION_FIXES; i++) {
      sec += 30;
      r = r0(tracker, sec);
    }
    expect(r.state).toBe('complete');
    expect(r.routeProgressRatio).toBe(1);

    function r0(t: WalkProgressTracker, s: number) {
      return t.update(pointAlong(ROUTE_LEN_KM), ROUTE, ROUTE_LEN_KM, at(s));
    }
  });

  it('initializing 상태에서는 종착점 fix를 누적하지 않는다(순환 코스 시작 직후 완료 방지)', () => {
    // 시작점과 도착점이 사실상 같은 순환 경로.
    const loop: WalkRouteResponse['coordinates'] = [
      [37.5, 127.0],
      [37.503, 127.002],
      [37.505, 127.0],
      [37.503, 126.998],
      [37.50001, 127.00001],
    ];
    const loopLen = polylineLengthKm(loop);
    const tracker = new WalkProgressTracker();
    // 시작점(=도착점 근처)에서 여러 번 서 있어도 완료되면 안 된다.
    let r = tracker.update(loop[0], loop, loopLen, at(0));
    r = tracker.update(loop[0], loop, loopLen, at(30));
    r = tracker.update(loop[0], loop, loopLen, at(60));
    expect(r.state).not.toBe('complete');
    expect(r.routeProgressRatio).toBeLessThan(0.1);
  });
});

describe('WalkProgressTracker — 이탈 중 두 값 분리 (보완 1)', () => {
  it('유효하지만 경로 밖인 fix는 actualDistanceKm만 늘리고 routeProgressKm는 유지', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));
    const onRoute = tracker.update(pointAlong(0.15), ROUTE, ROUTE_LEN_KM, at(60));
    expect(onRoute.state).toBe('tracking');

    // 경로에서 동쪽으로 90m 벗어나 정상 속도로 계속 이동(전진).
    let sec = 120;
    let off = onRoute;
    for (let d = 0.03; d <= 0.12; d += 0.03) {
      off = tracker.update(offsetEastM(pointAlong(0.15 + d), 90), ROUTE, ROUTE_LEN_KM, at(sec));
      sec += 30;
    }
    expect(off.state).toBe('off_route');
    expect(off.routeProgressKm).toBeCloseTo(onRoute.routeProgressKm, 5);
    expect(off.actualDistanceKm).toBeGreaterThan(onRoute.actualDistanceKm + 0.05);

    // 되돌아 경로로 복귀하면 복귀 지점 기준으로 다시 오른다.
    const back = tracker.update(pointAlong(0.3), ROUTE, ROUTE_LEN_KM, at(sec + 30));
    expect(back.state).toBe('tracking');
    expect(back.routeProgressKm).toBeGreaterThan(off.routeProgressKm);
  });

  it('거부된 fix(GPS 점프·동일 timestamp)는 actualDistanceKm도 routeProgressKm도 안 바꾼다', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));
    const base = tracker.update(pointAlong(0.1), ROUTE, ROUTE_LEN_KM, at(60));

    // 1초 만에 경로 끝으로 순간이동 → 점프 필터.
    const jump = tracker.update(pointAlong(ROUTE_LEN_KM), ROUTE, ROUTE_LEN_KM, at(61));
    expect(jump.routeProgressKm).toBeCloseTo(base.routeProgressKm, 6);
    expect(jump.actualDistanceKm).toBeCloseTo(base.actualDistanceKm, 6);

    // 동일 timestamp → 폐기.
    const dup = tracker.update(pointAlong(0.2), ROUTE, ROUTE_LEN_KM, at(60));
    expect(dup.routeProgressKm).toBeCloseTo(base.routeProgressKm, 6);
    expect(dup.actualDistanceKm).toBeCloseTo(base.actualDistanceKm, 6);

    // 과거 timestamp → 폐기.
    const past = tracker.update(pointAlong(0.2), ROUTE, ROUTE_LEN_KM, at(30));
    expect(past.routeProgressKm).toBeCloseTo(base.routeProgressKm, 6);
  });
});

describe('WalkProgressTracker — 허용 반경 hysteresis (보완 2)', () => {
  it('accuracy가 나쁘면 accept 반경이 커지되 off-route는 항상 accept+20m 이상, 최대 100m', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));

    // accuracy 90m → accept ≈ 80m(상한), off ≈ 100m(상한). 90m 이격 fix는 accept 밖이지만 off 안 → uncertain.
    const r = tracker.update(
      offsetEastM(pointAlong(0.2), 90),
      ROUTE,
      ROUTE_LEN_KM,
      at(60),
      90,
    );
    expect(r.state).toBe('uncertain');
    expect(r.routeProgressKm).toBeCloseTo(0, 5); // 진행 없음(수용 안 됨)

    // 같은 위치라도 accuracy가 좋으면(5m) 90m 이격은 off-route.
    const tracker2 = new WalkProgressTracker();
    tracker2.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));
    const r2 = tracker2.update(
      offsetEastM(pointAlong(0.2), 90),
      ROUTE,
      ROUTE_LEN_KM,
      at(60),
      5,
    );
    expect(r2.state).toBe('off_route');
  });

  it('35~55m 밴드의 fix는 즉시 off-route로 확정하지 않고 uncertain', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));
    const r = tracker.update(offsetEastM(pointAlong(0.2), 45), ROUTE, ROUTE_LEN_KM, at(60));
    expect(r.state).toBe('uncertain');
  });
});

describe('WalkProgressTracker — 긴 GPS 공백 후 전역 오매칭 거부 (보완 3)', () => {
  // 왕복 경로: 올라갔다가 동쪽으로 ~220m 벌어진 길로 되돌아온다(return leg).
  const OUT_BACK: WalkRouteResponse['coordinates'] = [
    [37.5, 127.0],
    [37.503, 127.0],
    [37.506, 127.0],
    [37.506, 127.0025],
    [37.503, 127.0025],
    [37.5, 127.0025],
  ];
  const OB_LEN = polylineLengthKm(OUT_BACK);

  it('1시간 공백 뒤 return leg로 튄 전역 후보 1개로는 확정하지 않고 uncertain', () => {
    const tracker = new WalkProgressTracker();
    // outbound 0.2km 지점까지 정상 진행.
    tracker.update(OUT_BACK[0], OUT_BACK, OB_LEN, at(0));
    const onOut = tracker.update([37.5018, 127.0], OUT_BACK, OB_LEN, at(60));
    expect(onOut.state).toBe('tracking');
    const progressBefore = onOut.routeProgressKm;

    // 1시간 뒤, return leg(경로상 훨씬 앞, outbound와 220m 떨어짐) 위치에서 다시 잡힘.
    const farAhead = at(3600);
    const r1 = tracker.update([37.5018, 127.0025], OUT_BACK, OB_LEN, farAhead);
    expect(r1.state).toBe('uncertain');
    expect(r1.routeProgressKm).toBeCloseTo(progressBefore, 5);

    // 같은 구간을 가리키는 fix가 REQUIRED_REMATCH_FIXES개 모이면 그때 tracking 복귀.
    let r = r1;
    for (let i = 1; i < REQUIRED_REMATCH_FIXES; i++) {
      r = tracker.update([37.5018, 127.0025], OUT_BACK, OB_LEN, farAhead + i * 30_000);
    }
    expect(r.state).toBe('tracking');
    expect(r.routeProgressKm).toBeGreaterThan(progressBefore + 0.5);
  });

  it('정상적인 긴 GPS 공백: 연속 fix 2개로 경로 끝 부근 진행률이 갱신된다', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(OUT_BACK[0], OUT_BACK, OB_LEN, at(0));
    tracker.update([37.5018, 127.0], OUT_BACK, OB_LEN, at(60));

    // 1시간 뒤 return leg 하단(거의 끝)에서 재수신 — 두 번 확인되면 채택.
    const base = at(3600);
    tracker.update([37.5005, 127.0025], OUT_BACK, OB_LEN, base);
    const r = tracker.update([37.5005, 127.0025], OUT_BACK, OB_LEN, base + 30_000);
    expect(r.state).toBe('tracking');
    expect(r.routeProgressRatio).toBeGreaterThan(0.9);
  });

  it('5초 만에 경로 끝으로 순간이동한 fix는 점프 필터로 거부(공백과 무관)', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(OUT_BACK[0], OUT_BACK, OB_LEN, at(0));
    const base = tracker.update([37.5018, 127.0], OUT_BACK, OB_LEN, at(60));
    const r = tracker.update(OUT_BACK[2], OUT_BACK, OB_LEN, at(65));
    expect(r.routeProgressKm).toBeCloseTo(base.routeProgressKm, 5);
  });
});

describe('WalkProgressTracker — 역행 방지 & 첫 fix', () => {
  it('경로를 따라가다 GPS 오차로 뒤 지점에 매칭돼도 routeProgressKm은 감소하지 않는다', () => {
    const tracker = new WalkProgressTracker();
    tracker.update(pointAlong(0), ROUTE, ROUTE_LEN_KM, at(0));
    const a = tracker.update(pointAlong(0.3), ROUTE, ROUTE_LEN_KM, at(120));
    const b = tracker.update(pointAlong(0.29), ROUTE, ROUTE_LEN_KM, at(150));
    const c = tracker.update(pointAlong(0.27), ROUTE, ROUTE_LEN_KM, at(180));
    expect(b.routeProgressKm).toBeGreaterThanOrEqual(a.routeProgressKm - 1e-9);
    expect(c.routeProgressKm).toBeGreaterThanOrEqual(a.routeProgressKm - 1e-9);
  });

  it('첫 fix가 경로에서 100m 넘게 떨어져 있으면 진행률 0, 상태는 initializing 유지', () => {
    const tracker = new WalkProgressTracker();
    const r = tracker.update(offsetEastM(pointAlong(0.2), 200), ROUTE, ROUTE_LEN_KM, at(0));
    expect(r.state).toBe('initializing');
    expect(r.routeProgressKm).toBe(0);
  });

  it('첫 fix가 경로 중간이면 일관된 fix가 모일 때까지 확정하지 않는다', () => {
    const tracker = new WalkProgressTracker();
    const r1 = tracker.update(pointAlong(0.25), ROUTE, ROUTE_LEN_KM, at(0));
    expect(r1.state).toBe('initializing');
    expect(r1.routeProgressKm).toBe(0);
    const r2 = tracker.update(pointAlong(0.25), ROUTE, ROUTE_LEN_KM, at(30));
    expect(r2.state).toBe('tracking');
    expect(r2.routeProgressRatio).toBeGreaterThan(0.4);
    expect(r2.routeProgressRatio).toBeLessThan(0.7);
  });
});
