/**
 * 백엔드가 내려주지 않는 소요시간/칼로리/걸음수 추정치.
 * 상수는 평균적인 성인 보행 기준의 러프한 근사값 — 실측 데이터가 생기면 조정한다.
 */
const AVG_WALK_SPEED_KMH = 4.3;
const KCAL_PER_KM = 65;
const AVG_STRIDE_METERS = 0.7;

export function estimateDurationMinutes(km: number): number {
  return Math.round((km / AVG_WALK_SPEED_KMH) * 60);
}

export function estimateKcal(km: number): number {
  return Math.round(km * KCAL_PER_KM);
}

export function estimateSteps(km: number): number {
  return Math.round((km * 1000) / AVG_STRIDE_METERS);
}
