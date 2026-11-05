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
