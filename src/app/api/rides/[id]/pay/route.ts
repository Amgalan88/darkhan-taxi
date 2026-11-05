import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { rpc } from "@/lib/rpc";
import { createQpayInvoice } from "@/lib/qpay";
import { fareOf, type Me, type Ride } from "@/lib/ride";
import { getSettlement, settleRide } from "@/lib/ledger";

/**
 * Passenger confirms how the trip was paid after the driver taps «Дуусгах».
 * QPay — 10% stays with the platform from that payment (driver credit unchanged).
 * «Жолооч бэлнээр авсан» — 10% is deducted from the driver's credit.
 * There is no passenger «бэлэн» button.
 */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
    await rpc("taxi_get_ride", { p_token: token, p_ride_id: id });
    return NextResponse.json({ settlement: await getSettlement(id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const token = await getSessionToken();
    if (!token) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const method = body.method === "driver_cash" ? "driver_cash" : body.method === "qpay" ? "qpay" : "";
    if (!method) return NextResponse.json({ error: "Төлбөрөө сонгоно уу" }, { status: 400 });

    const me = await rpc<Me>("taxi_me", { p_token: token });
    const driverCash = method === "driver_cash" && (me.role === "driver" || me.role === "admin");
    const passengerPay = me.role === "passenger";
    if (!driverCash && !passengerPay) {
      return NextResponse.json({ error: "Төлбөр батлах эрхгүй" }, { status: 403 });
    }
    const data = await rpc<{ ride: Ride & { driver_id?: string } }>("taxi_get_ride", {
      p_token: token,
      p_ride_id: id,
    });
    const ride = data?.ride;
    if (!ride) return NextResponse.json({ error: "Аялал олдсонгүй" }, { status: 404 });
    if (ride.status !== "completed" && ride.status !== "awaiting_payment") {
      return NextResponse.json({ error: "Жолооч аяллыг дуусгасны дараа батална" }, { status: 400 });
    }
    const driverId = ride.driver_id || "";
    if (!driverId) return NextResponse.json({ error: "Жолооч олдсонгүй" }, { status: 400 });

    const settlement = await settleRide({
      rideId: ride.id,
      driverId,
      method,
      gross: fareOf(ride),
    });
    const invoice = method === "qpay" ? await createQpayInvoice({ amount: fareOf(ride), rideId: ride.id }) : null;
    return NextResponse.json({
      ok: true,
      settlement,
      stub: invoice?.stub ?? false,
      message: method === "qpay"
        ? (invoice?.message || "QPay")
        : "Жолооч бэлнээр авсан.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
