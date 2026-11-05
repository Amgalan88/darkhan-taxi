import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';
import { normalizePlate, plateError } from '@/lib/plate';
import type { Me } from '@/lib/ride';

/** Driver registration. Plate is required; taxi_register_driver stores it. */
export async function POST(req: Request) {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
    const me = await rpc<Me>('taxi_me', { p_token: token });
    if (me.role !== 'driver') {
      return NextResponse.json({ error: 'Жолооч бүртгэнэ' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const plate = normalizePlate(String(body.plate || ''));
    const err = plateError(plate);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    await rpc('taxi_register_driver', {
      p_token: token,
      p_name: me.name || 'Жолооч',
      p_plate: plate,
      p_car_model: me.driver?.car_model || 'Машин',
      p_car_color: me.driver?.car_color || 'Цагаан',
    });
    const user = await rpc<Me>('taxi_me', { p_token: token });
    if (plateError(user.driver?.plate || '')) {
      return NextResponse.json({ error: 'Дугаар хадгалагдсангүй' }, { status: 400 });
    }
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
