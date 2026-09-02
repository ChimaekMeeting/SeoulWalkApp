/* 산책 종료(6b→6c) 시점에 넘기는 스냅샷. */
export interface WalkEndSnapshot {
  traveledKm: number;
  elapsedMs: number;
  /** 만보계로 실시간 측정한 걸음 수. 기기에서 만보계를 못 쓰면 null(호출부에서 거리 기반 추정치로 대체). */
  steps: number | null;
}

/**
 * 산책 플로우를 빠져나와 홈으로 돌아가는 사유. 챗봇 세션을 리셋할지 판단하는 데 쓴다.
 *  - cancelled_before_start : prep 단계에서 취소 — 실제 걷기 전이라 기존 대화를 유지한다.
 *  - ended_early             : 걷기 시작 후 목표 전에 종료 — 새 prewalk 세션을 준비한다.
 *  - completed               : 정상 산책 완료 — 새 prewalk 세션을 준비한다.
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
