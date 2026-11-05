import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';

export async function POST(req: Request) {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const b = await req.json();
    await rpc('taxi_update_driver_location', {
      p_token: token,
      p_lat: Number(b.lat),
      p_lng: Number(b.lng),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
