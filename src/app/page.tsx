"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DARKHAN_CENTER } from "@/lib/geo";
import { tugrik } from "@/lib/format";
import { supabasePublic } from "@/lib/supabase";
import { AccountMenu } from "@/components/AccountMenu";

const TaxiMap = dynamic(() => import("@/components/Map"), { ssr: false });

type User = { id: string; phone: string; name: string; role: string };
type DriverInfo = {
  name: string; phone: string; car_model: string; car_color: string; plate: string;
  lat?: number; lng?: number;
};
type Ride = {
  id: string; status: string; price: number; distance_km: number;
  pickup_lat: number; pickup_lng: number; pickup_label: string;
  dest_lat: number; dest_lng: number; dest_label: string;
  offered_price?: number | null;
};

export default function PassengerHome() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number } | null>(null);
  const [destLabel, setDestLabel] = useState("");
  const [quote, setQuote] = useState<{ price: number; distance_km: number; eta_min: number } | null>(null);
  const [offer, setOffer] = useState<number | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) router.replace("/login");
      else if (d.user.role === "driver") router.replace("/driver");
      else if (d.user.role === "admin") router.replace("/admin");
      else setUser(d.user);
    });
  }, [router]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPickup(DARKHAN_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPickup(DARKHAN_CENTER),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    fetch("/api/rides").then((r) => r.json()).then((d) => {
      if (d.ride) {
        setRide(d.ride);
        setDriver(d.driver);
        setPickup({ lat: d.ride.pickup_lat, lng: d.ride.pickup_lng });
        setDest({ lat: d.ride.dest_lat, lng: d.ride.dest_lng });
      }
    }).catch(() => {});
  }, []);

  const refreshQuote = useCallback(async (p: { lat: number; lng: number }, d: { lat: number; lng: number }) => {
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup_lat: p.lat, pickup_lng: p.lng, dest_lat: d.lat, dest_lng: d.lng }),
    });
    const data = await res.json();
    if (res.ok) {
      setQuote({ price: data.price, distance_km: data.distance_km, eta_min: data.eta_min });
      setOffer(data.price);
    }
  }, []);

  const onPickDest = useCallback((lat: number, lng: number) => {
    if (ride) return;
    const d = { lat, lng };
    setDest(d);
    setDestLabel("Сонгосон цэг");
    if (pickup) refreshQuote(pickup, d);
  }, [pickup, ride, refreshQuote]);

  useEffect(() => {
    if (!ride?.id) return;
    const sb = supabasePublic();
    const ch = sb
      .channel(`ride-${ride.id}`)
      .on("postgres_changes", { event: "*", schema: "taxi", table: "rides", filter: `id=eq.${ride.id}` }, async () => {
        const res = await fetch(`/api/rides/${ride.id}`);
        const data = await res.json();
        if (data.ride) {
          setRide(data.ride);
          setDriver(data.driver);
          if (data.ride.status === "completed") setDone(true);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "taxi", table: "drivers" }, async (payload) => {
        const row = payload.new as { user_id: string; lat: number; lng: number };
        if (driver && row.lat != null) {
          setDriver((prev) => prev ? { ...prev, lat: row.lat, lng: row.lng } : prev);
        }
        // refresh full ride payload for driver coords
        const res = await fetch(`/api/rides/${ride.id}`);
        const data = await res.json();
        if (data.driver) setDriver(data.driver);
      })
      .subscribe();
    const poll = setInterval(async () => {
      const res = await fetch(`/api/rides/${ride.id}`);
      const data = await res.json();
      if (data.ride) {
        setRide(data.ride);
        setDriver(data.driver);
        if (data.ride.status === "completed") setDone(true);
      }
    }, 5000);
    return () => { sb.removeChannel(ch); clearInterval(poll); };
  }, [ride?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function callTaxi() {
    if (!pickup || !dest || !quote) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_label: "Таны байршил",
          dest_lat: dest.lat, dest_lng: dest.lng, dest_label: destLabel || "Очих газар",
          distance_km: quote.distance_km, price: quote.price,
          offered_price: offer && offer !== quote.price ? offer : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Алдаа");
      setRide(data.ride);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!ride) return;
    if (!confirm("Цуцлах уу?")) return;
    await fetch(`/api/rides/${ride.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setRide(null); setDriver(null); setDone(false);
  }

  if (!user) return <div style={{ padding: 24 }}>Ачаалж байна…</div>;

  if (done && ride) {
    return (
      <div style={{ minHeight: "100dvh" }}>
        <div className="top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>Аялал дууслаа</div>
          <AccountMenu phone={user.phone} name={user.name} light />
        </div>
        <div style={{ padding: 20 }}>
          <div className="card" style={{ background: "#fff", border: "2px solid #D5DBE3" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="small">Хаанаас</span><b>{ride.pickup_label}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <span className="small">Хаашаа</span><b>{ride.dest_label}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <span className="small">Зай</span><b>{Number(ride.distance_km).toFixed(1)} км</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, borderTop: "2px solid #D5DBE3", paddingTop: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>Нийт</span>
              <span className="big">{tugrik(ride.offered_price || ride.price)}</span>
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, margin: "22px 0 12px" }}>Төлбөрийн хэлбэр</div>
          <div className="field" style={{ height: 80, fontSize: 24, opacity: 0.45 }}>
            QPay · удахгүй
          </div>
          <div className="field" style={{ height: 80, marginTop: 12, fontSize: 24, borderColor: "#0B2545", borderWidth: 3, background: "#FFF8E0" }}>
            Бэлнээр ✓
          </div>
          <button className="btn cta" style={{ marginTop: 26 }} onClick={() => {
            setDone(false); setRide(null); setDriver(null); setDest(null); setQuote(null);
          }}>
            Дууслаа
          </button>
        </div>
      </div>
    );
  }

  const active = ride && ["requested", "accepted", "arrived"].includes(ride.status);

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20 }}>
        <AccountMenu phone={user.phone} name={user.name} />
      </div>
      <TaxiMap
        pickup={pickup}
        dest={dest}
        driver={driver?.lat != null ? { lat: driver.lat!, lng: driver.lng! } : null}
        onPickDest={active ? undefined : onPickDest}
      />
      {!active && (
        <div className="sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10 }}>
          <div className="label">Хаашаа явах вэ?</div>
          <div className="field">
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#FFC300", border: "3px solid #0B2545", flex: "none" }} />
            {dest ? (destLabel || "Сонгосон цэг") : "Газрын зураг дээр дарна уу"}
          </div>
          {quote && (
            <>
              <div className="card" style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="small">Урьдчилсан үнэ</div>
                  <div className="big">{tugrik(quote.price)}</div>
                </div>
                <div className="small" style={{ textAlign: "right" }}>
                  ≈ {quote.eta_min} мин<br />{quote.distance_km} км
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Өөрөө үнэ<br />санал болгох</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" className="step" onClick={() => setOffer((o) => Math.max(500, (o || quote.price) - 500))}>−</button>
                  <div style={{ fontSize: 22, fontWeight: 800, minWidth: 88, textAlign: "center" }}>{tugrik(offer || quote.price)}</div>
                  <button type="button" className="step" onClick={() => setOffer((o) => (o || quote.price) + 500)}>+</button>
                </div>
              </div>
            </>
          )}
          {err && <div style={{ color: "#B42318", marginTop: 8 }}>{err}</div>}
          <button className="btn cta" style={{ marginTop: 18 }} disabled={!quote || busy} onClick={callTaxi}>
            Дуудах
          </button>
        </div>
      )}
      {active && ride && (
        <div className="sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10 }}>
          {ride.status === "requested" && (
            <div style={{ fontSize: 30, fontWeight: 800 }}>Жолооч хайж байна…</div>
          )}
          {ride.status === "accepted" && (
            <div style={{ fontSize: 30, fontWeight: 800 }}>Жолооч ирж байна</div>
          )}
          {ride.status === "arrived" && (
            <div style={{ fontSize: 30, fontWeight: 800 }}>Жолооч ирлээ</div>
          )}
          {driver && (
            <>
              <div style={{ display: "flex", gap: 14, marginTop: 16, alignItems: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0B2545", color: "#fff", fontSize: 26, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {(driver.name || "?")[0]}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{driver.name}</div>
                  <div className="small">{driver.car_model} · {driver.car_color}</div>
                </div>
              </div>
              <div className="card" style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="small">Улсын дугаар</span>
                <span style={{ fontSize: 30, fontWeight: 800, border: "3px solid #0B2545", borderRadius: 10, padding: "2px 12px", background: "#fff" }}>{driver.plate}</span>
              </div>
              <a className="btn green" style={{ marginTop: 18, textDecoration: "none" }} href={`tel:+976${driver.phone}`}>
                Залгах
              </a>
            </>
          )}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="small">Үнэ</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{tugrik(ride.offered_price || ride.price)}</div>
          </div>
          <button className="btn sec" onClick={cancel}>Цуцлах</button>
        </div>
      )}
    </div>
  );
}
