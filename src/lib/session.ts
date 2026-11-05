import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

export const COOKIE_NAME = 'dt_session';

function sign(token: string): string {
  const secret = process.env.SESSION_SECRET || 'dev-only-change-me';
  const sig = createHmac('sha256', secret).update(token).digest('base64url');
  return `${token}.${sig}`;
}

function unsign(value: string): string | null {
  const i = value.lastIndexOf('.');
  if (i <= 0) return null;
  const token = value.slice(0, i);
  const sig = value.slice(i + 1);
  const secret = process.env.SESSION_SECRET || 'dev-only-change-me';
  const expected = createHmac('sha256', secret).update(token).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return token;
  } catch {
    return null;
  }
}

const cookieBase = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
});

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, sign(token), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  // Explicit expire — jar.delete alone can leave Secure cookies on some hosts.
  jar.set(COOKIE_NAME, '', { ...cookieBase(), maxAge: 0 });
}

export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return unsign(raw);
}
