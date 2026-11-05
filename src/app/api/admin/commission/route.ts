import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { rpc } from "@/lib/rpc";
import type { Me } from "@/lib/ride";
import { getCommissionPct, setCommissionPct } from "@/lib/ledger";

export async function GET() {
  return NextResponse.json({ commissionPct: await getCommissionPct() });
}

export async function PUT(req: Request) {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
    const me = await rpc<Me>("taxi_me", { p_token: token });
    if (me.role !== "admin") return NextResponse.json({ error: "Зөвхөн админ" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const commissionPct = await setCommissionPct(Number(body.commission_pct));
    return NextResponse.json({ commissionPct });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
