/** Platform share of each completed ride. Passenger never sees this. */
export const DEFAULT_COMMISSION_PCT = 10;
export const DEMO_TOPUP = 10_000;

export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return DEFAULT_COMMISSION_PCT;
  return Math.min(50, Math.max(0, Math.round(pct)));
}

export function splitFare(gross: number, pct: number): {
  pct: number;
  commission: number;
  net: number;
} {
  const rate = clampPct(pct);
  const fare = Math.max(0, Math.round(gross));
  const commission = Math.round((fare * rate) / 100);
  return { pct: rate, commission, net: fare - commission };
}
