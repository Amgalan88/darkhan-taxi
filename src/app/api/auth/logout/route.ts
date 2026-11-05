import { NextResponse } from 'next/server';
import { clearSessionCookie, getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) await rpc('taxi_logout', { p_token: token });
  } catch { /* ignore */ }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
