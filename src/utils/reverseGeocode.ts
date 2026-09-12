import { env } from '../config/env';

const cache = new Map<string, string | null>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * 이미 이번 세션에 조회한 좌표면 네트워크 없이 동기로 즉시 값을 돌려준다(없으면 undefined).
 * 컴포넌트가 useState 초기값으로 이걸 읽으면 캐시 히트일 때 첫 렌더부터 이름이 채워져 있어
 * "빈 화면 → 채워짐" 깜빡임이 없다 — reverseGeocodePlaceName은 useEffect 안에서만 캐시를
 * 확인해서 캐시가 있어도 항상 한 번은 빈 상태로 그려진 뒤에야 갱신되는 문제가 있었다.
 */
export function peekCachedPlaceName(lat: number, lon: number): string | null | undefined {
  return cache.get(cacheKey(lat, lon));
}

/**
 * Mapbox Geocoding API로 좌표를 대략적인 장소명(동/공원 등)으로 변환한다.
 * 같은 좌표(소수점 3자리 반올림)는 캐시해서 재요청하지 않는다. 실패 시 null.
 */
export async function reverseGeocodePlaceName(lat: number, lon: number): Promise<string | null> {
  const key = cacheKey(lat, lon);
  if (cache.has(key)) return cache.get(key) ?? null;
  if (!env.MAPBOX_PUBLIC_ACCESS_TOKEN) return null;

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json` +
      `?access_token=${env.MAPBOX_PUBLIC_ACCESS_TOKEN}&language=ko&types=neighborhood,poi,place&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const name: string | null = data?.features?.[0]?.text ?? null;
    cache.set(key, name);
    return name;
  } catch {
    cache.set(key, null);
    return null;
  }
}
