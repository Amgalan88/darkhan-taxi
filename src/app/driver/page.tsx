"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DARKHAN_CENTER, approachFrom, nearDarkhan } from "@/lib/geo";
import { tugrik } from "@/lib/format";
import { supabasePublic } from "@/lib/supabase";
import { AccountMenu } from "@/components/AccountMenu";
import { plateError, plateOk } from "@/lib/plate";
import { useQpaySignal } from "@/lib/useQpaySignal";
import { QPAY_KEY, fareOf, isLive, type Me, type Ride } from "@/lib/ride";

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
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [qpayPaid, setQpayPaid] = useState(false);
  const [approachHint, setApproachHint] = useState<{ lat: number; lng: number } | null>(null);
  const activeId = useRef<string | null>(null);
  const closedByMe = useRef(false);
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
      activeId.current = ride.id;
      closedByMe.current = false;
      setActive(ride);
      try {
        setQpayPaid(localStorage.getItem(QPAY_KEY(ride.id)) === "1");
      } catch { /* ignore */ }
      return;
    }
    if (ride?.status === "completed") {
      if (activeId.current && !closedByMe.current) setNote("Аялал хаагдлаа");
      closedByMe.current = false;
      activeId.current = null;
      setActive(null);
      setQpayPaid(false);
      return;
    }
    if (activeId.current && !closedByMe.current) setNote("Аялал цуцлагдлаа");
    closedByMe.current = false;
    activeId.current = null;
    setActive(null);
    setQpayPaid(false);
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

  const onQpay = useCallback(() => {
    const id = activeId.current;
    if (!id) return;
    setQpayPaid(true);
    try { localStorage.setItem(QPAY_KEY(id), "1"); } catch { /* ignore */ }
  }, []);
  useQpaySignal(active && isLive(active.status) ? active.id : null, onQpay);

  async function act(id: string, action: string) {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа");
      if (action === "cash" || action === "finish") {
        loadSeq.current += 1;
        closedByMe.current = true;
        activeId.current = null;
        setActive(null);
        setQpayPaid(false);
        setNote("Аялал хаагдлаа");
        try { localStorage.removeItem(QPAY_KEY(id)); } catch { /* ignore */ }
      } else if (data.ride) {
        activeId.current = data.ride.id;
        setActive(data.ride);
      }
      await loadOpen();
    } catch (e) {
      setErr(errText(e));
      await loadActive();
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
        body: JSON.stringify({ plate }),
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
  const pickupPt = active ? { lat: Number(active.pickup_lat), lng: Number(active.pickup_lng) } : null;
  const destPt = active ? { lat: Number(active.dest_lat), lng: Number(active.dest_lng) } : null;
  const approach = active?.status === "accepted" && pickupPt && approachHint
    ? { id: active.id, to: pickupPt, hint: approachHint }
    : null;
  const carAt = active?.status === "arrived" && pickupPt ? pickupPt : (!approach ? (pos || DARKHAN_CENTER) : null);

  let heading = "Шинэ дуудлага";
  if (needsPlate && !active) heading = "Машины дугаар";
  else if (waiting && !active) heading = "Зөвшөөрөл хүлээгдэж байна";
  else if (active?.status === "accepted") heading = "Зорчигч руу";
  else if (active?.status === "arrived") heading = qpayPaid ? "QPay төлөгдсөн" : "Зорчигчтой";
  else if (!active && open.length === 0) heading = "Шинэ дуудлага алга";

  return (
    <div style={{ height: "100dvh", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", left: 12, zIndex: 20 }} className="pill">
        Жолооч
      </div>
      {user && (
        <div style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", right: 12, zIndex: 20 }}>
          <AccountMenu phone={user.phone} name={user.name} />
        </div>
      )}
      <TaxiMap
        pickup={pickupPt}
        dest={destPt}
        driver={carAt}
        approach={approach}
      />
      <div className="sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, maxHeight: "48vh", overflow: "auto" }}>
        <div className="handle" />
        {!ready && <div style={{ fontWeight: 800, fontSize: 22 }}>Ачаалж байна…</div>}
        {ready && <div style={{ fontSize: 26, fontWeight: 800 }} aria-live="polite">{heading}</div>}
        {storedPlate && plateOk(storedPlate) && (
          <div className="small" style={{ marginTop: 4 }}>{user?.driver?.car_model || "Машин"} · {storedPlate}</div>
        )}
        {note && <div style={{ marginTop: 8, fontWeight: 700 }}>{note}</div>}
        {err && <div style={{ color: "#B42318", marginTop: 8, fontWeight: 700 }}>{err}</div>}

        {ready && needsPlate && !active && (
          <form onSubmit={savePlate} style={{ marginTop: 12 }}>
            <label className="label" htmlFor="plate">Дугааргүйгээр дуудлага авахгүй</label>
            <input
              id="plate"
              value={plate}
              autoComplete="off"
              enterKeyHint="done"
              placeholder="1234 УБА"
              onChange={(e) => setPlate(e.target.value)}
              style={{ width: "100%", height: 64, fontSize: 24, fontWeight: 800, borderRadius: 16, border: "2px solid #0B2545", padding: "0 16px" }}
            />
            <button className="btn cta" style={{ marginTop: 14 }} type="submit" disabled={busy || !plate.trim()}>
              Хадгалах
            </button>
          </form>
        )}

        {ready && waiting && !active && (
          <div className="small" style={{ marginTop: 10 }}>Админ зөвшөөрсний дараа дуудлага авна.</div>
        )}

        {ready && !needsPlate && !waiting && active && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 800 }}>{active.pickup_label || "Авах"} → {active.dest_label || "Очих"}</div>
            <div style={{ marginTop: 6, fontWeight: 800, fontSize: 22 }}>
              {tugrik(fareOf(active))} · {Number(active.distance_km).toFixed(1)} км
            </div>
            {qpayPaid && <div className="small" style={{ marginTop: 6 }}>Зорчигч QPay-ээр бүртгүүлсэн. Бэлэн бүү ав.</div>}
            {active.status === "accepted" && (
              <button className="btn cta" style={{ marginTop: 14 }} disabled={busy} onClick={() => { void act(active.id, "arrived"); }}>
                Ирлээ
              </button>
            )}
            {active.status === "arrived" && (
              <button
                className="btn cta"
                style={{ marginTop: 14 }}
                disabled={busy}
                onClick={() => { void act(active.id, qpayPaid ? "finish" : "cash"); }}
              >
                {qpayPaid ? "Дуусгах" : "Бэлнээр авсан"}
              </button>
            )}
            {active.status === "accepted" && (
              <div className="small" style={{ marginTop: 8 }}>Цуцлахыг зорчигч хийнэ.</div>
            )}
          </div>
        )}

        {ready && !needsPlate && !waiting && !active && (
          <div style={{ marginTop: 12 }}>
            {open.length === 0 && <div className="small">Газрын зураг дээр хүлээнэ.</div>}
            {open.map((r) => (
              <div key={r.id} style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800 }}>{r.dest_label || "Очих газар"}</div>
                <div className="small">{Number(r.distance_km).toFixed(1)} км · {tugrik(fareOf(r))}</div>
                <button className="btn cta" style={{ marginTop: 10, height: 64, fontSize: 22 }} disabled={busy} onClick={() => { void act(r.id, "accept"); }}>
                  Зөвшөөрөх
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
