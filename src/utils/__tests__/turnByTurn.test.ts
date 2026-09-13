import {
  buildTurnSteps,
  findNextTurnStep,
  formatTurnInstruction,
  TurnStep,
} from '../turnByTurn';
import { polylineLengthKm } from '../geo';
import { WalkRouteResponse } from '../../types/prewalk';

const START: [number, number] = [37.5, 127.0];

/** from에서 bearingDeg 방향으로 km만큼 떨어진 좌표(평면 근사 — 테스트용, 다른 테스트 파일의
 * offsetEastM과 같은 수준의 근사치). */
function destPoint(from: [number, number], bearingDegVal: number, km: number): [number, number] {
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
