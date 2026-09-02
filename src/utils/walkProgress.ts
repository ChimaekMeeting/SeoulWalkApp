import { WalkRouteResponse } from '../types/prewalk';
import { WalkEndReason } from '../types/walk';
import { haversineDistanceKm, projectOntoRoute } from './geo';

// 거리/투영 계산은 지도 레이어(RouteEndpointMarkers 등)와 공유하려고 geo.ts로 옮겼다.
// haversineDistanceKm는 이 파일 경로로 import하던 테스트가 안 깨지도록 계속 재노출한다.
export { haversineDistanceKm };

// --- 허용 반경 정책 ----------------------------------------------------------
// "경로 위로 인정하는 반경(accept)"과 "경로에서 벗어났다고 확정하는 반경(off-route)"을 분리한다.
// off-route는 항상 accept보다 최소 OFF_ROUTE_HYSTERESIS_KM 크고 최대 MAX_OFF_ROUTE_RADIUS_KM.
// 그 사이 band(예: 35~55m)는 즉시 이탈로 확정하지 않고 uncertain으로 둔다(경계 flapping 방지).
export const BASE_ACCEPT_RADIUS_KM = 0.03; // 30m
export const MAX_ACCEPT_RADIUS_KM = 0.08; // 80m — GPS accuracy 반영 상한
export const BASE_OFF_ROUTE_RADIUS_KM = 0.06; // 60m
export const OFF_ROUTE_HYSTERESIS_KM = 0.02; // 20m
export const MAX_OFF_ROUTE_RADIUS_KM = 0.1; // 100m
export const GPS_ACCURACY_MULTIPLIER = 1.5;

// 후보 탐색 창을 이 순서로 넓혀가며 시도하고, 마지막에 전역 탐색으로 폴백한다.
export const SEARCH_WINDOWS_KM = [0.15, 0.3, 0.6];

// 도보로 불가능한 속도(직전 "유효 fix" 대비). 넘으면 GPS가 튄 것으로 보고 이번 fix를 통째로 버린다.
export const MAX_PLAUSIBLE_SPEED_KMH = 15;
// 후보의 경로상 전진량(deltaKm) 허용치에 더하는 GPS 잡음 여유.
export const GPS_NOISE_MARGIN_KM = 0.03;
// 이 정도 이내의 뒤처짐은 GPS 오차로 보고 후보를 수용하되 진행률은 유지한다(감소 금지).
export const BACKTRACK_TOLERANCE_KM = 0.02;

// 기본 창(SEARCH_WINDOWS_KM[0]) 밖에서 찾은 후보가 "믿을 수 있는 전진량"을 넘게 앞서 있으면
// 즉시 확정하지 않는다. dt가 커도(신호 끊김) 시간만 믿고 멀리 튀지 못하게 상한을 둔다 —
// 같은 구간을 가리키는 fix가 REQUIRED_REMATCH_FIXES개 모여야 tracking 복귀(순환·왕복 코스에서
// 한 번의 오매칭이 Math.max로 영구 확정되는 것을 막는다).
export const REMATCH_TRUSTED_GAP_HOURS = 120 / 3600; // 2분치 이동량까지는 바로 신뢰
export const REMATCH_CLUSTER_KM = 0.05;
export const REQUIRED_REMATCH_FIXES = 2;

// 종착점 geofence: 이 반경 안에서 연속 fix가 REQUIRED_DESTINATION_FIXES회 잡히면 완료로 확정한다.
// 경로 진행률 숫자와는 독립. 단 ① initializing 동안은 검사하지 않고 ② 종착점 영역을 한 번
// 벗어난 뒤(EXIT_RADIUS)에야 카운트를 시작한다 — 순환 코스에서 시작점≈도착점이라 출발 직후
// 완료돼버리는 것을 막는다.
export const DESTINATION_RADIUS_KM = 0.05; // 50m
export const DESTINATION_EXIT_RADIUS_KM = 0.12; // 이만큼 멀어져야 "종착점을 떠났다"고 본다
export const REQUIRED_DESTINATION_FIXES = 2;

// 첫 위치 확정: 시작점에서 INIT_NEAR_START_KM 이내면 바로 tracking, 아니면(경로 중간 복구)
// 일관된 fix를 REQUIRED_INIT_FIXES개 모은 뒤 그 위치를 채택한다.
export const INIT_NEAR_START_KM = 0.15;
export const REQUIRED_INIT_FIXES = 2;
const INIT_CONSISTENCY_KM = 0.05;

const HOUR_MS = 3_600_000;

export type WalkProgressState =
  | 'initializing'
  | 'tracking'
  | 'uncertain'
  | 'off_route'
  | 'complete';

export interface WalkProgress {
  state: WalkProgressState;
  /** 경로 시작점부터 현재 GPS의 신뢰 가능한 경로 투영점까지의 누적 거리(km) = 화면 진행률의 분자. */
  routeProgressKm: number;
  routeProgressRatio: number;
  remainingRouteKm: number;
  /** 거부되지 않은 GPS fix 사이 실측 이동거리 누적(km). 경로 이탈 중에도 늘어난다 — 참고값. */
  actualDistanceKm: number;
}

type LatLon = [number, number];

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * routeProgressKm 하나로부터 ratio/remaining을 유도한다. GPS fix를 아직 못 받았을 때(예:
 * WalkInProgressScreen 마운트 직후)도 같은 공식을 쓰도록 별도로 내보낸다.
 *
 * routeLengthKm은 tracker가 실제로 투영에 쓰는 폴리라인의 누적 길이여야 한다 — 백엔드 total_km는
 * 클라이언트 폴리라인과 스케일이 달라(직선 현 vs 실도로) 종착점에서도 100%에 못 닿는다. NaN/음수/0 방어.
 */
export function deriveProgress(
  routeProgressKm: number,
  routeLengthKm: number,
  state: WalkProgressState = 'initializing',
  actualDistanceKm = 0,
): WalkProgress {
  const lengthKm = Number.isFinite(routeLengthKm) && routeLengthKm > 0 ? routeLengthKm : 0;
  const rawKm = Number.isFinite(routeProgressKm) && routeProgressKm > 0 ? routeProgressKm : 0;
  const progressKm = lengthKm > 0 ? Math.min(rawKm, lengthKm) : rawKm;
  const actual =
    Number.isFinite(actualDistanceKm) && actualDistanceKm > 0 ? actualDistanceKm : 0;
  return {
    state,
    routeProgressKm: progressKm,
    routeProgressRatio: lengthKm > 0 ? clamp(progressKm / lengthKm, 0, 1) : 0,
    remainingRouteKm: lengthKm > 0 ? Math.max(lengthKm - progressKm, 0) : 0,
    actualDistanceKm: actual,
  };
}

/** 종료 시점의 tracker 상태 + GPS 가용 여부로 종료 사유를 정한다. 순수 함수 — 테스트/화면 공용. */
export function resolveEndReason(state: WalkProgressState, hasGps: boolean): WalkEndReason {
  if (state === 'complete') return 'destination_arrived';
  if (!hasGps) return 'gps_unavailable';
  return 'user_ended_before_destination';
}

interface Candidate {
  alongKm: number;
  distanceToRouteKm: number;
  /** 몇 번째 창에서 찾았는지. 0 = 기본 창(SEARCH_WINDOWS_KM[0]), 'global' = 전역 탐색. */
  foundVia: number | 'global';
}

/**
 * 산책 중 GPS 업데이트를 받을 때마다 호출해 진행률을 갱신하는 트래커. 인스턴스 하나가 산책 한 번
 * (WalkInProgressScreen 마운트 시점부터 종료까지)에 대응한다. WalkFlow의 walking 단계에서만 마운트되므로
 * prep 화면의 GPS fix는 여기 반영되지 않는다.
 *
 * 두 개의 앵커를 분리해서 든다:
 *  - lastValidFix   : 거부되지 않은 모든 GPS fix(경로 이탈 포함). actualDistanceKm 누적·점프 필터 기준.
 *  - matched 앵커   : 경로에 매칭 채택된 마지막 fix = (routeProgressKm, lastMatchedTimestampMs).
 *                     전진량 상한(maxForwardKm) 계산 기준.
 * → 경로에서 벗어나 정상적으로 걷는 동안 actualDistanceKm는 늘지만 routeProgressKm는 그대로다.
 *
 * 매 update가 하는 일: ① 완료 후 고정 ② 시간 역행 fix 폐기 ③ GPS 튐 폐기 ④ 유효 이동거리 누적
 * ⑤ 종착점 geofence ⑥ 창 확장 후보 탐색 + 검증(근접·전진량 상한·역행 금지) ⑦ 원거리 재매칭 연속 확인
 * ⑧ hysteresis 상태 전이 ⑨ 첫 위치 확정.
 */
export class WalkProgressTracker {
  private state: WalkProgressState = 'initializing';
  private routeProgressKm = 0;
  private actualDistanceKm = 0;

  private lastValidFixPoint: LatLon | null = null;
  private lastValidFixTimestampMs: number | null = null;
  private lastMatchedTimestampMs: number | null = null;

  private lastSeenTimestampMs: number | null = null;
  private initFixes: number[] = [];
  private consecutiveNearDestFixes = 0;
  private hasLeftDestinationArea = false;
  private pendingRematch: { alongKm: number; count: number } | null = null;
  // 완료 시점에 얼려서 이후 모든 update가 그대로 반환한다.
  private frozenComplete: WalkProgress | null = null;

  update(
    current: LatLon,
    route: WalkRouteResponse['coordinates'],
    routeLengthKm: number,
    nowMs: number = Date.now(),
    accuracyM?: number | null,
  ): WalkProgress {
    // 0) 완료 후에는 어떤 fix도 상태를 바꾸지 않는다 — 얼린 snapshot 그대로.
    if (this.state === 'complete' && this.frozenComplete) {
      return this.frozenComplete;
    }

    // 1) 시간 단조성 — 동일/과거 timestamp fix는 통째로 폐기(두 앵커·actualDistanceKm 불변).
    if (this.lastSeenTimestampMs != null && nowMs <= this.lastSeenTimestampMs) {
      return this.snapshot(routeLengthKm);
    }
    this.lastSeenTimestampMs = nowMs;

    // 2) GPS 튐 필터 — 직전 유효 fix 대비 도보 불가능 속도면 폐기(두 앵커·actualDistanceKm 불변).
    if (this.isImplausibleJump(current, nowMs)) {
      return this.snapshot(routeLengthKm);
    }

    // 3) 유효 fix — 경로 이탈 여부와 무관하게 실측 이동거리는 누적한다.
    if (this.lastValidFixPoint) {
      this.actualDistanceKm += haversineDistanceKm(this.lastValidFixPoint, current);
    }
    this.lastValidFixPoint = current;
    this.lastValidFixTimestampMs = nowMs;

    // 4) 동적 허용 반경.
    const accuracyKm = accuracyM != null && accuracyM > 0 ? accuracyM / 1000 : 0;
    const acceptRadiusKm = clamp(
      Math.max(BASE_ACCEPT_RADIUS_KM, accuracyKm * GPS_ACCURACY_MULTIPLIER),
      BASE_ACCEPT_RADIUS_KM,
      MAX_ACCEPT_RADIUS_KM,
    );
    const offRouteRadiusKm = clamp(
      Math.max(BASE_OFF_ROUTE_RADIUS_KM, acceptRadiusKm + OFF_ROUTE_HYSTERESIS_KM),
      BASE_OFF_ROUTE_RADIUS_KM,
      MAX_OFF_ROUTE_RADIUS_KM,
    );

    // 5) 종착점 geofence — initializing(첫 위치 확정 전)에는 검사 안 함. 그리고 종착점 영역을
    //    한 번 벗어난 뒤에야 카운트를 시작한다(순환 코스에서 시작점≈도착점이라 출발 직후 완료 방지).
    if (this.state !== 'initializing' && route.length > 0) {
      const destKm = haversineDistanceKm(current, route[route.length - 1]);
      if (destKm > DESTINATION_EXIT_RADIUS_KM) this.hasLeftDestinationArea = true;
      if (this.hasLeftDestinationArea && destKm <= DESTINATION_RADIUS_KM) {
        this.consecutiveNearDestFixes += 1;
        if (this.consecutiveNearDestFixes >= REQUIRED_DESTINATION_FIXES) {
          this.state = 'complete';
          this.routeProgressKm = routeLengthKm > 0 ? routeLengthKm : this.routeProgressKm;
          this.frozenComplete = this.snapshot(routeLengthKm);
          return this.frozenComplete;
        }
      } else if (destKm > DESTINATION_RADIUS_KM) {
        this.consecutiveNearDestFixes = 0;
      }
    }

    // 6) 후보 탐색 — 창을 넓혀가며, 마지막에 전역. 검증 3종을 통과한 첫 후보를 채택.
    const dtHours =
      this.lastMatchedTimestampMs != null
        ? Math.max(0, (nowMs - this.lastMatchedTimestampMs) / HOUR_MS)
        : 0;
    const maxForwardKm = MAX_PLAUSIBLE_SPEED_KMH * dtHours + GPS_NOISE_MARGIN_KM;
    // dt가 아무리 커도 이 전진량까지만 바로 신뢰한다 — 그 이상은 (긴 공백에서만 가능) 연속 확인 필요.
    const trustedForwardKm =
      MAX_PLAUSIBLE_SPEED_KMH * Math.min(dtHours, REMATCH_TRUSTED_GAP_HOURS) + GPS_NOISE_MARGIN_KM;

    // 홀더 객체 — 클로저에서 프로퍼티로 갱신해야 TS가 좁힘을 유지한다.
    const found: { accepted: Candidate | null; nearest: Candidate | null } = {
      accepted: null,
      nearest: null,
    };

    const consider = (
      raw: { distanceAlongRouteKm: number; distanceToRouteKm: number },
      via: number | 'global',
    ) => {
      const cand: Candidate = {
        alongKm: raw.distanceAlongRouteKm,
        distanceToRouteKm: raw.distanceToRouteKm,
        foundVia: via,
      };
      if (!found.nearest || cand.distanceToRouteKm < found.nearest.distanceToRouteKm) {
        found.nearest = cand;
      }
      if (found.accepted) return;
      const deltaKm = cand.alongKm - this.routeProgressKm;
      const isNearRoute = cand.distanceToRouteKm <= acceptRadiusKm;
      const isNotTooFarAhead = deltaKm <= maxForwardKm;
      const isNotMeaningfullyBacktracking = deltaKm >= -BACKTRACK_TOLERANCE_KM;
      if (isNearRoute && isNotTooFarAhead && isNotMeaningfullyBacktracking) {
        found.accepted = cand;
      }
    };

    for (let i = 0; i < SEARCH_WINDOWS_KM.length && !found.accepted; i++) {
      consider(
        projectOntoRoute(current, route, {
          centerKm: this.routeProgressKm,
          windowKm: SEARCH_WINDOWS_KM[i],
        }),
        i,
      );
    }
    if (!found.accepted) consider(projectOntoRoute(current, route), 'global');

    const acc = found.accepted;
    const near = found.nearest;

    // 7) 첫 위치 확정.
    if (this.state === 'initializing') {
      return this.handleInitializing(near, acceptRadiusKm, routeLengthKm);
    }

    // 8) 기본 창 밖에서 찾은 후보가 믿을 수 있는 전진량을 넘게 앞서 있으면 연속 확인 후에만 확정한다.
    if (acc && acc.foundVia !== 0 && acc.alongKm - this.routeProgressKm > trustedForwardKm) {
      return this.handlePendingRematch(acc, nowMs, routeLengthKm);
    }

    // 9) hysteresis 상태 전이.
    if (acc) {
      this.pendingRematch = null;
      this.commitMatch(acc, nowMs);
      this.state = 'tracking';
    } else if (near && near.distanceToRouteKm <= offRouteRadiusKm) {
      this.state = 'uncertain';
    } else {
      this.state = 'off_route';
    }
    return this.snapshot(routeLengthKm);
  }

  private snapshot(routeLengthKm: number): WalkProgress {
    return deriveProgress(this.routeProgressKm, routeLengthKm, this.state, this.actualDistanceKm);
  }

  // --- 개발용(__DEV__ 전용) — GPS 없이 상태를 강제해 화면을 확인하기 위한 것. 호출부에서 __DEV__ 가드. ---

  /** 경로 진행률을 특정 km로 강제한다(속도·재매칭 필터 우회). */
  devSeek(km: number, routeLengthKm: number): WalkProgress {
    const capped = routeLengthKm > 0 ? Math.min(km, routeLengthKm) : km;
    this.routeProgressKm = Math.max(0, capped);
    this.actualDistanceKm = this.routeProgressKm;
    this.state = 'tracking';
    this.pendingRematch = null;
    this.hasLeftDestinationArea = true;
    this.lastMatchedTimestampMs = Date.now();
    return this.snapshot(routeLengthKm);
  }

  /** 종착점 도착 완료를 강제한다(이후 얼린 snapshot 고정). */
  devComplete(routeLengthKm: number): WalkProgress {
    this.state = 'complete';
    this.routeProgressKm = routeLengthKm > 0 ? routeLengthKm : this.routeProgressKm;
    this.actualDistanceKm = Math.max(this.actualDistanceKm, this.routeProgressKm);
    this.frozenComplete = this.snapshot(routeLengthKm);
    return this.frozenComplete;
  }

  /** 경로 이탈 상태로 만든다(진행률 유지). */
  devOffRoute(routeLengthKm: number): WalkProgress {
    if (this.state !== 'complete') this.state = 'off_route';
    return this.snapshot(routeLengthKm);
  }

  /** 트래커를 초기 상태로 되돌린다. */
  devReset(routeLengthKm: number): WalkProgress {
    this.state = 'initializing';
    this.routeProgressKm = 0;
    this.actualDistanceKm = 0;
    this.lastValidFixPoint = null;
    this.lastValidFixTimestampMs = null;
    this.lastMatchedTimestampMs = null;
    this.lastSeenTimestampMs = null;
    this.initFixes = [];
    this.consecutiveNearDestFixes = 0;
    this.hasLeftDestinationArea = false;
    this.pendingRematch = null;
    this.frozenComplete = null;
    return this.snapshot(routeLengthKm);
  }

  private isImplausibleJump(current: LatLon, nowMs: number): boolean {
    if (!this.lastValidFixPoint || this.lastValidFixTimestampMs == null) return false;
    const dtHours = (nowMs - this.lastValidFixTimestampMs) / HOUR_MS;
    if (dtHours <= 0) return true; // 시간이 안 흘렀는데 위치가 바뀜 → 신뢰 불가
    const jumpKm = haversineDistanceKm(this.lastValidFixPoint, current);
    return jumpKm / dtHours > MAX_PLAUSIBLE_SPEED_KMH;
  }

  private commitMatch(cand: Candidate, nowMs: number): void {
    this.routeProgressKm = Math.max(cand.alongKm, this.routeProgressKm);
    this.lastMatchedTimestampMs = nowMs;
  }

  private handlePendingRematch(
    cand: Candidate,
    nowMs: number,
    routeLengthKm: number,
  ): WalkProgress {
    if (
      this.pendingRematch &&
      Math.abs(cand.alongKm - this.pendingRematch.alongKm) <= REMATCH_CLUSTER_KM
    ) {
      this.pendingRematch.count += 1;
      this.pendingRematch.alongKm = cand.alongKm;
    } else {
      this.pendingRematch = { alongKm: cand.alongKm, count: 1 };
    }

    if (this.pendingRematch.count >= REQUIRED_REMATCH_FIXES) {
      this.commitMatch(cand, nowMs);
      this.pendingRematch = null;
      this.state = 'tracking';
    } else {
      this.state = 'uncertain';
    }
    return this.snapshot(routeLengthKm);
  }

  private handleInitializing(
    nearest: Candidate | null,
    acceptRadiusKm: number,
    routeLengthKm: number,
  ): WalkProgress {
    // 경로 근처(accept 반경)가 아니면 아직 산책이 경로 위에서 시작되지 않았다 — 진행률 0 유지.
    if (!nearest || nearest.distanceToRouteKm > acceptRadiusKm) {
      this.initFixes = [];
      return this.snapshot(routeLengthKm);
    }

    const alongKm = nearest.alongKm;

    // 시작점 근처면 바로 tracking(정상적인 산책 시작). 순환 코스에서 첫 fix가 도착점 쪽으로 잘못
    // 잡히는 건 위 후보 탐색이 routeProgressKm(=0) 근처 창을 우선 보므로 걸러진다.
    if (alongKm <= INIT_NEAR_START_KM) {
      this.promoteToTracking(Math.max(alongKm, 0));
      return this.snapshot(routeLengthKm);
    }

    // 경로 중간에서 시작(앱 재시작 등) — 일관된 fix가 모여야 그 위치를 채택한다.
    this.initFixes = [...this.initFixes, alongKm].slice(-REQUIRED_INIT_FIXES);
    if (
      this.initFixes.length >= REQUIRED_INIT_FIXES &&
      Math.max(...this.initFixes) - Math.min(...this.initFixes) <= INIT_CONSISTENCY_KM
    ) {
      this.promoteToTracking(alongKm);
    }
    return this.snapshot(routeLengthKm);
  }

  private promoteToTracking(alongKm: number): void {
    this.routeProgressKm = alongKm;
    this.lastMatchedTimestampMs = this.lastValidFixTimestampMs;
    this.state = 'tracking';
    this.initFixes = [];
  }
}
