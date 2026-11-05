import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';

export async function GET() {
  try {
    const tariff = await rpc('taxi_get_tariff');
    return NextResponse.json({ tariff });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const b = await req.json();
    const tariff = await rpc('taxi_admin_set_tariff', {
      p_token: token,
      p_base: Number(b.base_fare),
      p_per_km: Number(b.per_km),
    });
    return NextResponse.json({ tariff });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
