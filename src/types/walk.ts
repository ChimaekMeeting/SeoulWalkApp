/* 산책 종료(6b→6c) 시점에 넘기는 스냅샷. */
export interface WalkEndSnapshot {
  traveledKm: number;
  elapsedMs: number;
  /** 만보계로 실시간 측정한 걸음 수. 기기에서 만보계를 못 쓰면 null(호출부에서 거리 기반 추정치로 대체). */
  steps: number | null;
}
