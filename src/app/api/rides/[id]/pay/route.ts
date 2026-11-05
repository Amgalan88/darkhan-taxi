import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';
import { createQpayInvoice } from '@/lib/qpay';
import { fareOf, type Me, type Ride } from '@/lib/ride';

/**
 * Passenger QPay path. Stub until QPAY_* env and a real invoice call exist.
 * Does not mark the ride cash. The driver app hears the demo signal and closes with "Дуусгах".
 * Driver cash uses PATCH action "cash" → taxi_complete_ride.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.method !== 'qpay') {
      return NextResponse.json({ error: 'QPay-ээр төлнө үү' }, { status: 400 });
    }
    const me = await rpc<Me>('taxi_me', { p_token: token });
    if (me.role !== 'passenger') {
      return NextResponse.json({ error: 'Зорчигч төлнө' }, { status: 403 });
    }
    const data = await rpc<{ ride: Ride }>('taxi_get_ride', { p_token: token, p_ride_id: id });
    const ride = data?.ride;
    if (!ride) return NextResponse.json({ error: 'Аялал олдсонгүй' }, { status: 404 });
    if (ride.status !== 'arrived') {
      return NextResponse.json({ error: 'Аялал дууссаны дараа төлнө' }, { status: 400 });
    }
    const invoice = await createQpayInvoice({ amount: fareOf(ride), rideId: ride.id });
    return NextResponse.json({ ok: true, method: 'qpay', ...invoice });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
