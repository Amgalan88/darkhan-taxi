/**
 * Isolated SMS OTP provider.
 * Today: demo code only. Later: plug verify.mn here without touching callers.
 */
export const DEMO_OTP_CODE = process.env.DEMO_OTP_CODE || '1234';

export type SendOtpResult = { ok: true; provider: 'demo' | 'verify.mn' } | { ok: false; error: string };

export async function sendOtp(phone8: string): Promise<SendOtpResult> {
  // TODO(verify.mn): call verify.mn SMS API with phone8 (+976 prefix).
  // Keep this function as the single integration point.
  void phone8;
  return { ok: true, provider: 'demo' };
}

export async function verifyOtpCode(phone8: string, code: string): Promise<boolean> {
  void phone8;
  // Demo path — replace body with verify.mn check later.
  return code === DEMO_OTP_CODE;
}
