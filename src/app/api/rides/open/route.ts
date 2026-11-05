import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';

export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const rides = await rpc('taxi_list_open_rides', { p_token: token });
    return NextResponse.json({ rides });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
