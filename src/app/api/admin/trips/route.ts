import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';

export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const trips = await rpc('taxi_admin_list_trips', { p_token: token });
    return NextResponse.json({ trips });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
