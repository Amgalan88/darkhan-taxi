import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { rpc } from "@/lib/rpc";
import type { Me } from "@/lib/ride";
import { DEMO_TOPUP } from "@/lib/commission";
import { addBalance, getBalance, getCommissionPct } from "@/lib/ledger";
import { qpayConfigured } from "@/lib/qpay";

export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
    const me = await rpc<Me>("taxi_me", { p_token: token });
    if (me.role !== "driver" && me.role !== "admin") {
      return NextResponse.json({ error: "Жолоочийн хэтэвч" }, { status: 403 });
    }
    return NextResponse.json({
      balance: getBalance(me.id),
      commissionPct: getCommissionPct(),
      userId: me.id,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Demo top-up until QPay invoice keys exist. */
export async function POST() {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
    const me = await rpc<Me>("taxi_me", { p_token: token });
    if (me.role !== "driver") {
      return NextResponse.json({ error: "Жолооч цэнэглэнэ" }, { status: 403 });
    }
    const balance = addBalance(me.id, DEMO_TOPUP);
    const demo = !qpayConfigured();
    return NextResponse.json({
      balance,
      demo,
      amount: DEMO_TOPUP,
      message: demo
        ? "QPay түлхүүр тохируулаагүй — туршилтын цэнэглэлт."
        : "QPay түлхүүр байна, нэхэмжлэх хараахан холбогдоогүй — туршилтын цэнэглэлт.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
