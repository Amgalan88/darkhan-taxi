import fs from "fs";
import { clampPct, DEFAULT_COMMISSION_PCT, splitFare } from "@/lib/commission";

/**
 * Driver credit + commission rate.
 * The taxi schema has no wallet table and this environment cannot migrate it,
 * so the ledger lives in process memory and /tmp (one running server).
 * TODO(db): persist taxi.driver_wallet and taxi.platform_settings.
 */
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

type Ledger = {
  commissionPct: number;
  balances: Record<string, number>;
  settlements: Record<string, Settlement>;
};

const FILE = "/tmp/dmap-ledger.json";

function empty(): Ledger {
  return { commissionPct: DEFAULT_COMMISSION_PCT, balances: {}, settlements: {} };
}

let mem: Ledger | null = null;

function load(): Ledger {
  if (mem) return mem;
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Ledger;
    mem = {
      commissionPct: clampPct(parsed.commissionPct ?? DEFAULT_COMMISSION_PCT),
      balances: parsed.balances || {},
      settlements: parsed.settlements || {},
    };
  } catch {
    mem = empty();
  }
  return mem;
}

function save(next: Ledger) {
  mem = next;
  try {
    fs.writeFileSync(FILE, JSON.stringify(next));
  } catch { /* ephemeral */ }
}

export function getCommissionPct(): number {
  return load().commissionPct;
}

export function setCommissionPct(pct: number): number {
  const ledger = load();
  ledger.commissionPct = clampPct(pct);
  save(ledger);
  return ledger.commissionPct;
}

export function getBalance(userId: string): number {
  const n = load().balances[userId];
  return Number.isFinite(n) ? n : 0;
}

export function setBalance(userId: string, balance: number): number {
  const ledger = load();
  ledger.balances[userId] = Math.round(balance);
  save(ledger);
  return ledger.balances[userId];
}

export function addBalance(userId: string, delta: number): number {
  return setBalance(userId, getBalance(userId) + delta);
}

export function listBalances(): Record<string, number> {
  return { ...load().balances };
}

export function getSettlement(rideId: string): Settlement | null {
  return load().settlements[rideId] || null;
}

/** QPay: commission is taken from the payment, credit unchanged.
 *  Cash («Жолооч бэлнээр авсан»): commission is deducted from driver credit. */
export function settleRide(input: {
  rideId: string;
  driverId: string;
  method: "qpay" | "driver_cash";
  gross: number;
}): Settlement {
  const existing = getSettlement(input.rideId);
  if (existing) return existing;
  const ledger = load();
  const parts = splitFare(input.gross, ledger.commissionPct);
  const current = Number.isFinite(ledger.balances[input.driverId]) ? ledger.balances[input.driverId] : 0;
  const balanceAfter = input.method === "driver_cash" ? current - parts.commission : current;
  if (input.method === "driver_cash") ledger.balances[input.driverId] = balanceAfter;
  const row: Settlement = {
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
  ledger.settlements[input.rideId] = row;
  save(ledger);
  return row;
}
