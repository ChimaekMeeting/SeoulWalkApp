/**
 * 산책 종료 사유. 종착점 geofence 도달 여부와 GPS 가용성으로 정한다(진행률 숫자와 독립).
 * 현재는 destination_arrived / user_ended_before_destination 두 값만 실제로 세팅한다.
 * TODO: gps_unavailable(위치 권한 해제·장시간 fix 없음), app_interrupted(강제종료 복구)도 배선.
 */
export type WalkEndReason =
  | 'destination_arrived'
  | 'user_ended_before_destination'
  | 'gps_unavailable'
  | 'app_interrupted';

/* 산책 종료(6b→6c) 시점에 넘기는 스냅샷. */
export interface WalkEndSnapshot {
  /** 경로 시작점부터 신뢰 가능한 투영점까지의 누적 거리(km) — 화면 진행률의 분자. */
  routeProgressKm: number;
  routeProgressRatio: number;
  remainingRouteKm: number;
  /** 거부되지 않은 GPS fix 사이 실측 이동거리 누적(km). 경로를 벗어나 걸은 구간도 포함 — 참고값. */
  actualDistanceKm: number;
  elapsedMs: number;
  /** 만보계로 실시간 측정한 걸음 수. 기기에서 만보계를 못 쓰면 null(호출부에서 거리 기반 추정치로 대체). */
  steps: number | null;
  endReason: WalkEndReason;
}

/**
 * 산책 플로우를 빠져나와 홈으로 돌아가는 사유. 챗봇 세션을 리셋할지 판단하는 데 쓴다.
 *  - cancelled_before_start : prep 단계에서 취소 — 실제 걷기 전이라 기존 대화를 유지한다.
 *  - ended_early             : 걷기 시작 후 종착점 도착 전에 종료 — 새 prewalk 세션을 준비한다.
 *  - completed               : 종착점 도착으로 완료 — 새 prewalk 세션을 준비한다.
 */
export type WalkExitReason =
  | 'cancelled_before_start'
  | 'ended_early'
  | 'completed';

export interface WalkExitEvent {
  reason: WalkExitReason;
  /** 실제 walking 단계에 진입했는지. true면 산책 시간과 무관하게 세션을 리셋한다. */
  actualWalkingStarted: boolean;
  /** 걷기 시작~종료 실측 시간(ms). 통계·UI 용도. */
  elapsedMs?: number;
}

/**
 * 산책 완료 후 사용자가 코스에 매기는 별점(각 1~5). 완료 화면(6d) 다음의 별점 화면(6e)에서 수집한다.
 * TODO: 서버 전송 엔드포인트가 정해지면 배선한다 — 현재는 WalkFlow에서 로컬 로깅만.
 */
export interface WalkRatings {
  /** 자연을 가까이 느끼며 걸을 수 있어 좋았는지 */
  nature: number;
  /** 걷는 내내 안전하다고 느껴 좋았는지 */
  safety: number;
  /** 몸도 마음도 편하게 걸을 수 있어 좋았는지 */
  comfort: number;
  /** 산책로 전체 만족도 */
  overall: number;
}
