import { env } from '../config/env';

/** Google Polyline Algorithm(precision 5)로 [lat, lon] 좌표열을 인코딩한다(Mapbox Static Images path overlay용). */
function encodePolyline(points: [number, number][]): string {
  let result = '';
  let prevLat = 0;
  let prevLon = 0;
  for (const [lat, lon] of points) {
    const lat5 = Math.round(lat * 1e5);
    const lon5 = Math.round(lon * 1e5);
    result += encodeSignedNumber(lat5 - prevLat) + encodeSignedNumber(lon5 - prevLon);
    prevLat = lat5;
    prevLon = lon5;
  }
  return result;
}

function encodeSignedNumber(num: number): string {
  let sgn = num << 1;
  if (num < 0) sgn = ~sgn;
  return encodeNumber(sgn);
}

function encodeNumber(num: number): string {
  let encoded = '';
  let n = num;
  while (n >= 0x20) {
    encoded += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  encoded += String.fromCharCode(n + 63);
  return encoded;
}

// Mapbox Studio에서 라벨 레이어를 지운 커스텀 스타일 (기록 카드 썸네일 전용, 글자 없음)
const THUMBNAIL_STYLE_USERNAME = 'kuty2004';
const THUMBNAIL_STYLE_ID = 'cmrw0ecps003b01ss3khn6csv';

/**
 * 실제 산책 경로 좌표로 작은 지도 썸네일 URL을 만든다(기록 카드용).
 * 위 커스텀 스타일을 쓰므로 지명/도로명 글자가 없다.
 * 좌표가 너무 많으면 URL 길이 제한에 걸리므로 최대 30개 점으로 샘플링한다.
 * 토큰이 없거나 좌표가 비어있으면 null을 반환한다.
 */
export function buildRouteThumbnailUrl(coordinates: number[][], size = 56): string | null {
  if (!coordinates.length || !env.MAPBOX_PUBLIC_ACCESS_TOKEN) return null;

  const maxPoints = 30;
  const step = Math.max(1, Math.floor(coordinates.length / maxPoints));
  const sampled = coordinates
    .filter((_, i) => i % step === 0)
    .map(([lat, lon]) => [lat, lon] as [number, number]);
  const encoded = encodePolyline(sampled);
  // RouteLayer.tsx의 실제 산책 경로 안내 색상(#4A90E2)과 통일
  const overlay = `path-3+4A90E2-0.9(${encodeURIComponent(encoded)})`;

  return (
    `https://api.mapbox.com/styles/v1/${THUMBNAIL_STYLE_USERNAME}/${THUMBNAIL_STYLE_ID}/static/${overlay}/auto/${size}x${size}@2x` +
    `?padding=4&attribution=false&logo=false&access_token=${env.MAPBOX_PUBLIC_ACCESS_TOKEN}`
  );
}
