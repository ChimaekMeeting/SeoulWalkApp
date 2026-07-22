import { env } from '../config/env';

const cache = new Map<string, string | null>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
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
