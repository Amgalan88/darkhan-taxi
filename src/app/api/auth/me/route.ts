import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { rpc } from '@/lib/rpc';

export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ user: null });
    const user = await rpc('taxi_me', { p_token: token });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
