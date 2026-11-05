"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DARKHAN_CENTER, approachFrom, nearDarkhan } from "@/lib/geo";
import { tugrik } from "@/lib/format";
import { supabasePublic } from "@/lib/supabase";
import { AccountMenu } from "@/components/AccountMenu";
import { plateError, plateOk } from "@/lib/plate";
import { fareOf, isLive, type Me, type Ride } from "@/lib/ride";
import type { Settlement } from "@/lib/ledger";

const TaxiMap = dynamic(() => import("@/components/Map"), { ssr: false });

function errText(e: unknown): string {
  const m = (e as Error).message || "Алдаа";
  if (m === "Failed to fetch") return "Холболт тасарлаа. Дахин оролдоно уу.";
  return m;
}

export default function DriverPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [open, setOpen] = useState<Ride[]>([]);
  const [active, setActive] = useState<Ride | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [plate, setPlate] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carColor, setCarColor] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(0);
  const [balanceReady, setBalanceReady] = useState(false);
  const [topNote, setTopNote] = useState("");
  const [pending, setPending] = useState<Ride | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [approachHint, setApproachHint] = useState<{ lat: number; lng: number } | null>(null);
  const activeId = useRef<string | null>(null);
  const closedByMe = useRef(false);
  const pendingRef = useRef<Ride | null>(null);
  const approachFor = useRef<string | null>(null);
  const loadSeq = useRef(0);

  const loadOpen = useCallback(async () => {
    const res = await fetch("/api/rides/open");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setOpen(data.rides || []);
    else if (data.error) setErr(data.error);
  }, []);

  const loadActive = useCallback(async () => {
    const seq = ++loadSeq.current;
    const res = await fetch("/api/rides");
    const data = await res.json().catch(() => ({}));
    if (seq !== loadSeq.current || !res.ok) return;
    const ride = data.ride as Ride | undefined;
    if (ride && isLive(ride.status)) {
      if (pendingRef.current && pendingRef.current.id === ride.id) {
        setActive(null);
        return;
      }
      activeId.current = ride.id;
      closedByMe.current = false;
      pendingRef.current = null;
      setPending(null);
      setActive(ride);
      return;
    }
    const finished = ride?.status === "completed" || ride?.status === "awaiting_payment";
    // Finish / payment-pending must never look like a cancel. taxi_my_active_ride
    // usually returns nothing once the trip is no longer live.
    if (pendingRef.current || closedByMe.current || finished) {
      closedByMe.current = false;
      activeId.current = null;
      setActive(null);
      if (finished && !pendingRef.current && ride) {
        const next = { ...ride, status: "awaiting_payment" };
        pendingRef.current = next;
        setPending(next);
      }
      return;
    }
    if (activeId.current) setNote("Аялал цуцлагдлаа");
    closedByMe.current = false;
    activeId.current = null;
    setActive(null);
  }, []);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(""), 4000);
    return () => window.clearTimeout(t);
  }, [note]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then(async (d) => {
      if (!d.user) { router.replace("/login?next=/driver"); return; }
      if (d.user.role !== "driver" && d.user.role !== "admin") {
        router.replace("/login?next=/driver");
        return;
      }
      setUser(d.user);
      setReady(true);
      await loadOpen();
      await loadActive();
    }).catch(() => setReady(true));
  }, [router, loadOpen, loadActive]);

  useEffect(() => {
    if (!ready) return;
    let watch = -1;
    if (navigator.geolocation) {
      watch = navigator.geolocation.watchPosition(
        (p) => {
          const next = { lat: p.coords.latitude, lng: p.coords.longitude };
          if (!nearDarkhan(next)) return;
          setPos(next);
          fetch("/api/driver/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    }
    const sb = supabasePublic();
    const ch = sb.channel("driver-open")
      .on("postgres_changes", { event: "*", schema: "taxi", table: "rides" }, () => {
        void loadOpen();
        void loadActive();
      })
      .subscribe();
    const poll = window.setInterval(() => { void loadOpen(); void loadActive(); }, 4000);
    return () => {
      if (watch >= 0) navigator.geolocation.clearWatch(watch);
      sb.removeChannel(ch);
      window.clearInterval(poll);
    };
  }, [ready, loadOpen, loadActive]);

  useEffect(() => {
    if (active?.status !== "accepted") {
      approachFor.current = null;
      setApproachHint(null);
      return;
    }
    if (approachFor.current === active.id) return;
    approachFor.current = active.id;
    setApproachHint(approachFrom(pos, { lat: Number(active.pickup_lat), lng: Number(active.pickup_lng) }));
  }, [active?.status, active?.id, active?.pickup_lat, active?.pickup_lng, pos]);

  const loadWallet = useCallback(async () => {
    const res = await fetch("/api/driver/wallet");
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.balance === "number") {
      setBalance(data.balance);
      setBalanceReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadWallet();
    const t = window.setInterval(() => { void loadWallet(); }, 4000);
    return () => window.clearInterval(t);
  }, [ready, loadWallet]);

  useEffect(() => {
    if (!pending?.id || settlement) return;
    let stop = false;
    const pull = async () => {
      const res = await fetch(`/api/rides/${pending.id}/pay`);
      const data = await res.json().catch(() => ({}));
      if (!stop && data.settlement) {
        setSettlement(data.settlement);
        if (typeof data.settlement.balanceAfter === "number") {
          setBalance(data.settlement.balanceAfter);
          setBalanceReady(true);
        }
      }
    };
    void pull();
    const t = window.setInterval(() => { void pull(); }, 2000);
    return () => { stop = true; window.clearInterval(t); };
  }, [pending?.id, settlement]);

  async function act(id: string, action: string) {
    setBusy(true); setErr("");
    const snapshot = active;
    if (action === "finish" && snapshot) {
      // Mark pending before the request so a realtime poll cannot flash cancelled copy.
      closedByMe.current = true;
      loadSeq.current += 1;
      activeId.current = null;
      const waiting = { ...snapshot, status: "awaiting_payment" };
      pendingRef.current = waiting;
      setPending(waiting);
      setSettlement(null);
      setActive(null);
      setConfirmCancel(false);
      setNote("");
    }
    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа");
      if (action === "finish") {
        const waiting = { ...(data.ride || pendingRef.current || snapshot!), status: "awaiting_payment" };
        pendingRef.current = waiting;
        setPending(waiting);
        setSettlement(null);
        setActive(null);
        setConfirmCancel(false);
      } else if (action === "cancel") {
        loadSeq.current += 1;
        closedByMe.current = true;
        activeId.current = null;
        setActive(null);
        setConfirmCancel(false);
        setNote("Цуцлагдлаа");
      } else if (data.ride) {
        activeId.current = data.ride.id;
        setActive(data.ride);
      }
      await loadOpen();
    } catch (e) {
      if (action === "finish") {
        pendingRef.current = null;
        closedByMe.current = false;
        setPending(null);
      }
      setErr(errText(e));
      await loadActive();
    } finally {
      setBusy(false);
    }
  }

  async function markCash(id: string) {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/rides/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "driver_cash" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа");
      setSettlement(data.settlement);
      if (typeof data.settlement?.balanceAfter === "number") {
        setBalance(data.settlement.balanceAfter);
        setBalanceReady(true);
      }
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function topup() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/driver/wallet", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа");
      setBalance(data.balance);
      setBalanceReady(true);
      setTopNote(data.message || "Цэнэглэгдлээ");
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function savePlate(e: FormEvent) {
    e.preventDefault();
    const problem = plateError(plate);
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/driver/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate,
          car_model: carModel || user?.driver?.car_model || "Машин",
          car_color: carColor || user?.driver?.car_color || "Цагаан",
          name: user?.name || "Жолооч",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа");
      setUser(data.user);
      setPlate("");
      setNote("Дугаар хадгаллаа");
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const storedPlate = user?.driver?.plate || "";
  const needsPlate = user?.role === "driver" && !plateOk(storedPlate);
  const waiting = user?.role === "driver" && plateOk(storedPlate) && user.driver?.approved === false;
  const job = open.find((r) => !skipped.includes(r.id)) || null;
  const focus = active || (!pending ? job : null);
  const pickupPt = focus ? { lat: Number(focus.pickup_lat), lng: Number(focus.pickup_lng) } : null;
  const destPt = focus ? { lat: Number(focus.dest_lat), lng: Number(focus.dest_lng) } : null;
  const approach = active?.status === "accepted" && pickupPt && approachHint
    ? { id: active.id, to: pickupPt, hint: approachHint }
    : null;
  const carAt = !approach ? (active?.status === "arrived" && pickupPt ? pickupPt : (pos || DARKHAN_CENTER)) : null;
  const noCredit = balanceReady && balance <= 0;
  const jobMin = job ? Math.max(1, Math.round(Number(job.distance_km) * 2.5)) : 0;
  const idle = Boolean(ready && !needsPlate && !waiting && !active && !pending && !job && !settlement && !confirmCancel);

  let heading = "Шинэ дуудлага алга";
  if (needsPlate && !active && !pending) heading = "Машины дугаар";
  else if (waiting && !active) heading = "Зөвшөөрөл хүлээгдэж байна";
  else if (settlement) heading = "Таны орлого";
  else if (pending) heading = "Төлбөр хүлээж байна";
  else if (active?.status === "accepted") heading = "Зорчигч руу";
  else if (active?.status === "arrived") heading = "Аялалд";
  else if (job) heading = "Шинэ дуудлага";

  return (
    <div style={{ height: "100dvh", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", left: 12, right: 68, zIndex: 20, display: "flex", gap: 8, alignItems: "center" }}>
        <div
          className="pill"
          style={{
            flex: 1, height: 48, fontSize: 16, justifyContent: "flex-start",
            background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          Үлдэгдэл {balanceReady ? tugrik(balance) : "…"}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => { void topup(); }}
          style={{
            height: 48, width: "auto", padding: "0 16px", flex: "none",
            border: "none", borderRadius: 16, background: "#FFC300", color: "#0B2545",
            fontWeight: 800, fontSize: 16, cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Цэнэглэх
        </button>
      </div>
      {user && (
        <div style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", right: 12, zIndex: 20 }}>
          <AccountMenu phone={user.phone} name={user.name} glass />
        </div>
      )}
      <TaxiMap pickup={pickupPt} dest={destPt} driver={carAt} approach={approach} />
      {idle && (
        <div
          className="pill"
          style={{
            position: "absolute", left: "50%", bottom: "calc(max(120px, min(16vh, 140px)) + 12px)", transform: "translateX(-50%)",
            zIndex: 15, height: 40, maxWidth: "calc(100% - 24px)", fontSize: 15, fontWeight: 700,
            background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          Газрын зураг дээр хүлээнэ
        </div>
      )}
      <div
        className="sheet"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, overflow: idle ? "hidden" : "auto",
          height: idle ? "min(16vh, 140px)" : undefined,
          minHeight: idle ? 120 : undefined,
          maxHeight: idle ? 140 : "52vh",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: "28px 28px 0 0",
          padding: idle ? "8px 20px 10px" : undefined,
        }}
      >
        <div className="handle" style={idle ? { marginBottom: 8 } : undefined} />
        {!ready && <div style={{ fontWeight: 800, fontSize: 28 }}>Ачаалж байна…</div>}
        {ready && <div style={{ fontSize: idle ? 24 : 28, fontWeight: 800, lineHeight: 1.2 }} aria-live="polite">{heading}</div>}
        {storedPlate && plateOk(storedPlate) && !needsPlate && (
          <div className="small" style={{ marginTop: 4 }}>{user?.driver?.car_color} · {user?.driver?.car_model} · {storedPlate}</div>
        )}
        {noCredit && !active && !pending && !idle && (
          <div style={{ marginTop: 8, fontWeight: 800, color: "#B42318" }}>Кредит цэнэглэнэ үү</div>
        )}
        {(note || topNote) && <div style={{ marginTop: 8, fontWeight: 700 }}>{note || topNote}</div>}
        {err && <div style={{ color: "#B42318", marginTop: 8, fontWeight: 700 }}>{err}</div>}

        {ready && needsPlate && !active && !pending && (
          <form onSubmit={savePlate} style={{ marginTop: 12 }}>
            <label className="label" htmlFor="model">Машины загвар</label>
            <input id="model" value={carModel} onChange={(e) => setCarModel(e.target.value)} placeholder="Prius" style={{ width: "100%", height: 64, fontSize: 20, fontWeight: 700, borderRadius: 16, border: "2px solid #D5DBE3", padding: "0 16px" }} />
            <label className="label" htmlFor="color" style={{ display: "block", marginTop: 12 }}>Өнгө</label>
            <input id="color" value={carColor} onChange={(e) => setCarColor(e.target.value)} placeholder="Цагаан" style={{ width: "100%", height: 64, fontSize: 20, fontWeight: 700, borderRadius: 16, border: "2px solid #D5DBE3", padding: "0 16px" }} />
            <label className="label" htmlFor="plate" style={{ display: "block", marginTop: 12 }}>Улсын дугаар</label>
            <input id="plate" value={plate} autoComplete="off" placeholder="1234 УБА" onChange={(e) => setPlate(e.target.value)} style={{ width: "100%", height: 64, fontSize: 24, fontWeight: 800, borderRadius: 16, border: "2px solid #0B2545", padding: "0 16px" }} />
            <button className="btn cta" style={{ marginTop: 14 }} type="submit" disabled={busy || !plate.trim()}>Хадгалах</button>
          </form>
        )}

        {ready && waiting && !active && <div className="small" style={{ marginTop: 10 }}>Админ зөвшөөрсний дараа дуудлага авна.</div>}

        {confirmCancel && active && (
          <>
            <div style={{ marginTop: 12, fontWeight: 800, fontSize: 22 }}>Цуцлах уу?</div>
            <button type="button" className="btn cta" style={{ marginTop: 12, background: "#B42318", color: "#fff" }} disabled={busy} onClick={() => { void act(active.id, "cancel"); }}>Тийм, цуцлах</button>
            <button type="button" className="btn sec" onClick={() => setConfirmCancel(false)}>Буцах</button>
          </>
        )}

        {!confirmCancel && ready && !needsPlate && !waiting && active?.status === "accepted" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{active.passenger_name || "Зорчигч"}</div>
            {active.passenger_phone && (
              <a className="btn green" style={{ marginTop: 12, height: 60, fontSize: 22, textDecoration: "none" }} href={`tel:+976${active.passenger_phone}`}>Залгах</a>
            )}
            <button type="button" className="btn cta" style={{ marginTop: 12 }} disabled={busy} onClick={() => { void act(active.id, "arrived"); }}>Зорчигч авсан</button>
            <button type="button" className="btn sec" disabled={busy} onClick={() => setConfirmCancel(true)}>Цуцлах</button>
          </div>
        )}

        {!confirmCancel && ready && active?.status === "arrived" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800 }}>{active.dest_label || "Очих газар"}</div>
            <div className="big" style={{ marginTop: 8 }}>{tugrik(fareOf(active))}</div>
            <button type="button" className="btn cta" style={{ marginTop: 14 }} disabled={busy} onClick={() => { void act(active.id, "finish"); }}>Дуусгах</button>
          </div>
        )}

        {settlement && (
          <div style={{ marginTop: 8 }}>
            <div className="big">{tugrik(settlement.net)}</div>
            <div className="small" style={{ marginTop: 6 }}>Шимтгэл {settlement.commissionPct}% · {tugrik(settlement.commission)}</div>
            {settlement.method === "driver_cash" ? (
              <div className="small" style={{ marginTop: 6 }}>Кредитээс −{tugrik(settlement.commission)} · үлдэгдэл {tugrik(settlement.balanceAfter)}</div>
            ) : (
              <div className="small" style={{ marginTop: 6 }}>QPay-ээс шимтгэл суутгасан</div>
            )}
            <button type="button" className="btn cta" style={{ marginTop: 14 }} onClick={() => { pendingRef.current = null; setSettlement(null); setPending(null); }}>Болсон</button>
          </div>
        )}

        {!settlement && pending && (
          <div style={{ marginTop: 8 }}>
            <div className="big">{tugrik(fareOf(pending))}</div>
            <div className="small" style={{ marginTop: 4 }}>QPay төлөгдөөгүй бол</div>
            <button
              type="button"
              className="btn cta"
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() => { void markCash(pending.id); }}
            >
              Бэлнээр авсан
            </button>
          </div>
        )}

        {ready && !needsPlate && !waiting && !active && !pending && job && (
          <div style={{ marginTop: 10 }}>
            <div className="big">{tugrik(fareOf(job))}</div>
            <div className="small" style={{ marginTop: 4 }}>{Number(job.distance_km).toFixed(1)} км · ~{jobMin} мин</div>
            <button type="button" className="btn green" style={{ marginTop: 14, height: 72, minHeight: 72 }} disabled={busy || !balanceReady || noCredit || !plateOk(storedPlate)} onClick={() => { void act(job.id, "accept"); }}>
              Авах
            </button>
            <button type="button" className="btn sec" disabled={busy} onClick={() => setSkipped((s) => [...s, job.id])}>Татгалзах</button>
          </div>
        )}

      </div>
    </div>
  );
}
