"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tugrik } from "@/lib/format";
import { supabasePublic } from "@/lib/supabase";
import { AccountMenu } from "@/components/AccountMenu";

const TaxiMap = dynamic(() => import("@/components/Map"), { ssr: false });

type Ride = {
  id: string; status: string; price: number; distance_km: number;
  pickup_lat: number; pickup_lng: number; pickup_label: string;
  dest_lat: number; dest_lng: number; dest_label: string;
  offered_price?: number | null;
};

export default function DriverPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ phone: string; name: string } | null>(null);
  const [open, setOpen] = useState<Ride[]>([]);
  const [active, setActive] = useState<Ride | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadOpen() {
    const res = await fetch("/api/rides/open");
    const data = await res.json();
    if (res.ok) setOpen(data.rides || []);
    else setErr(data.error || "Алдаа");
  }

  async function loadActive() {
    const res = await fetch("/api/rides");
    const data = await res.json();
    if (data.ride) setActive(data.ride);
    else setActive(null);
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then(async (d) => {
      if (!d.user) { router.replace("/login?next=/driver"); return; }
      if (d.user.role !== "driver" && d.user.role !== "admin") {
        // Let them switch accounts instead of trapping on passenger home.
        router.replace("/login?next=/driver");
        return;
      }
      setUser(d.user);
      setReady(true);
      await loadOpen();
      await loadActive();
    });
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const pushLoc = (lat: number, lng: number) => {
      setPos({ lat, lng });
      fetch("/api/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      }).catch(() => {});
    };
    let watch = -1;
    if (navigator.geolocation) {
      watch = navigator.geolocation.watchPosition(
        (p) => pushLoc(p.coords.latitude, p.coords.longitude),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    }
    const sb = supabasePublic();
    const ch = sb
      .channel("driver-open")
      .on("postgres_changes", { event: "*", schema: "taxi", table: "rides" }, () => {
        loadOpen();
        loadActive();
      })
      .subscribe();
    const poll = setInterval(() => { loadOpen(); loadActive(); }, 4000);
    return () => {
      if (watch >= 0) navigator.geolocation.clearWatch(watch);
      sb.removeChannel(ch);
      clearInterval(poll);
    };
  }, [ready]);

  async function act(id: string, action: string) {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Алдаа");
      if (action === "complete") setActive(null);
      else setActive(data.ride);
      await loadOpen();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div style={{ padding: 24 }}>Ачаалж байна…</div>;

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20 }}>
        <AccountMenu phone={user?.phone} name={user?.name} />
      </div>
      <TaxiMap
        pickup={active ? { lat: active.pickup_lat, lng: active.pickup_lng } : pos}
        dest={active ? { lat: active.dest_lat, lng: active.dest_lng } : null}
        driver={pos}
      />
      <div className="sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, maxHeight: "55vh", overflow: "auto" }}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>Жолоочийн самбар</div>
        {err && <div style={{ color: "#B42318", marginTop: 8 }}>{err}</div>}

        {active ? (
          <div style={{ marginTop: 16 }}>
            <div className="card">
              <div className="small">Одоогийн аялал · {active.status}</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{active.pickup_label} → {active.dest_label}</div>
              <div className="big" style={{ marginTop: 8 }}>{tugrik(active.offered_price || active.price)}</div>
            </div>
            {active.status === "accepted" && (
              <button className="btn cta" style={{ marginTop: 14 }} disabled={busy} onClick={() => act(active.id, "arrived")}>
                Ирлээ
              </button>
            )}
            {(active.status === "accepted" || active.status === "arrived") && (
              <button className="btn green" style={{ marginTop: 12 }} disabled={busy} onClick={() => act(active.id, "complete")}>
                Дууслаа
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="small" style={{ marginBottom: 8 }}>Шинэ дуудлага</div>
            {open.length === 0 && <div style={{ fontWeight: 700 }}>Одоогоор хүсэлт алга</div>}
            {open.map((r) => (
              <div key={r.id} className="card" style={{ marginBottom: 12, background: "#fff", border: "2px solid #D5DBE3" }}>
                <div style={{ fontWeight: 800 }}>{r.dest_label || "Очих газар"}</div>
                <div className="small">{Number(r.distance_km).toFixed(1)} км · {tugrik(r.offered_price || r.price)}</div>
                <button className="btn cta" style={{ marginTop: 12, height: 60, fontSize: 22 }} disabled={busy} onClick={() => act(r.id, "accept")}>
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
