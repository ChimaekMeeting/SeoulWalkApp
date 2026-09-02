import { env } from '../config/env';
import { haversineDistanceKm, polylineLengthKm, segmentProjection } from './geo';
import type { WalkRouteResponse } from '../types/prewalk';

// 백엔드는 그래프 노드 좌표만 내려주고 프론트가 그걸 직선으로 이어 그린다 —
// 간선(노드 사이 도로) 형상이 빠져 있어 곡선 골목이 직선 현으로 그려지고, 건물을 뚫거나
// 도로를 가로지른다. 정식 해결은 백엔드가 간선 형상까지 반환하는 것이고, 이 모듈은 그 전까지의
// 임시방편이다: Mapbox Map Matching(보행 프로파일)으로 노드열을 도로에 스냅하되,
// "구간(leg)별로" 신뢰도·우회 정도·스냅 이동거리를 검사해서 통과한 구간만 매칭 결과로 바꾸고
// 나머지(공원 샛길처럼 Mapbox 보행망에 없는 길 등)는 백엔드 원본 직선을 그대로 둔다.

type LatLon = [number, number]; // [위도, 경도] — 앱 전역 규약(WalkRouteResponse.coordinates와 동일)

// --- 튜닝 상수 -----------------------------------------------------------------
// Mapbox Map Matching 좌표 상한은 요청당 100개. 여유를 두고 자르고, 청크 경계 노드는
// 다음 청크와 1개 겹쳐 이어 붙인다.
const CHUNK_SIZE = 90;
// 각 노드를 이 반경(m) 안의 도로에 매칭 시도. 너무 크면 엉뚱한 평행 도로에 붙고, 너무 작으면
// (기본 5m) 정상 노드도 매칭에 실패한다. 실패한 노드가 낀 구간은 자동으로 원본 직선으로 폴백된다.
const MATCH_RADIUS_M = 14;
const REQUEST_TIMEOUT_MS = 5000;

// --- 구간 채택 기준(하나라도 어기면 그 구간은 백엔드 원본 직선 유지) --------------
// Mapbox의 confidence는 "매칭 전체(trace)" 단위 점수라, 같은 길이라도 긴 경로에선 높고 짧은
// 경로에선 낮게 나온다(구간별 품질 신호로는 부적절). 그래서 여기선 명백한 쓰레기 매칭만
// 걸러내는 낮은 바닥값으로만 쓰고, 실제 채택 여부는 구간별 기하 검사(스냅 거리·측방 이탈·우회)로 판단한다.
const MIN_CONFIDENCE = 0.05;
const MAX_SNAP_KM = 0.02; // Mapbox가 노드를 도로에 붙이려고 옮긴 거리(20m) 상한 — 넘으면 그 길은 보행망에 없다고 본다
const MAX_LATERAL_DEV_KM = 0.025; // 매칭 형상이 원본 직선에서 옆으로 벗어난 최대 거리(25m) — 넘으면 다른 길로 우회한 것
const MAX_DETOUR_RATIO = 1.7; // 매칭 경로가 원본 직선의 몇 배까지 길어져도 되는지
const MAX_DETOUR_ABS_KM = 0.03; // 짧은 구간에서 비율만으로 과민 반응하지 않도록 더하는 절대 여유

interface MatchedLeg {
  from: number; // 원본 coords 인덱스(구간 시작 노드)
  to: number; // 원본 coords 인덱스(구간 끝 노드)
  geom: LatLon[]; // 도로에 스냅된 구간 형상
  matchedKm: number;
  confidence: number;
  snapKm: number; // from/to 두 노드의 스냅 이동거리 중 큰 값
  maxDevKm: number; // 매칭 형상 각 점이 원본 직선(from→to)에서 옆으로 벗어난 최대 거리
}

interface MapboxTracepoint {
  matchings_index: number;
  waypoint_index: number;
  location: [number, number]; // [경도, 위도]
}

interface MapboxMatchResponse {
  code: string;
  matchings?: {
    confidence?: number;
    legs?: { distance?: number; steps?: { geometry?: { coordinates?: [number, number][] } }[] }[];
  }[];
  tracepoints?: (MapboxTracepoint | null)[];
}

const cache = new Map<string, LatLon[]>();

function cacheKey(coords: LatLon[]): string {
  const a = coords[0];
  const z = coords[coords.length - 1];
  return `${coords.length}:${a[0].toFixed(5)},${a[1].toFixed(5)}:${z[0].toFixed(5)},${z[1].toFixed(5)}`;
}

/** 매칭 형상 geom의 각 점이 직선 a→b에서 옆으로 벗어난 최대 거리(km). */
function maxDeviationKm(geom: LatLon[], a: LatLon, b: LatLon): number {
  let max = 0;
  for (const pt of geom) max = Math.max(max, segmentProjection(pt, a, b).distanceKm);
  return max;
}

/** 한 leg의 step 형상들을 이어 붙여 [위도, 경도] 좌표열로 만든다(step 경계의 중복점은 제거). */
function legGeometry(leg: { steps?: { geometry?: { coordinates?: [number, number][] } }[] }): LatLon[] {
  const out: LatLon[] = [];
  for (const step of leg.steps ?? []) {
    for (const [lon, lat] of step.geometry?.coordinates ?? []) {
      const last = out[out.length - 1];
      if (!last || last[0] !== lat || last[1] !== lon) out.push([lat, lon]);
    }
  }
  return out;
}

function extractLegs(
  chunk: LatLon[],
  offset: number,
  data: MapboxMatchResponse,
): MatchedLeg[] {
  const tracepoints = data.tracepoints ?? [];
  const legs: MatchedLeg[] = [];

  (data.matchings ?? []).forEach((matching, mi) => {
    // 이 matching에 속한 입력 노드들을 waypoint_index → 노드정보로.
    const byWaypoint = new Map<number, { i: number; loc: [number, number] }>();
    tracepoints.forEach((tp, i) => {
      if (tp && tp.matchings_index === mi) byWaypoint.set(tp.waypoint_index, { i, loc: tp.location });
    });

    const mLegs = matching.legs ?? [];
    for (let j = 0; j < mLegs.length; j++) {
      const a = byWaypoint.get(j);
      const b = byWaypoint.get(j + 1);
      if (!a || !b || b.i <= a.i) continue;
      const geom = legGeometry(mLegs[j]);
      if (geom.length < 2) continue;
      const snapA = haversineDistanceKm(chunk[a.i], [a.loc[1], a.loc[0]]);
      const snapB = haversineDistanceKm(chunk[b.i], [b.loc[1], b.loc[0]]);
      legs.push({
        from: offset + a.i,
        to: offset + b.i,
        geom,
        matchedKm: (mLegs[j].distance ?? 0) / 1000,
        confidence: matching.confidence ?? 0,
        snapKm: Math.max(snapA, snapB),
        maxDevKm: maxDeviationKm(geom, chunk[a.i], chunk[b.i]),
      });
    }
  });

  return legs;
}

async function matchChunk(chunk: LatLon[], offset: number, token: string): Promise<MatchedLeg[]> {
  const coordStr = chunk.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const radiuses = chunk.map(() => MATCH_RADIUS_M).join(';');
  const url =
    `https://api.mapbox.com/matching/v5/mapbox/walking/${coordStr}` +
    `?geometries=geojson&overview=false&steps=true&tidy=false` +
    `&radiuses=${radiuses}&access_token=${token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as MapboxMatchResponse;
    if (data.code !== 'Ok') return [];
    return extractLegs(chunk, offset, data);
  } catch {
    return []; // 네트워크 실패·타임아웃 → 이 청크는 원본 직선으로 폴백
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 매칭된 구간들을 원본 노드열 위에 병합한다. 채택 기준을 통과한 구간만 스냅 형상으로 바꾸고,
 * 나머지(매칭 실패/우회 과다/스냅 과다)는 원본 노드 사이 직선을 유지한다. 순수 함수 — 테스트용.
 */
function legAcceptable(leg: MatchedLeg, raw: LatLon[]): boolean {
  const straightKm = polylineLengthKm(raw.slice(leg.from, leg.to + 1));
  return (
    leg.confidence >= MIN_CONFIDENCE &&
    leg.snapKm <= MAX_SNAP_KM &&
    leg.maxDevKm <= MAX_LATERAL_DEV_KM &&
    leg.matchedKm <= straightKm * MAX_DETOUR_RATIO + MAX_DETOUR_ABS_KM
  );
}

export function mergeMatchedRoute(raw: LatLon[], legs: MatchedLeg[]): LatLon[] {
  if (raw.length < 2) return raw;

  const ordered = [...legs].sort((a, b) => a.from - b.from || a.to - b.to);
  const out: LatLon[] = [raw[0]];
  let cursor = 0;

  for (const leg of ordered) {
    if (leg.from < cursor || leg.to > raw.length - 1) continue; // 청크 겹침으로 이미 지난 구간
    // 매칭 안 된 노드 구간은 원본 직선으로 메운다.
    for (let k = cursor + 1; k <= leg.from; k++) out.push(raw[k]);

    if (legAcceptable(leg, raw)) {
      for (let k = 1; k < leg.geom.length; k++) out.push(leg.geom[k]);
    } else {
      for (let k = leg.from + 1; k <= leg.to; k++) out.push(raw[k]);
    }
    cursor = leg.to;
  }

  for (let k = cursor + 1; k < raw.length; k++) out.push(raw[k]);
  return out;
}

/**
 * 백엔드 경로 좌표열([위도, 경도])을 도로에 스냅한 좌표열로 바꾼다. 토큰이 없거나 좌표가
 * 2개 미만이면, 또는 매칭이 하나도 성립하지 않으면 입력을 그대로 돌려준다(참조 동일).
 */
export async function snapRouteToWalkways(coords: LatLon[]): Promise<LatLon[]> {
  if (!Array.isArray(coords) || coords.length < 2 || !env.MAPBOX_PUBLIC_ACCESS_TOKEN) {
    return coords;
  }

  const key = cacheKey(coords);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const token = env.MAPBOX_PUBLIC_ACCESS_TOKEN;
    const requests: Promise<MatchedLeg[]>[] = [];
    for (let start = 0; start < coords.length - 1; start += CHUNK_SIZE - 1) {
      const chunk = coords.slice(start, start + CHUNK_SIZE);
      if (chunk.length < 2) break;
      requests.push(matchChunk(chunk, start, token));
    }

    const legs = (await Promise.all(requests)).flat();
    const merged = legs.length > 0 ? mergeMatchedRoute(coords, legs) : coords;
    cache.set(key, merged);
    return merged;
  } catch {
    return coords;
  }
}

/** WalkRouteResponse의 coordinates만 스냅 결과로 교체한다(total_km 등 백엔드 값은 유지). */
export async function snapWalkRoute(route: WalkRouteResponse): Promise<WalkRouteResponse> {
  const coordinates = await snapRouteToWalkways(route.coordinates as LatLon[]);
  return coordinates === route.coordinates ? route : { ...route, coordinates };
}
