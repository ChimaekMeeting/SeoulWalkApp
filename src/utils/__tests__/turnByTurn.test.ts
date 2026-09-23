import {
  buildTurnSteps,
  decideBackgroundAnnouncement,
  findNextTurnStep,
  formatTurnInstruction,
  maneuversToTurnSteps,
  resolveTurnSteps,
  TurnStep,
} from '../turnByTurn';
import { haversineDistanceKm, polylineLengthKm } from '../geo';
import { Maneuver, WalkRouteResponse } from '../../types/prewalk';

const START: [number, number] = [37.5, 127.0];

/** from에서 bearingDeg 방향으로 km만큼 떨어진 좌표(평면 근사 — 테스트용, 다른 테스트 파일의
 * offsetEastM과 같은 수준의 근사치). */
function destPoint(
  from: [number, number],
  bearingDegVal: number,
  km: number,
): [number, number] {
  const rad = (bearingDegVal * Math.PI) / 180;
  const dLat = (km / 111.32) * Math.cos(rad);
  const kmPerDegLon = 111.32 * Math.cos((from[0] * Math.PI) / 180);
  const dLon = (km / kmPerDegLon) * Math.sin(rad);
  return [from[0] + dLat, from[1] + dLon];
}

/** startBearing에서 시작해 각 구간의 [상대각도, 거리km]를 순서대로 이어붙인 경로를 만든다. */
function buildPath(
  start: [number, number],
  startBearing: number,
  legs: Array<[number, number]>,
): WalkRouteResponse['coordinates'] {
  const coords: WalkRouteResponse['coordinates'] = [start];
  let bearing = startBearing;
  let cur = start;
  for (const [turnDeg, km] of legs) {
    bearing = (bearing + turnDeg + 360) % 360;
    cur = destPoint(cur, bearing, km);
    coords.push(cur);
  }
  return coords;
}

describe('buildTurnSteps', () => {
  it('좌표가 2개 미만이면 빈 배열', () => {
    expect(buildTurnSteps([])).toEqual([]);
    expect(buildTurnSteps([START])).toEqual([]);
  });

  it('직각 우회전 1개를 올바른 atKm·kind로 검출한다', () => {
    const route = buildPath(START, 0, [
      [0, 0.35], // 북쪽 350m
      [90, 0.3], // 거기서 우회전(동쪽) 300m
    ]);
    const steps = buildTurnSteps(route);
    const turns = steps.filter(s => s.kind !== 'arrive');
    expect(turns).toHaveLength(1);
    expect(turns[0].kind).toBe('right');
    expect(turns[0].atKm).toBeCloseTo(0.35, 1);

    const arrive = steps[steps.length - 1];
    expect(arrive.kind).toBe('arrive');
    expect(arrive.atKm).toBeCloseTo(polylineLengthKm(route), 5);
  });

  it('완만한 지그재그 노이즈는 무시한다(직진으로 취급)', () => {
    // 전체적으로 북쪽으로 쭉 가지만 8도씩 좌우로 살짝 흔들리는 경로.
    const route = buildPath(START, 0, [
      [0, 0.03],
      [8, 0.03],
      [-16, 0.03],
      [8, 0.03],
      [8, 0.03],
      [-16, 0.03],
      [8, 0.03],
    ]);
    const steps = buildTurnSteps(route);
    expect(steps.filter(s => s.kind !== 'arrive')).toHaveLength(0);
    expect(steps).toHaveLength(1); // arrive만 남는다
  });

  it.each<[number, TurnStep['kind']]>([
    [30, 'slight_right'],
    [70, 'right'],
    [135, 'sharp_right'],
    [165, 'uturn'],
    [-30, 'slight_left'],
    [-70, 'left'],
    [-135, 'sharp_left'],
  ])('%d도 턴은 %s로 분류된다', (turnDeg, expectedKind) => {
    const route = buildPath(START, 0, [
      [0, 0.3],
      [turnDeg, 0.3],
    ]);
    const turns = buildTurnSteps(route).filter(s => s.kind !== 'arrive');
    expect(turns).toHaveLength(1);
    expect(turns[0].kind).toBe(expectedKind);
    expect(Math.sign(turns[0].angleDeg)).toBe(Math.sign(turnDeg));
  });
});

/** 필드 대부분을 기본값으로 채운 Maneuver — 테스트마다 필요한 필드만 덮어쓴다. */
function makeManeuver(
  overrides: Partial<Maneuver> & Pick<Maneuver, 'sequence' | 'type'>,
): Maneuver {
  return {
    instruction: '',
    location: [0, 0],
    node_id: null,
    distance_from_start_m: 0,
    distance_to_maneuver_m: 0,
    bearing_before_deg: null,
    bearing_after_deg: null,
    turn_angle_deg: null,
    ...overrides,
  };
}

describe('maneuversToTurnSteps', () => {
  it('start·arrive만 있고 회전이 없으면 arrive 스텝 하나만 남는다(start는 제외)', () => {
    const maneuvers = [
      makeManeuver({ sequence: 0, type: 'start', bearing_after_deg: 90 }),
      makeManeuver({
        sequence: 1,
        type: 'arrive',
        distance_from_start_m: 2000,
        bearing_before_deg: 90,
      }),
    ];
    const steps = maneuversToTurnSteps(maneuvers);
    expect(steps).toEqual([{ atKm: 2, kind: 'arrive', angleDeg: 0 }]);
  });

  it('bearing_before/after 차이로 좌/우/유턴을 분류하고 atKm을 m→km로 변환한다', () => {
    const maneuvers = [
      makeManeuver({ sequence: 0, type: 'start', bearing_after_deg: 90 }),
      makeManeuver({
        sequence: 1,
        type: 'left', // 백엔드 type은 참고만 — 실제 분류는 bearing 차이로 다시 계산한다
        distance_from_start_m: 889,
        bearing_before_deg: 90,
        bearing_after_deg: 0,
        turn_angle_deg: 90,
      }),
      makeManeuver({
        sequence: 2,
        type: 'arrive',
        distance_from_start_m: 2000,
        bearing_before_deg: 0,
      }),
    ];
    const steps = maneuversToTurnSteps(maneuvers);
    expect(steps).toEqual([
      { atKm: 0.889, kind: 'left', angleDeg: -90 },
      { atKm: 2, kind: 'arrive', angleDeg: 0 },
    ]);
  });

  it('유턴(bearing 차이 >= 150도)도 분류된다', () => {
    const maneuvers = [
      makeManeuver({ sequence: 0, type: 'start', bearing_after_deg: 0 }),
      makeManeuver({
        sequence: 1,
        type: 'u_turn',
        distance_from_start_m: 500,
        bearing_before_deg: 0,
        bearing_after_deg: 170,
      }),
      makeManeuver({
        sequence: 2,
        type: 'arrive',
        distance_from_start_m: 1000,
        bearing_before_deg: 170,
      }),
    ];
    const turns = maneuversToTurnSteps(maneuvers)!.filter(
      s => s.kind !== 'arrive',
    );
    expect(turns).toHaveLength(1);
    expect(turns[0].kind).toBe('uturn');
  });

  it('TURN_MIN_ANGLE_DEG(25도) 미만인 회전은 버린다(백엔드는 15도 기준으로 걸러 보낸다)', () => {
    const maneuvers = [
      makeManeuver({ sequence: 0, type: 'start', bearing_after_deg: 0 }),
      makeManeuver({
        sequence: 1,
        type: 'right',
        distance_from_start_m: 300,
        bearing_before_deg: 0,
        bearing_after_deg: 18, // 15~25도 사이 — 백엔드는 통과시키지만 프론트 기준엔 못 미침
      }),
      makeManeuver({
        sequence: 2,
        type: 'arrive',
        distance_from_start_m: 600,
        bearing_before_deg: 18,
      }),
    ];
    const steps = maneuversToTurnSteps(maneuvers);
    expect(steps).toEqual([{ atKm: 0.6, kind: 'arrive', angleDeg: 0 }]);
  });

  it('sequence 순서가 뒤섞여 와도 정렬해서 처리한다', () => {
    const maneuvers = [
      makeManeuver({
        sequence: 2,
        type: 'arrive',
        distance_from_start_m: 1000,
        bearing_before_deg: 90,
      }),
      makeManeuver({ sequence: 0, type: 'start', bearing_after_deg: 0 }),
      makeManeuver({
        sequence: 1,
        type: 'right',
        distance_from_start_m: 400,
        bearing_before_deg: 0,
        bearing_after_deg: 90,
      }),
    ];
    const steps = maneuversToTurnSteps(maneuvers);
    expect(steps).toEqual([
      { atKm: 0.4, kind: 'right', angleDeg: 90 },
      { atKm: 1, kind: 'arrive', angleDeg: 0 },
    ]);
  });

  it('arrive가 없으면(데이터 이상) null을 돌려준다', () => {
    const maneuvers = [
      makeManeuver({ sequence: 0, type: 'start', bearing_after_deg: 0 }),
    ];
    expect(maneuversToTurnSteps(maneuvers)).toBeNull();
  });
});

describe('resolveTurnSteps', () => {
  const ROUTE = buildPath(START, 0, [
    [0, 0.35],
    [90, 0.3],
  ]);

  it('maneuvers가 있으면 우선 쓰고 buildTurnSteps는 무시한다', () => {
    const maneuvers = [
      makeManeuver({ sequence: 0, type: 'start', bearing_after_deg: 0 }),
      makeManeuver({
        sequence: 1,
        type: 'left', // route 기하로는 우회전이지만, maneuvers 우선이라 이 값이 이겨야 한다
        distance_from_start_m: 100,
        bearing_before_deg: 0,
        bearing_after_deg: 270,
      }),
      makeManeuver({
        sequence: 2,
        type: 'arrive',
        distance_from_start_m: 200,
        bearing_before_deg: 270,
      }),
    ];
    const steps = resolveTurnSteps(ROUTE, maneuvers);
    expect(steps[0].kind).toBe('left');
    expect(steps[0].atKm).toBeCloseTo(0.1, 5);
  });

  it('maneuvers가 없으면 buildTurnSteps(기하 계산) 결과와 같다', () => {
    expect(resolveTurnSteps(ROUTE, undefined)).toEqual(buildTurnSteps(ROUTE));
    expect(resolveTurnSteps(ROUTE, null)).toEqual(buildTurnSteps(ROUTE));
    expect(resolveTurnSteps(ROUTE, [])).toEqual(buildTurnSteps(ROUTE));
  });

  it('maneuvers가 있어도 arrive가 없어 변환에 실패하면 buildTurnSteps로 폴백한다', () => {
    const brokenManeuvers = [
      makeManeuver({ sequence: 0, type: 'start', bearing_after_deg: 0 }),
    ];
    expect(resolveTurnSteps(ROUTE, brokenManeuvers)).toEqual(
      buildTurnSteps(ROUTE),
    );
  });
});

describe('findNextTurnStep', () => {
  const steps: TurnStep[] = [
    { atKm: 0.3, kind: 'right', angleDeg: 80 },
    { atKm: 0.6, kind: 'left', angleDeg: -80 },
    { atKm: 1.0, kind: 'arrive', angleDeg: 0 },
  ];

  it('진행률보다 앞에 있는 첫 스텝을 돌려준다', () => {
    expect(findNextTurnStep(steps, 0)?.atKm).toBe(0.3);
    expect(findNextTurnStep(steps, 0.3)?.atKm).toBe(0.6); // 이미 지남(atKm 이하)
    expect(findNextTurnStep(steps, 0.45)?.atKm).toBe(0.6);
    expect(findNextTurnStep(steps, 0.99)?.atKm).toBe(1.0);
  });

  it('모든 스텝을 지나면 null', () => {
    expect(findNextTurnStep(steps, 1.0)).toBeNull();
    expect(findNextTurnStep(steps, 2)).toBeNull();
  });

  it('빈 배열이면 항상 null', () => {
    expect(findNextTurnStep([], 0)).toBeNull();
  });
});

describe('formatTurnInstruction', () => {
  it('arrive는 항상 같은 문구', () => {
    expect(formatTurnInstruction('arrive', 0.5)).toBe('목적지 도착');
    expect(formatTurnInstruction('arrive', 0)).toBe('목적지 도착');
  });

  it('가까우면 지금, 멀면 m/km 단위로 표현한다', () => {
    expect(formatTurnInstruction('right', 0.01)).toBe('지금 우회전');
    expect(formatTurnInstruction('left', 0.25)).toBe('250m 앞 좌회전');
    expect(formatTurnInstruction('uturn', 1.2)).toBe('1.2km 앞 유턴');
  });
});

describe('decideBackgroundAnnouncement', () => {
  // 북쪽 350m → 우회전 → 동쪽 300m. 턴은 atKm≈0.35 지점.
  const ROUTE = buildPath(START, 0, [
    [0, 0.35],
    [90, 0.3],
  ]);

  it('턴에서 멀면 안내하지 않는다', () => {
    const d = decideBackgroundAnnouncement(ROUTE, pointAt(ROUTE, 0.1), null);
    expect(d.step?.kind).toBe('right');
    expect(d.shouldAnnounce).toBe(false);
  });

  it('턴 15m 이내이고 아직 안내한 적 없으면 안내해야 한다', () => {
    const d = decideBackgroundAnnouncement(ROUTE, pointAt(ROUTE, 0.345), null);
    expect(d.step?.kind).toBe('right');
    expect(d.shouldAnnounce).toBe(true);
  });

  it('같은 턴을 이미 안내했으면(lastAnnouncedAtKm 일치) 다시 안내하지 않는다', () => {
    const first = decideBackgroundAnnouncement(
      ROUTE,
      pointAt(ROUTE, 0.345),
      null,
    );
    const already = decideBackgroundAnnouncement(
      ROUTE,
      pointAt(ROUTE, 0.348),
      first.step!.atKm,
    );
    expect(already.shouldAnnounce).toBe(false);
  });

  it('모든 턴을 지나면(arrive만 남거나 그마저 지남) step이 null이 될 수 있다', () => {
    const d = decideBackgroundAnnouncement(ROUTE, pointAt(ROUTE, 10), null);
    expect(d.step).toBeNull();
    expect(d.shouldAnnounce).toBe(false);
    expect(d.distanceToKm).toBe(0);
  });
});

/** route 위 시작점부터 km 지점의 좌표(선형 보간, km이 전체 길이를 넘으면 끝점 쪽으로 그대로
 * 외삽 — decideBackgroundAnnouncement 테스트에서 "한참 지나침"을 표현하는 용도라 문제없다). */
function pointAt(
  route: WalkRouteResponse['coordinates'],
  km: number,
): [number, number] {
  let acc = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const segLen = haversineDistanceKm(route[i], route[i + 1]);
    if (acc + segLen >= km || i === route.length - 2) {
      const t = segLen === 0 ? 0 : (km - acc) / segLen;
      return [
        route[i][0] + (route[i + 1][0] - route[i][0]) * t,
        route[i][1] + (route[i + 1][1] - route[i][1]) * t,
      ];
    }
    acc += segLen;
  }
  return route[route.length - 1];
}
