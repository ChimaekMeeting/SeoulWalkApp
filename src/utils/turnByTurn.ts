import { Maneuver, WalkRouteResponse } from '../types/prewalk';
import { bearingDeg, haversineDistanceKm, projectOntoRoute } from './geo';

// route 좌표(도로 스냅된 [위도, 경도] 폴리라인)의 방위각 변화만으로 턴 지점을 찾는다.
// 백엔드가 maneuvers(도로 스냅·교차로 정보까지 반영)를 내려주면 resolveTurnSteps가 그걸 우선
// 쓰고, 없으면(기록 탭에서 재구성한 경로 등) 이 파일의 기하 계산으로 폴백한다 — WalkInProgressScreen은
// 항상 resolveTurnSteps(useTurnByTurn 경유)만 호출하므로 어느 경로든 같은 TurnStep 형태로 받는다.

export type TurnKind =
  | 'slight_left'
  | 'slight_right'
  | 'left'
  | 'right'
  | 'sharp_left'
  | 'sharp_right'
  | 'uturn'
  | 'arrive';

export interface TurnStep {
  /** 경로 시작점부터 이 턴까지의 누적 거리(km). WalkProgress.routeProgressKm과 같은 기준. */
  atKm: number;
  kind: TurnKind;
  /** 부호 있는 회전각(-180~180). 양수 = 우회전, 음수 = 좌회전. arrive는 항상 0. */
  angleDeg: number;
}

type LatLon = [number, number];

// 정점 하나하나가 아니라 "그 지점 전후 이만큼(km)의 평균 진행 방향"을 비교한다 — 도로 스냅 좌표는
// 코너 하나가 촘촘한 정점 여러 개로 표현되는 경우가 많아서, 정점 단위 방위각은 노이즈가 크다.
export const TURN_LOOKAROUND_KM = 0.015; // 15m
// 인접한 방향 변화(부호가 같은)를 이 거리 안에 있으면 하나의 턴으로 합친다.
export const TURN_MERGE_GAP_KM = 0.02; // 20m
// 이보다 작은 방향 변화는 "그 지점의 진동"으로 보고 클러스터를 끊거나 시작하지 않는다(무시).
const TURN_NOISE_FLOOR_DEG = 3;

// 각도 분류 경계 — 아래로 갈수록 급격한 턴.
export const TURN_MIN_ANGLE_DEG = 25; // 이 미만은 직진으로 보고 안내하지 않는다.
export const TURN_SLIGHT_MAX_DEG = 45; // [25, 45) 완만한 턴.
export const TURN_SHARP_MIN_DEG = 120; // [120, 150) 급턴.
export const TURN_UTURN_MIN_DEG = 150; // 150+ 유턴.

function normalizeAngleDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function classifyAngle(angleDeg: number): TurnKind {
  const abs = Math.abs(angleDeg);
  const isRight = angleDeg > 0;
  if (abs >= TURN_UTURN_MIN_DEG) return 'uturn';
  if (abs >= TURN_SHARP_MIN_DEG) return isRight ? 'sharp_right' : 'sharp_left';
  if (abs >= TURN_SLIGHT_MAX_DEG) return isRight ? 'right' : 'left';
  return isRight ? 'slight_right' : 'slight_left'; // [TURN_MIN_ANGLE_DEG, TURN_SLIGHT_MAX_DEG)
}

/**
 * route 위 누적거리(km) 지점의 좌표를 선형 보간으로 구하는 조회 함수를 만든다. 반환된 함수는
 * "호출마다 넘기는 km이 이전 호출보다 작지 않다"는 전제로 내부 포인터를 앞으로만 옮긴다(O(n) 총합) —
 * buildTurnSteps가 정점을 앞에서부터 순서대로 훑으며 쓰는 용도라 이 전제가 항상 성립한다.
 */
function makeForwardInterpolator(route: LatLon[], cumKm: number[]) {
  let idx = 0;
  const totalKm = cumKm[cumKm.length - 1];
  return (km: number): LatLon => {
    const clamped = Math.max(0, Math.min(km, totalKm));
    while (idx < route.length - 2 && cumKm[idx + 1] < clamped) idx++;
    const segStart = route[idx];
    const segEnd = route[idx + 1];
    const segLenKm = cumKm[idx + 1] - cumKm[idx];
    const t = segLenKm > 0 ? (clamped - cumKm[idx]) / segLenKm : 0;
    return [
      segStart[0] + (segEnd[0] - segStart[0]) * t,
      segStart[1] + (segEnd[1] - segStart[1]) * t,
    ];
  };
}

/**
 * route 좌표만으로 턴 지점 목록을 만든다. 각 정점에서 "들어오는 방향"(TURN_LOOKAROUND_KM 이전
 * 지점→이 정점)과 "나가는 방향"(이 정점→TURN_LOOKAROUND_KM 이후 지점)의 방위각 차이를 구하고,
 * 부호가 같은 변화들을 TURN_MERGE_GAP_KM 안에서 하나의 턴으로 합친다. 합산 각도가
 * TURN_MIN_ANGLE_DEG 미만이면 직진으로 보고 버린다. 마지막엔 항상 종착점(atKm=전체 길이) 'arrive'
 * 스텝을 붙인다. 좌표가 2개 미만이면 빈 배열.
 */
export function buildTurnSteps(
  route: WalkRouteResponse['coordinates'],
): TurnStep[] {
  if (!Array.isArray(route) || route.length < 2) return [];

  const cumKm = [0];
  for (let i = 1; i < route.length; i++) {
    cumKm.push(cumKm[i - 1] + haversineDistanceKm(route[i - 1], route[i]));
  }
  const totalKm = cumKm[cumKm.length - 1];

  const behindAt = makeForwardInterpolator(route, cumKm);
  const aheadAt = makeForwardInterpolator(route, cumKm);

  const steps: TurnStep[] = [];

  let clusterSum = 0;
  let clusterSign = 0;
  let clusterPeakAbs = 0;
  let clusterPeakKm = 0;
  let lastIncludedKm: number | null = null;

  const flushCluster = () => {
    if (lastIncludedKm == null) return;
    if (Math.abs(clusterSum) >= TURN_MIN_ANGLE_DEG) {
      steps.push({
        atKm: clusterPeakKm,
        kind: classifyAngle(clusterSum),
        angleDeg: clusterSum,
      });
    }
    clusterSum = 0;
    clusterSign = 0;
    clusterPeakAbs = 0;
    lastIncludedKm = null;
  };

  for (let i = 1; i < route.length - 1; i++) {
    const km = cumKm[i];
    const behind = behindAt(km - TURN_LOOKAROUND_KM);
    const ahead = aheadAt(km + TURN_LOOKAROUND_KM);
    const bearingIn = bearingDeg(behind, route[i]);
    const bearingOut = bearingDeg(route[i], ahead);
    const delta = normalizeAngleDeg(bearingOut - bearingIn);

    if (Math.abs(delta) < TURN_NOISE_FLOOR_DEG) continue; // 진동 — 클러스터에 영향 없음

    const sign = Math.sign(delta);
    const withinGap =
      lastIncludedKm != null && km - lastIncludedKm <= TURN_MERGE_GAP_KM;
    if (!(withinGap && sign === clusterSign)) flushCluster();

    clusterSum += delta;
    clusterSign = sign;
    lastIncludedKm = km;
    if (Math.abs(delta) > clusterPeakAbs) {
      clusterPeakAbs = Math.abs(delta);
      clusterPeakKm = km;
    }
  }
  flushCluster();

  steps.push({ atKm: totalKm, kind: 'arrive', angleDeg: 0 });
  return steps;
}

/**
 * 백엔드 maneuvers를 TurnStep으로 변환한다. 방향 분류(slight/sharp 포함 7종)는 백엔드 type을
 * 그대로 쓰지 않고 bearing_before/after로 부호 있는 회전각을 다시 계산해 classifyAngle에
 * 태운다 — 백엔드는 left/right/u_turn 3종만 구분하지만, buildTurnSteps(기하 계산 경로)와 완전히
 * 같은 분류 기준·최소각(TURN_MIN_ANGLE_DEG) 필터를 쓰기 위함이다(백엔드 필터는 15°, 프론트는 25°).
 * start는 빼고(atKm=0이라 findNextTurnStep이 어차피 못 찾는다 — buildTurnSteps와 동일 동작),
 * 유효한 arrive가 하나도 없으면(데이터 이상) null을 돌려 호출부가 buildTurnSteps로 폴백하게 한다.
 */
export function maneuversToTurnSteps(maneuvers: Maneuver[]): TurnStep[] | null {
  const sorted = [...maneuvers].sort((a, b) => a.sequence - b.sequence);
  const steps: TurnStep[] = [];
  let hasArrive = false;

  for (const m of sorted) {
    const atKm = m.distance_from_start_m / 1000;
    if (m.type === 'start') continue;
    if (m.type === 'arrive') {
      steps.push({ atKm, kind: 'arrive', angleDeg: 0 });
      hasArrive = true;
      continue;
    }
    const angleDeg = normalizeAngleDeg(
      (m.bearing_after_deg ?? 0) - (m.bearing_before_deg ?? 0),
    );
    if (Math.abs(angleDeg) < TURN_MIN_ANGLE_DEG) continue;
    steps.push({ atKm, kind: classifyAngle(angleDeg), angleDeg });
  }

  return hasArrive ? steps : null;
}

/**
 * 턴 목록을 구하는 단일 진입점. useTurnByTurn·decideBackgroundAnnouncement가 항상 이 함수를
 * 통해서만 턴을 계산한다 — 백엔드 maneuvers가 있으면 우선 쓰고, 없거나(기록 탭 재걷기 등)
 * 변환에 실패하면 buildTurnSteps(기하 계산)로 폴백한다.
 */
export function resolveTurnSteps(
  route: WalkRouteResponse['coordinates'],
  maneuvers?: Maneuver[] | null,
): TurnStep[] {
  if (maneuvers && maneuvers.length > 0) {
    const fromBackend = maneuversToTurnSteps(maneuvers);
    if (fromBackend) return fromBackend;
  }
  return buildTurnSteps(route);
}

// 사람이 읽는 안내 문구에 쓰는 한글 라벨.
const TURN_KIND_LABEL: Record<Exclude<TurnKind, 'arrive'>, string> = {
  slight_left: '좌측 방향',
  slight_right: '우측 방향',
  left: '좌회전',
  right: '우회전',
  sharp_left: '급좌회전',
  sharp_right: '급우회전',
  uturn: '유턴',
};

// 이 거리(km) 안이면 "OOm 앞" 대신 "지금"으로 표현한다. useTurnByTurn(포그라운드 최종 안내)과
// turnByTurnBackgroundTask(백그라운드 알림)가 "지금 안내해야 하는 순간"을 판단할 때도 같이 쓴다 —
// 두 곳에서 같은 숫자를 따로 정의하면 어긋날 수 있어 하나로 export.
export const TURN_IMMEDIATE_KM = 0.015; // 15m

/** "250m 앞 우회전" / "지금 좌회전" / "목적지 도착" 같은 안내 문구를 만든다. */
export function formatTurnInstruction(
  kind: TurnKind,
  distanceToKm: number,
): string {
  if (kind === 'arrive') return '목적지 도착';
  const label = TURN_KIND_LABEL[kind];
  const km = Math.max(0, distanceToKm);
  if (km <= TURN_IMMEDIATE_KM) return `지금 ${label}`;
  if (km < 1) return `${Math.round(km * 1000)}m 앞 ${label}`;
  return `${km.toFixed(1)}km 앞 ${label}`;
}

/** steps 중 아직 지나지 않은(atKm이 routeProgressKm보다 큰) 첫 번째 턴. 없으면 null. */
export function findNextTurnStep(
  steps: TurnStep[],
  routeProgressKm: number,
): TurnStep | null {
  return steps.find(step => step.atKm > routeProgressKm) ?? null;
}

export interface BackgroundAnnouncementDecision {
  step: TurnStep | null;
  distanceToKm: number;
  /**
   * true면 이번 GPS fix에서 알림·TTS를 내보내야 한다는 뜻 — 호출부(turnByTurnBackgroundTask)가
   * 실제로 내보낸 뒤 lastAnnouncedAtKm을 step.atKm으로 갱신해야 다음 fix에서 다시 true가 되지 않는다.
   */
  shouldAnnounce: boolean;
}

/**
 * 백그라운드 위치 태스크 전용 — WalkProgressTracker처럼 이력을 들고 있는 상태가 없어도 되는 용도라
 * (진행률 바가 아니라 "다음 턴 알림" 판단용), 매 GPS fix를 독립적으로 route에 투영해 다음 턴까지
 * 남은 거리를 구한다. lastAnnouncedAtKm(직전에 이미 알림을 보낸 턴의 atKm — 포그라운드 훅과
 * activeWalkSession을 통해 공유)과 비교해 같은 턴을 두 번 알리지 않는다. 순수 함수라 Jest로 검증
 * 가능 — TaskManager 콜백 자체(네이티브 위치 스트림 구독)는 여기서 다루지 않는다.
 */
export function decideBackgroundAnnouncement(
  route: WalkRouteResponse['coordinates'],
  current: [number, number],
  lastAnnouncedAtKm: number | null,
  maneuvers?: Maneuver[] | null,
): BackgroundAnnouncementDecision {
  const steps = resolveTurnSteps(route, maneuvers);
  const { distanceAlongRouteKm } = projectOntoRoute(current, route);
  const step = findNextTurnStep(steps, distanceAlongRouteKm);
  const distanceToKm = step ? Math.max(0, step.atKm - distanceAlongRouteKm) : 0;
  const withinRange = step != null && distanceToKm <= TURN_IMMEDIATE_KM;
  const alreadyAnnounced = step != null && lastAnnouncedAtKm === step.atKm;
  return {
    step,
    distanceToKm,
    shouldAnnounce: withinRange && !alreadyAnnounced,
  };
}
