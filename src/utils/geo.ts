const EARTH_RADIUS_METERS = 6371000;

/** Default map center used until the user's real location is known (San Diego). */
export const FALLBACK_LOCATION = { lat: 32.7157, lng: -117.1611 };

/** Great-circle distance between two coordinates, in meters (Haversine formula). */
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineDistanceMeters(lat1, lng1, lat2, lng2) / 1000;
}

/** Filters items with a lat/lng within radiusKm of a center point. */
export function filterWithinRadiusKm<T extends { lat: number; lng: number }>(
  items: T[],
  center: { lat: number; lng: number },
  radiusKm: number
): T[] {
  return items.filter(item => haversineDistanceKm(center.lat, center.lng, item.lat, item.lng) <= radiusKm);
}
