import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';
import { findDue } from '@/lib/ledger';
import type { Me } from '@/lib/ride';

export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const data = await rpc('taxi_my_active_ride', { p_token: token });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const me = await rpc<Me>('taxi_me', { p_token: token });
    if (me.role === 'passenger') {
      const due = await findDue(me.id);
      if (due) {
        return NextResponse.json({ error: 'Эхлээд өмнөх төлбөрөө батална уу', due }, { status: 409 });
      }
    }
    const b = await req.json();
    const ride = await rpc('taxi_create_ride', {
      p_token: token,
      p_pickup_lat: Number(b.pickup_lat),
      p_pickup_lng: Number(b.pickup_lng),
      p_pickup_label: b.pickup_label || 'Таны байршил',
      p_dest_lat: Number(b.dest_lat),
      p_dest_lng: Number(b.dest_lng),
      p_dest_label: b.dest_label || '',
      p_distance_km: Number(b.distance_km),
      p_price: Number(b.price),
      p_offered_price: b.offered_price != null ? Number(b.offered_price) : null,
    });
    return NextResponse.json({ ride });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
