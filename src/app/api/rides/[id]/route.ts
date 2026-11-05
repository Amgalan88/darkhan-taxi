import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';
import { plateError } from '@/lib/plate';
import type { Me, Ride } from '@/lib/ride';

const FNS: Record<string, string> = {
  accept: 'taxi_accept_ride',
  arrived: 'taxi_mark_arrived',
  complete: 'taxi_complete_ride',
  cash: 'taxi_complete_ride',
  finish: 'taxi_complete_ride',
  cancel: 'taxi_cancel_ride',
};

async function meAndRide(token: string, id: string) {
  const [me, data] = await Promise.all([
    rpc<Me>('taxi_me', { p_token: token }),
    rpc<{ ride: Ride }>('taxi_get_ride', { p_token: token, p_ride_id: id }),
  ]);
  return { me, ride: data?.ride };
}

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
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const fn = FNS[action];
    if (!fn) return NextResponse.json({ error: 'unknown_action' }, { status: 400 });

    if (action === 'accept') {
      const me = await rpc<Me>('taxi_me', { p_token: token });
      const err = plateError(me?.driver?.plate || '');
      if (me?.role === 'driver' && err) {
        return NextResponse.json({ error: 'Машины дугаар оруулна уу' }, { status: 400 });
      }
      if (me?.role === 'driver' && me.driver && me.driver.approved === false) {
        return NextResponse.json({ error: 'Админ зөвшөөрөөгүй байна' }, { status: 400 });
      }
    }

    if (action === 'cancel' || action === 'cash' || action === 'finish' || action === 'complete') {
      const { me, ride } = await meAndRide(token, id);
      if (!ride) return NextResponse.json({ error: 'Аялал олдсонгүй' }, { status: 404 });
      if (action === 'cancel') {
        // taxi_cancel_ride only succeeds for the passenger. A driver button would just error.
        const passengerOk = me.role === 'passenger' && ['requested', 'accepted', 'arrived'].includes(ride.status);
        if (!passengerOk) {
          const message = me.role === 'driver' || me.role === 'admin'
            ? 'Зорчигч цуцална'
            : 'Энэ үед цуцлах боломжгүй';
          return NextResponse.json({ error: message }, { status: 400 });
        }
      } else {
        if (me.role !== 'driver' && me.role !== 'admin') {
          return NextResponse.json({ error: 'Жолооч аяллыг хаана' }, { status: 403 });
        }
        if (ride.status !== 'arrived') {
          return NextResponse.json({ error: 'Эхлээд ирснээ дарна уу' }, { status: 400 });
        }
      }
    }

    const ride = await rpc(fn, { p_token: token, p_ride_id: id });
    return NextResponse.json({ ride });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
