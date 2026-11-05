import { NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/format';
import { sendOtp } from '@/lib/sms';
import { rpc } from '@/lib/rpc';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = normalizePhone(String(body.phone || ''));
    if (phone.length !== 8) {
      return NextResponse.json({ error: 'Утасны дугаар буруу' }, { status: 400 });
    }
    const sms = await sendOtp(phone);
    if (!sms.ok) return NextResponse.json({ error: sms.error }, { status: 500 });
    await rpc('taxi_request_otp', { p_phone: phone });
    return NextResponse.json({ ok: true, demo: sms.provider === 'demo' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
