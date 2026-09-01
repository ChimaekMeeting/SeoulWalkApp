import { WalkRouteResponse } from '../types/prewalk';
import { haversineDistanceKm, projectOntoRoute } from './geo';

// 거리/투영 계산은 지도 레이어(RouteEndpointMarkers 등)와 공유하려고 geo.ts로 옮겼다.
// haversineDistanceKm는 이 파일 경로로 import하던 테스트가 안 깨지도록 계속 재노출한다.
export { haversineDistanceKm };

// 이 거리보다 경로에서 멀리 떨어져 있으면(GPS 오차 범위를 넘어 다른 길을 걷는 것으로 보고)
// 이번 측정치는 진행률에 반영하지 않는다.
const OFF_ROUTE_THRESHOLD_KM = 0.05; // 50m

// 도보 기준으로 낼 수 없는 속도(직전 GPS 지점 대비). 이보다 빠르면 GPS가 순간적으로 튄 것으로
// 보고 이번 측정치 자체를 무시한다. 뛰는 사용자까지 감안해 넉넉하게 잡음.
const MAX_PLAUSIBLE_SPEED_KMH = 15;

// 직전 매칭 지점 기준 이 범위(±) 안에서만 다음 매칭을 우선 찾는다. 순환 코스에서 경로가 자기
// 자신과 가까운 구간(출발점≈도착점 등)에 잘못 매칭되는 걸 막기 위함 — 다만 GPS 신호가 잠깐
// 끊겼다 멀리서 다시 잡히는 정상적인 경우까지 막지 않도록, 이 범위 안에서 못 찾으면 전체
// 경로에서 다시 찾는 폴백을 둔다.
const MATCH_WINDOW_KM = 0.15; // 150m

export interface WalkProgress {
  traveledKm: number;
  remainingKm: number;
  progressRatio: number;
}

/**
 * traveledKm 하나로부터 remainingKm/progressRatio를 유도한다. GPS fix를 아직 못 받았을 때(예:
 * WalkInProgressScreen 마운트 직후)도 같은 공식을 쓰도록 별도로 내보낸다.
 */
export function deriveProgress(traveledKm: number, totalKm: number): WalkProgress {
  const clampedTraveledKm = Math.min(traveledKm, totalKm);
  return {
    traveledKm: clampedTraveledKm,
    remainingKm: Math.max(totalKm - clampedTraveledKm, 0),
    progressRatio: totalKm > 0 ? Math.min(clampedTraveledKm / totalKm, 1) : 0,
  };
}

/**
 * 산책 중 GPS 업데이트를 받을 때마다 호출해서 진행률을 갱신하는 트래커. 인스턴스 하나가
 * 산책 한 번(WalkInProgressScreen 마운트 시점부터 종료까지)에 대응한다.
 *
 * 순수 함수였던 이전 calculateWalkProgress와 달리 상태(누적 거리·직전 GPS 지점/시각)를
 * 인스턴스가 직접 들고 있다 — 매 업데이트마다 이 상태들을 참고해야 아래 세 가지를 할 수
 * 있기 때문이다:
 *   1) GPS 튐 필터링: 직전 지점 대비 속도가 도보로 말이 안 되면 이번 값을 버림
 *   2) 경로 이탈 시 갱신 보류: 벗어난 상태에서의 "가장 가까운 점" 매칭은 신뢰할 수 없다
 *      (엉뚱하게 경로의 뒤쪽 구간과 가까울 수 있음) — 그걸 그대로 반영하면 실제로 안 걸은
 *      구간까지 진행한 것처럼 부풀려지고, 그 뒤 진짜 경로로 복귀해 정상적으로 걸어도
 *      역행 방지(아래 3번)에 막혀 진행률이 하나도 안 올라가는 버그가 생긴다. 그래서 이탈
 *      중엔 갱신을 아예 보류하고, 경로로 돌아왔을 때의 위치만 신뢰한다.
 *   3) 역행 방지: 경로를 계속 따라가는 도중 GPS 오차로 약간 뒤처진 지점에 매칭돼도
 *      진행률이 뒤로 가지 않도록, 지금까지의 최댓값 아래로는 안 내려가게 한다.
 *   (그리고 이 최댓값 계산에 순환 코스 자기교차 대응을 위해 직전 매칭 지점 근처를
 *   우선 탐색하는 윈도우 매칭도 함께 쓴다.)
 */
export class WalkProgressTracker {
  private traveledKm = 0;
  private lastPoint: [number, number] | null = null;
  private lastPointAtMs: number | null = null;

  update(
    current: [number, number],
    route: WalkRouteResponse['coordinates'],
    totalKm: number,
    nowMs: number = Date.now(),
  ): WalkProgress {
    if (this.isImplausibleJump(current, nowMs)) {
      // 이번 GPS 값은 버리고 직전 상태 그대로 반환 — lastPoint/lastPointAtMs도 갱신하지 않는다.
      return deriveProgress(this.traveledKm, totalKm);
    }
    this.lastPoint = current;
    this.lastPointAtMs = nowMs;

    // 직전 매칭 지점(traveledKm, 초기값 0) 근처를 먼저 찾고, 거기서 마땅한 후보가 없으면
    // (경로에서 너무 멀면) 전체 경로에서 다시 찾는다. 첫 업데이트도 예외 없이 0km 근처로
    // 윈도우를 건다 — 산책은 항상 경로 시작점에서 시작하므로, 순환 코스처럼 시작점과 도착점이
    // 지리적으로 가까운 경우 첫 GPS 값이 도착점 쪽에 잘못 매칭되는 걸 막기 위함이다.
    let match = projectOntoRoute(current, route, {
      centerKm: this.traveledKm,
      windowKm: MATCH_WINDOW_KM,
    });
    if (match.distanceToRouteKm > OFF_ROUTE_THRESHOLD_KM) {
      match = projectOntoRoute(current, route);
    }

    // 경로 위에 있을 때만 갱신한다. 이탈 중인 측정치는(한 번이든 여러 번이든) 신뢰할 수 없어서
    // 아예 반영하지 않는다 — 다시 경로로 돌아왔을 때의 위치만 기준으로 삼는다.
    if (match.distanceToRouteKm <= OFF_ROUTE_THRESHOLD_KM) {
      this.traveledKm = Math.max(match.distanceAlongRouteKm, this.traveledKm);
    }

    return deriveProgress(this.traveledKm, totalKm);
  }

  private isImplausibleJump(current: [number, number], nowMs: number): boolean {
    if (!this.lastPoint || this.lastPointAtMs == null) return false;
    const dtHours = (nowMs - this.lastPointAtMs) / 1000 / 60 / 60;
    if (dtHours <= 0) return false;
    const jumpKm = haversineDistanceKm(this.lastPoint, current);
    return jumpKm / dtHours > MAX_PLAUSIBLE_SPEED_KMH;
  }
}
