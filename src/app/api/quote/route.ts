import { NextResponse } from 'next/server';
import { rpc } from '@/lib/rpc';
import { routeDistanceKm, calcPrice } from '@/lib/geo';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const from = { lat: Number(body.pickup_lat), lng: Number(body.pickup_lng) };
    const to = { lat: Number(body.dest_lat), lng: Number(body.dest_lng) };
    if (![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)) {
      return NextResponse.json({ error: 'байршил буруу' }, { status: 400 });
    }
    const tariff = await rpc<{ base_fare: number; per_km: number }>('taxi_get_tariff');
    const { km, source } = await routeDistanceKm(from, to);
    const price = calcPrice(km, tariff.base_fare, tariff.per_km);
    const mins = Math.max(3, Math.round(km * 2.5));
    return NextResponse.json({
      distance_km: km,
      price,
      eta_min: mins,
      source,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
