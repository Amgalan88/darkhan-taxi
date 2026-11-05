"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DARKHAN_CENTER, approachFrom, nearDarkhan } from "@/lib/geo";
import { tugrik } from "@/lib/format";
import { supabasePublic } from "@/lib/supabase";
import { AccountMenu } from "@/components/AccountMenu";
import { useQpaySignal } from "@/lib/useQpaySignal";
import { QPAY_KEY, RIDE_KEY, fareOf, isLive, type DriverInfo, type Ride } from "@/lib/ride";

const TaxiMap = dynamic(() => import("@/components/Map"), { ssr: false });

type User = { id: string; phone: string; name: string; role: string };

function errText(e: unknown): string {
  const m = (e as Error).message || "Алдаа";
  if (m === "Failed to fetch") return "Холболт тасарлаа. Дахин оролдоно уу.";
  return m;
}

export default function PassengerHome() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [pickup, setPickup] = useState<{ lat: number; lng: number }>(DARKHAN_CENTER);
  const [dest, setDest] = useState<{ lat: number; lng: number } | null>(null);
  const [destLabel, setDestLabel] = useState("");
  const [quote, setQuote] = useState<{ price: number; distance_km: number; eta_min: number } | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [qpayPaid, setQpayPaid] = useState(false);
  const [qpayNote, setQpayNote] = useState("");
  const [qpayAsk, setQpayAsk] = useState(false);
  const [approachHint, setApproachHint] = useState<{ lat: number; lng: number } | null>(null);
  const quoteSeq = useRef(0);
  const approachFor = useRef<string | null>(null);
  const liveRef = useRef(false);
  liveRef.current = Boolean(ride && isLive(ride.status));

  const clearLocal = useCallback((id?: string | null) => {
    try {
      sessionStorage.removeItem(RIDE_KEY);
      if (id) localStorage.removeItem(QPAY_KEY(id));
    } catch { /* ignore */ }
  }, []);

  const reset = useCallback((message = "") => {
    setRide((prev) => {
      clearLocal(prev?.id);
      return null;
    });
    setDriver(null);
    setDest(null);
    setQuote(null);
    setQpayPaid(false);
    setQpayNote("");
    setQpayAsk(false);
    setErr("");
    setNote(message);
  }, [clearLocal]);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(""), 4000);
    return () => window.clearTimeout(t);
  }, [note]);

  useEffect(() => {
    let stop = false;
    fetch("/api/auth/me").then((r) => r.json()).then(async (d) => {
      if (stop) return;
      if (!d.user) { router.replace("/login"); return; }
      if (d.user.role === "driver") { router.replace("/driver"); return; }
      if (d.user.role === "admin") { router.replace("/admin"); return; }
      setUser(d.user);
      try {
        const res = await fetch("/api/rides");
        const data = await res.json();
        if (data.ride && isLive(data.ride.status)) {
          adopt(data.ride, data.driver);
        } else {
          const saved = sessionStorage.getItem(RIDE_KEY);
          if (saved) {
            const g = await fetch(`/api/rides/${saved}`);
            const gd = await g.json();
            const r = gd.ride as Ride | undefined;
            const age = r?.updated_at ? Date.now() - new Date(r.updated_at).getTime() : Infinity;
            if (r?.status === "completed" && age < 6 * 3600 * 1000) {
              setRide(r);
              setDriver(gd.driver || null);
              setDest({ lat: r.dest_lat, lng: r.dest_lng });
              setPickup({ lat: r.pickup_lat, lng: r.pickup_lng });
              if (localStorage.getItem(QPAY_KEY(r.id)) === "1") setQpayPaid(true);
            } else {
              sessionStorage.removeItem(RIDE_KEY);
            }
          }
        }
      } catch { /* home map still usable */ }
      if (!stop) setReady(true);
    }).catch(() => { if (!stop) setReady(true); });
    return () => { stop = true; };
  }, [router]);

  function adopt(r: Ride, drv?: DriverInfo | null) {
    setRide(r);
    if (drv) setDriver(drv);
    setPickup({ lat: Number(r.pickup_lat), lng: Number(r.pickup_lng) });
    setDest({ lat: Number(r.dest_lat), lng: Number(r.dest_lng) });
    setDestLabel(r.dest_label || "");
    let paid = false;
    try {
      sessionStorage.setItem(RIDE_KEY, r.id);
      paid = localStorage.getItem(QPAY_KEY(r.id)) === "1";
    } catch { /* ignore */ }
    setQpayPaid(paid);
  }

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!nearDarkhan(p) || liveRef.current) return;
        setPickup(p);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const refreshQuote = useCallback(async (p: { lat: number; lng: number }, d: { lat: number; lng: number }) => {
    const seq = ++quoteSeq.current;
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup_lat: p.lat, pickup_lng: p.lng, dest_lat: d.lat, dest_lng: d.lng }),
      });
      const data = await res.json().catch(() => ({}));
      if (seq !== quoteSeq.current) return;
      if (!res.ok) throw new Error(data.error || "Үнэ гарсангүй");
      setQuote({ price: data.price, distance_km: data.distance_km, eta_min: data.eta_min });
      setErr("");
    } catch (e) {
      if (seq !== quoteSeq.current) return;
      setQuote(null);
      setErr(errText(e));
    }
  }, []);

  const onPickDest = useCallback((lat: number, lng: number) => {
    if (ride) return;
    const d = { lat, lng };
    setDest(d);
    setDestLabel("Сонгосон цэг");
    void refreshQuote(pickup, d);
  }, [pickup, ride, refreshQuote]);

  useEffect(() => {
    if (!ride?.id || !isLive(ride.status)) return;
    const id = ride.id;
    let stop = false;
    const pull = async () => {
      try {
        const res = await fetch(`/api/rides/${id}`);
        const data = await res.json();
        if (stop || !data.ride) return;
        if (data.ride.status === "cancelled") {
          setRide(null);
          setDriver(null);
          setDest(null);
          setQuote(null);
          setQpayPaid(false);
          setQpayAsk(false);
          setNote("Аялал цуцлагдлаа");
          clearLocal(id);
          return;
        }
        setRide(data.ride);
        if (data.driver) setDriver(data.driver);
      } catch { /* keep the last good screen */ }
    };
    void pull();
    const sb = supabasePublic();
    const ch = sb
      .channel(`ride-${id}`)
      .on("postgres_changes", { event: "*", schema: "taxi", table: "rides", filter: `id=eq.${id}` }, () => { void pull(); })
      .subscribe();
    const poll = window.setInterval(() => { void pull(); }, 3000);
    return () => { stop = true; window.clearInterval(poll); sb.removeChannel(ch); };
  }, [ride?.id, ride?.status, clearLocal]);

  useEffect(() => {
    if (ride?.status !== "accepted" || !ride.pickup_lat) {
      approachFor.current = null;
      setApproachHint(null);
      return;
    }
    if (approachFor.current === ride.id) return;
    approachFor.current = ride.id;
    const gps = driver?.lat != null && driver.lng != null
      ? { lat: Number(driver.lat), lng: Number(driver.lng) }
      : null;
    setApproachHint(approachFrom(gps, { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) }));
  }, [ride?.status, ride?.id, ride?.pickup_lat, ride?.pickup_lng, driver?.lat, driver?.lng]);

  const announce = useQpaySignal(ride && isLive(ride.status) ? ride.id : null, () => {});
  useEffect(() => {
    if (!qpayPaid || ride?.status !== "arrived") return;
    announce();
    const t = window.setInterval(announce, 2000);
    return () => window.clearInterval(t);
  }, [qpayPaid, ride?.status, announce]);

  async function callTaxi() {
    if (!pickup || !dest || !quote || busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_label: "Таны байршил",
          dest_lat: dest.lat, dest_lng: dest.lng, dest_label: destLabel || "Очих газар",
          distance_km: quote.distance_km, price: quote.price, offered_price: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа");
      adopt(data.ride);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!ride || busy) return;
    if (!confirm("Дуудлагаа цуцлах уу?")) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/rides/${ride.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа");
      reset("Цуцлагдлаа");
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function payQpay() {
    if (!ride || busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/rides/${ride.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "qpay" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Алдаа");
      setQpayPaid(true);
      setQpayNote(data.message || "Туршилтын төлбөр.");
      setQpayAsk(false);
      try { localStorage.setItem(QPAY_KEY(ride.id), "1"); } catch { /* ignore */ }
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const live = Boolean(ride && isLive(ride.status));
  const done = ride?.status === "completed";
  const plate = driver?.plate || "";
  const phone = driver?.phone || "";
  const fare = ride ? fareOf(ride) : quote?.price || 0;

  let heading = "Хаашаа явах вэ?";
  if (ride?.status === "requested") heading = "Жолооч хайж байна…";
  else if (ride?.status === "accepted") heading = "Жолооч ирж байна";
  else if (ride?.status === "arrived") heading = qpayPaid ? "QPay бүртгэгдлээ" : "Жолооч ирлээ";
  else if (done) heading = qpayPaid ? "QPay-ээр төлөгдлөө" : "Аялал дууслаа";

  const approach = ride?.status === "accepted" && approachHint
    ? { id: ride.id, to: { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) }, hint: approachHint }
    : null;

  return (
    <div style={{ height: "100dvh", position: "relative", overflow: "hidden" }}>
      {user && (
        <div style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", right: 12, zIndex: 20 }}>
          <AccountMenu phone={user.phone} name={user.name} />
        </div>
      )}
      <TaxiMap
        pickup={pickup}
        dest={dest}
        driver={ride?.status === "arrived" ? { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) } : null}
        demoOrigin={done ? null : pickup}
        approach={approach}
        onPickDest={live || done ? undefined : onPickDest}
      />
      <div className="sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, maxHeight: "52vh", overflow: "auto" }}>
        <div className="handle" />
        {!ready && <div style={{ fontWeight: 800, fontSize: 22 }}>Ачаалж байна…</div>}
        {ready && <div style={{ fontSize: 26, fontWeight: 800 }} aria-live="polite">{heading}</div>}

        {ready && !ride && (
          <>
            <div className="field" style={{ marginTop: 12 }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#FFC300", border: "3px solid #0B2545", flex: "none" }} />
              <span>{dest ? (destLabel || "Сонгосон цэг") : "Газрын зураг дээр дарна уу"}</span>
            </div>
            {quote && (
              <div style={{ marginTop: 12, fontWeight: 800, fontSize: 22 }}>
                {tugrik(quote.price)} · {quote.distance_km} км · ≈ {quote.eta_min} мин
              </div>
            )}
          </>
        )}

        {driver && (live || done) && (ride?.status !== "requested") && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800 }}>{driver.name || "Жолооч"}</div>
            <div className="small">{[driver.car_color, driver.car_model].filter(Boolean).join(" · ") || "Машин"}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1, minHeight: 64, border: "3px solid #0B2545", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, background: "#fff" }}>
                {plate || "—"}
              </div>
              {phone && (
                <a className="btn green" style={{ flex: 1, height: 64, fontSize: 22, textDecoration: "none" }} href={`tel:+976${phone}`}>
                  Залгах
                </a>
              )}
            </div>
          </div>
        )}

        {ride && (live || done) && (
          <div style={{ marginTop: 10, fontWeight: 800, fontSize: 22 }}>{tugrik(fare)}</div>
        )}

        {qpayPaid && ride?.status === "arrived" && (
          <div className="small" style={{ marginTop: 8 }}>{qpayNote || "Туршилтын QPay. Жолооч дуусгана."}</div>
        )}
        {done && (
          <div className="small" style={{ marginTop: 8 }}>
            {qpayPaid ? (qpayNote || "Туршилтын QPay-ээр бүртгэгдлээ.") : "Жолооч бэлнээр авсан."}
          </div>
        )}
        {note && <div style={{ marginTop: 8, fontWeight: 700 }}>{note}</div>}
        {err && <div style={{ color: "#B42318", marginTop: 8, fontWeight: 700 }}>{err}</div>}

        {ready && !ride && quote && (
          <button className="btn cta" style={{ marginTop: 14 }} disabled={busy} onClick={() => { void callTaxi(); }}>
            Дуудах
          </button>
        )}

        {ride?.status === "arrived" && !qpayPaid && !qpayAsk && (
          <button className="btn cta" style={{ marginTop: 14 }} disabled={busy} onClick={() => { setErr(""); setQpayAsk(true); }}>
            QPay-ээр төлөх
          </button>
        )}
        {ride?.status === "arrived" && !qpayPaid && qpayAsk && (
          <>
            <div className="small" style={{ marginTop: 10 }}>Жинхэнэ QPay холболтгүй бол туршилтаар бүртгэнэ.</div>
            <button className="btn cta" style={{ marginTop: 10 }} disabled={busy} onClick={() => { void payQpay(); }}>
              Туршилтаар бүртгэх
            </button>
            <button type="button" className="quiet" onClick={() => setQpayAsk(false)}>Буцах</button>
          </>
        )}

        {done && (
          <button className="btn cta" style={{ marginTop: 14 }} onClick={() => reset("")}>Хаах</button>
        )}

        {live && !(qpayAsk && !qpayPaid) && (
          <button type="button" className="quiet" disabled={busy} onClick={() => { void cancel(); }}>Цуцлах</button>
        )}
      </div>
    </div>
  );
}
