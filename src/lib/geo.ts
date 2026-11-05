/** Darkhan, Mongolia city center */
export const DARKHAN_CENTER = { lat: 49.4867, lng: 105.9226 } as const;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function calcPrice(distanceKm: number, base: number, perKm: number): number {
  return Math.round(base + perKm * distanceKm);
}

/** GPS far outside the service city is ignored so the map stays on Darkhan. */
export function nearDarkhan(p: { lat: number; lng: number }, km = 500): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && haversineKm(p, DARKHAN_CENTER) <= km;
}

/** Start the demo approach near the pickup when live GPS is missing or already there. */
export function approachFrom(
  pos: { lat: number; lng: number } | null | undefined,
  target: { lat: number; lng: number },
): { lat: number; lng: number } {
  if (pos && nearDarkhan(pos)) {
    const km = haversineKm(pos, target);
    if (km > 0.35 && km < 30) return pos;
  }
  return { lat: target.lat + 0.011, lng: target.lng - 0.008 };
}

export function approachMs(km: number): number {
  return Math.round(Math.min(32000, Math.max(12000, km * 9000)));
}

/** Prefer OSRM public routing; fall back to haversine. */
export async function routeDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<{ km: number; source: 'osrm' | 'haversine' }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('osrm');
    const data = await res.json();
    const meters = data?.routes?.[0]?.distance;
    if (typeof meters === 'number' && meters > 0) {
      return { km: Math.round((meters / 1000) * 100) / 100, source: 'osrm' };
    }
  } catch {
    /* fall through */
  }
  return { km: Math.round(haversineKm(from, to) * 100) / 100, source: 'haversine' };
}
