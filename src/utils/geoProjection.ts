import mockRoute from '../data/mockRoute.json';

/**
 * Calculates the exact GPS coordinate along the mock route given a progress percentage.
 * @param progress 0.0 to 1.0
 * @returns [longitude, latitude]
 */
export function getCoordinateAlongRoute(progress: number): [number, number] {
  const coordinates = mockRoute.features[0].geometry.coordinates as [number, number][];
  
  if (coordinates.length === 0) return [126.9780, 37.5665]; // Fallback to Seoul City Hall
  if (progress <= 0) return coordinates[0];
  if (progress >= 1) return coordinates[coordinates.length - 1];

  // Note: For a real app, distance-based interpolation (using haversine) is better.
  // For this MVP, we use simple index-based linear interpolation.
  const totalSegments = coordinates.length - 1;
  const exactSegment = progress * totalSegments;
  const index = Math.floor(exactSegment);
  const remainder = exactSegment - index;

  const start = coordinates[index];
  const end = coordinates[index + 1];

  if (!end) return start;

  const lng = start[0] + (end[0] - start[0]) * remainder;
  const lat = start[1] + (end[1] - start[1]) * remainder;

  return [lng, lat];
}

/**
 * TODO: [Phase 4 Extension] 
 * Implement Spherical Mercator conversion here later when migrating to WalkMapSnapshotRenderer.
 * This will project the interpolated [lng, lat] into local React Native [x, y] screen coordinates
 * based on the bounds of the background snapshot image.
 */
export function latLngToPixel(lat: number, lng: number, mapContext: any) {
  throw new Error("Not implemented: Will be used for snapshot projection later");
}
