import { NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/format';
import { verifyOtpCode } from '@/lib/sms';
import { rpc } from '@/lib/rpc';
import { setSessionCookie } from '@/lib/session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = normalizePhone(String(body.phone || ''));
    const code = String(body.code || '');
    const name = String(body.name || '');
    if (phone.length !== 8) {
      return NextResponse.json({ error: 'Утасны дугаар буруу' }, { status: 400 });
    }
    const ok = await verifyOtpCode(phone, code);
    if (!ok) {
      return NextResponse.json({ error: 'Код буруу' }, { status: 401 });
    }
    const data = await rpc<{ token: string; user: { id: string; phone: string; name: string; role: string } }>(
      'taxi_login',
      { p_phone: phone, p_code: code, p_name: name },
    );
    await setSessionCookie(data.token);
    return NextResponse.json({ user: data.user });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
