import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const data = await rpc('taxi_get_ride', { p_token: token, p_ride_id: id });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const body = await req.json();
    const action = String(body.action || '');
    const map: Record<string, string> = {
      accept: 'taxi_accept_ride',
      arrived: 'taxi_mark_arrived',
      complete: 'taxi_complete_ride',
      cancel: 'taxi_cancel_ride',
    };
    const fn = map[action];
    if (!fn) return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
    const ride = await rpc(fn, { p_token: token, p_ride_id: id });
    return NextResponse.json({ ride });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
