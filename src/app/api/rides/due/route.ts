import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { rpc } from "@/lib/rpc";
import { findDue } from "@/lib/ledger";
import type { Me } from "@/lib/ride";

/** Unpaid fare for the signed-in passenger. Survives logout because it is stored in taxi.rides. */
export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
    const me = await rpc<Me>("taxi_me", { p_token: token });
    if (me.role !== "passenger") return NextResponse.json({ due: null });
    const due = await findDue(me.id);
    if (!due) return NextResponse.json({ due: null });
    let ride = null;
    let driver = null;
    try {
      const data = await rpc<{ ride: unknown; driver: unknown }>("taxi_get_ride", {
        p_token: token,
        p_ride_id: due.rideId,
      });
      ride = data?.ride || null;
      driver = data?.driver || null;
    } catch { /* fare still comes from the marker */ }
    return NextResponse.json({ due, ride, driver });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
