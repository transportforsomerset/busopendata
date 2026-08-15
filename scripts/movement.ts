const EARTH_RADIUS_METRES = 6_371_000;

export function calculateDistanceMetres(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const lat1 = (latitude1 * Math.PI) / 180;
  const lat2 = (latitude2 * Math.PI) / 180;
  const deltaLat = ((latitude2 - latitude1) * Math.PI) / 180;
  const deltaLon = ((longitude2 - longitude1) * Math.PI) / 180;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METRES * c;
}
