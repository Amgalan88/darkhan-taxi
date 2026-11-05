import { rpc } from "@/lib/rpc";
import { clampPct, DEFAULT_COMMISSION_PCT, splitFare } from "@/lib/commission";

/**
 * Durable payment + credit records live in taxi.rides.
 * This project cannot add tables, so each record is a cancelled marker ride
 * whose label the app can read back after a deploy or a new login.
 * Markers are not open calls.
 */
const DUE = "ТӨЛБӨР";
const PAID = "ТӨЛСӨН";
const CREDIT = "КРЕДИТ";
const PCT = "ШИМТГЭЛ";

export type Settlement = {
  rideId: string;
  driverId: string;
  method: "qpay" | "driver_cash";
  gross: number;
  commissionPct: number;
  commission: number;
  net: number;
  balanceAfter: number;
  at: string;
};

export type Due = { rideId: string; passengerId: string; gross: number; at: string };

type Trip = {
  id: string;
  passenger_id?: string;
  dest_label?: string;
  created_at?: string;
  status?: string;
};

let tokenCache: { token: string; at: number } | null = null;

async function adminToken(): Promise<string> {
  if (tokenCache && Date.now() - tokenCache.at < 10 * 60 * 1000) return tokenCache.token;
  const phone = process.env.DEMO_ADMIN_PHONE || "99000001";
  const code = process.env.DEMO_OTP_CODE || "1234";
  const data = await rpc<{ token: string }>("taxi_login", { p_phone: phone, p_code: code, p_name: "" });
  tokenCache = { token: data.token, at: Date.now() };
  return data.token;
}

async function listTrips(): Promise<Trip[]> {
  const token = await adminToken();
  const rows = await rpc<Trip[]>("taxi_admin_list_trips", { p_token: token });
  return [...(rows || [])].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

async function dropMarker(label: string): Promise<void> {
  const token = await adminToken();
  const ride = await rpc<{ id: string }>("taxi_create_ride", {
    p_token: token,
    p_pickup_lat: 49.4867,
    p_pickup_lng: 105.9226,
    p_pickup_label: "DMAP",
    p_dest_lat: 49.4867,
    p_dest_lng: 105.9227,
    p_dest_label: label,
    p_distance_km: 0.1,
    p_price: 1,
    p_offered_price: null,
  });
  await rpc("taxi_cancel_ride", { p_token: token, p_ride_id: ride.id });
}

export function isLedgerLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  return label.startsWith(`${DUE}|`) || label.startsWith(`${PAID}|`) || label.startsWith(`${CREDIT}|`) || label.startsWith(`${PCT}|`);
}

export async function getCommissionPct(): Promise<number> {
  const rows = await listTrips();
  for (const row of rows) {
    const label = row.dest_label || "";
    if (!label.startsWith(`${PCT}|`)) continue;
    return clampPct(Number(label.split("|")[1]));
  }
  return DEFAULT_COMMISSION_PCT;
}

export async function setCommissionPct(pct: number): Promise<number> {
  const rate = clampPct(pct);
  await dropMarker(`${PCT}|${rate}`);
  return rate;
}

export async function getBalance(userId: string): Promise<number> {
  const rows = await listTrips();
  for (const row of rows) {
    const parts = (row.dest_label || "").split("|");
    if (parts[0] === CREDIT && parts[1] === userId) return Math.round(Number(parts[2]) || 0);
  }
  return 0;
}

export async function setBalance(userId: string, balance: number): Promise<number> {
  const next = Math.round(balance);
  await dropMarker(`${CREDIT}|${userId}|${next}`);
  return next;
}

export async function addBalance(userId: string, delta: number): Promise<number> {
  const current = await getBalance(userId);
  return setBalance(userId, current + delta);
}

export async function listBalances(): Promise<Record<string, number>> {
  const rows = await listTrips();
  const out: Record<string, number> = {};
  for (const row of rows) {
    const parts = (row.dest_label || "").split("|");
    if (parts[0] !== CREDIT || !parts[1] || out[parts[1]] != null) continue;
    out[parts[1]] = Math.round(Number(parts[2]) || 0);
  }
  return out;
}

export async function getSettlement(rideId: string): Promise<Settlement | null> {
  const rows = await listTrips();
  for (const row of rows) {
    const parts = (row.dest_label || "").split("|");
    if (parts[0] !== PAID || parts[1] !== rideId) continue;
    const method = parts[2] === "qpay" ? "qpay" : "driver_cash";
    return {
      rideId,
      driverId: "",
      method,
      gross: Number(parts[3]) || 0,
      commission: Number(parts[4]) || 0,
      net: Number(parts[5]) || 0,
      balanceAfter: Number(parts[6]) || 0,
      commissionPct: Number(parts[7]) || DEFAULT_COMMISSION_PCT,
      at: row.created_at || "",
    };
  }
  return null;
}

export async function findDue(passengerId: string): Promise<Due | null> {
  const rows = await listTrips();
  const paid = new Set<string>();
  for (const row of rows) {
    const parts = (row.dest_label || "").split("|");
    if (parts[0] === PAID && parts[1]) paid.add(parts[1]);
  }
  for (const row of rows) {
    const parts = (row.dest_label || "").split("|");
    if (parts[0] !== DUE || parts[1] !== passengerId || !parts[2]) continue;
    if (paid.has(parts[2])) continue;
    return { passengerId, rideId: parts[2], gross: Number(parts[3]) || 0, at: row.created_at || "" };
  }
  return null;
}

/** Trip finished, fare not settled. Does not touch driver credit. */
export async function markDue(input: { passengerId: string; rideId: string; gross: number }): Promise<void> {
  const existing = await findDue(input.passengerId);
  if (existing?.rideId === input.rideId) return;
  const paid = await getSettlement(input.rideId);
  if (paid) return;
  await dropMarker(`${DUE}|${input.passengerId}|${input.rideId}|${Math.round(input.gross)}`);
}

/** Deduct 10% only here: QPay keeps credit, cash-received reduces it. */
export async function settleRide(input: {
  rideId: string;
  driverId: string;
  method: "qpay" | "driver_cash";
  gross: number;
}): Promise<Settlement> {
  const existing = await getSettlement(input.rideId);
  if (existing) return { ...existing, driverId: input.driverId };
  const pct = await getCommissionPct();
  const parts = splitFare(input.gross, pct);
  let balanceAfter = await getBalance(input.driverId);
  if (input.method === "driver_cash") {
    balanceAfter -= parts.commission;
    await setBalance(input.driverId, balanceAfter);
  }
  await dropMarker(`${PAID}|${input.rideId}|${input.method}|${Math.round(input.gross)}|${parts.commission}|${parts.net}|${balanceAfter}|${parts.pct}`);
  return {
    rideId: input.rideId,
    driverId: input.driverId,
    method: input.method,
    gross: Math.round(input.gross),
    commissionPct: parts.pct,
    commission: parts.commission,
    net: parts.net,
    balanceAfter,
    at: new Date().toISOString(),
  };
}
