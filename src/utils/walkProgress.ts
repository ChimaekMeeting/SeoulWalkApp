import { WalkRouteResponse } from '../types/prewalk';

const EARTH_RADIUS_KM = 6371;

/** [lat, lon] 두 점 사이의 대권거리(km). */
export function haversineDistanceKm(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(rLat1) * Math.cos(rLat2) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * current를 route 폴리라인의 각 구간에 투영해 가장 가까운 지점을 찾고,
 * 경로 시작점부터 그 지점까지의 누적 거리를 반환한다.
 * 두 점짜리 구간은 등속 보간(선형)으로 투영 지점을 근사한다.
 */
export function projectOntoRoute(
  current: [number, number],
  route: WalkRouteResponse['coordinates'],
): { distanceAlongRouteKm: number } {
  if (route.length === 0) return { distanceAlongRouteKm: 0 };
  if (route.length === 1) return { distanceAlongRouteKm: 0 };

  let cumulativeKm = 0;
  let bestDistanceAlongRouteKm = 0;
  let bestDistanceToRouteKm = Infinity;

  for (let i = 0; i < route.length - 1; i++) {
    const segStart = route[i];
    const segEnd = route[i + 1];
    const segLengthKm = haversineDistanceKm(segStart, segEnd);

    // 세그먼트 위 투영 비율 t(0~1)를 위도/경도 평면상의 벡터 투영으로 근사.
    const [lat1, lon1] = segStart;
    const [lat2, lon2] = segEnd;
    const [latC, lonC] = current;

    const dx = lon2 - lon1;
    const dy = lat2 - lat1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((lonC - lon1) * dx + (latC - lat1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projected: [number, number] = [lat1 + t * dy, lon1 + t * dx];
    const distanceToRouteKm = haversineDistanceKm(current, projected);

    if (distanceToRouteKm < bestDistanceToRouteKm) {
      bestDistanceToRouteKm = distanceToRouteKm;
      bestDistanceAlongRouteKm = cumulativeKm + t * segLengthKm;
    }

    cumulativeKm += segLengthKm;
  }

  return { distanceAlongRouteKm: bestDistanceAlongRouteKm };
}

export interface WalkProgress {
  traveledKm: number;
  remainingKm: number;
  progressRatio: number;
}

/** 현재 GPS 위치와 계획 경로를 비교해 진행률을 계산한다. */
export function calculateWalkProgress(
  current: [number, number],
  route: WalkRouteResponse['coordinates'],
  totalKm: number,
): WalkProgress {
  const { distanceAlongRouteKm } = projectOntoRoute(current, route);
  const traveledKm = Math.min(distanceAlongRouteKm, totalKm);
  const remainingKm = Math.max(totalKm - traveledKm, 0);
  const progressRatio = totalKm > 0 ? Math.min(traveledKm / totalKm, 1) : 0;

  return { traveledKm, remainingKm, progressRatio };
}
