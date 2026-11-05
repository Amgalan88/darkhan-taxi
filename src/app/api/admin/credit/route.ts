import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { rpc } from "@/lib/rpc";
import type { Me } from "@/lib/ride";
import { listBalances, setBalance } from "@/lib/ledger";

export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
    const me = await rpc<Me>("taxi_me", { p_token: token });
    if (me.role !== "admin") return NextResponse.json({ error: "Зөвхөн админ" }, { status: 403 });
    return NextResponse.json({ balances: listBalances() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
    const me = await rpc<Me>("taxi_me", { p_token: token });
    if (me.role !== "admin") return NextResponse.json({ error: "Зөвхөн админ" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id || "");
    if (!userId) return NextResponse.json({ error: "Жолооч олдсонгүй" }, { status: 400 });
    const balance = setBalance(userId, Number(body.balance));
    return NextResponse.json({ userId, balance });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
