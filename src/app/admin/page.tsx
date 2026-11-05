"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tugrik } from "@/lib/format";
import { AccountMenu } from "@/components/AccountMenu";
import { fareOf, type Ride } from "@/lib/ride";

const TaxiMap = dynamic(() => import("@/components/Map"), { ssr: false });

type Driver = {
  user_id: string;
  phone: string;
  name: string;
  approved: boolean;
  car_model: string;
  plate: string;
  lat?: number | null;
  lng?: number | null;
};

function payLabel(method?: string | null): string {
  if (method === "qpay") return "QPay";
  if (method === "cash") return "Бэлэн";
  return "";
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ phone: string; name: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"trips" | "drivers" | "tariff">("trips");
  const [trips, setTrips] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [base, setBase] = useState(3000);
  const [perKm, setPerKm] = useState(1000);
  const [pct, setPct] = useState(10);
  const [credits, setCredits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const [t, d, tar, com, cred] = await Promise.all([
      fetch("/api/admin/trips").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/drivers").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/tariff").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/commission").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/credit").then((r) => r.json()).catch(() => ({})),
    ]);
    if (t.trips) setTrips(t.trips);
    if (t.error) setErr(t.error);
    if (d.drivers) setDrivers(d.drivers);
    if (d.error) setErr(d.error);
    if (tar.tariff) {
      setBase(tar.tariff.base_fare);
      setPerKm(tar.tariff.per_km);
    }
    if (typeof com.commissionPct === "number") setPct(com.commissionPct);
    if (cred.balances) {
      const next: Record<string, string> = {};
      for (const [id, n] of Object.entries(cred.balances as Record<string, number>)) next[id] = String(n);
      setCredits((prev) => ({ ...next, ...prev }));
    }
  }

  async function saveCommission() {
    setErr("");
    const res = await fetch("/api/admin/commission", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commission_pct: pct }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || "Алдаа"); return; }
    setMsg("Шимтгэл хадгаллаа");
    if (typeof data.commissionPct === "number") setPct(data.commissionPct);
  }

  async function saveCredit(userId: string) {
    setErr("");
    const res = await fetch("/api/admin/credit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, balance: Number(credits[userId] || 0) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || "Алдаа"); return; }
    setMsg("Кредит засагдлаа");
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.replace("/login?next=/admin"); return; }
      if (d.user.role !== "admin") { router.replace("/login?next=/admin"); return; }
      setUser(d.user);
      setReady(true);
      void load();
    }).catch(() => setReady(true));
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setInterval(() => { void load(); }, 8000);
    return () => window.clearInterval(t);
  }, [ready]);

  async function approve(user_id: string, approved: boolean) {
    setErr("");
    const res = await fetch("/api/admin/drivers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, approved }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || "Алдаа"); return; }
    setMsg(approved ? "Жолооч зөвшөөрсөн" : "Цуцлагдсан");
    void load();
  }

  async function saveTariff() {
    setErr("");
    const res = await fetch("/api/admin/tariff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_fare: base, per_km: perKm }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || "Алдаа"); return; }
    setMsg("Тариф хадгаллаа");
    void load();
  }

  const trip = trips.find((t) => t.id === selected) || null;
  const cars = drivers
    .filter((d) => d.lat != null && d.lng != null && Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)))
    .map((d) => ({ id: d.user_id, lat: Number(d.lat), lng: Number(d.lng) }));

  return (
    <div style={{ height: "100dvh", position: "relative", overflow: "hidden" }}>
      <div className="pill" style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", left: 12, zIndex: 20 }}>
        Админ
      </div>
      {user && (
        <div style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", right: 12, zIndex: 20 }}>
          <AccountMenu phone={user.phone} name={user.name} light={false} />
        </div>
      )}
      <TaxiMap
        pickup={trip ? { lat: Number(trip.pickup_lat), lng: Number(trip.pickup_lng) } : null}
        dest={trip ? { lat: Number(trip.dest_lat), lng: Number(trip.dest_lng) } : null}
        cars={cars}
      />
      <div className="sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, maxHeight: "46vh", overflow: "auto" }}>
        <div className="handle" />
        <div style={{ display: "flex", gap: 8 }}>
          {([
            ["trips", "Аялал"],
            ["drivers", "Жолооч"],
            ["tariff", "Тариф"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                flex: 1, height: 44, borderRadius: 12, border: "none", fontWeight: 800,
                background: tab === k ? "#FFC300" : "#F4F6F9", color: "#0B2545",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {msg && <div style={{ marginTop: 10, fontWeight: 700 }}>{msg}</div>}
        {err && <div style={{ color: "#B42318", marginTop: 8 }}>{err}</div>}
        {!ready && <div style={{ marginTop: 12, fontWeight: 800 }}>Ачаалж байна…</div>}

        {ready && tab === "trips" && (
          <div style={{ marginTop: 12 }}>
            {trips.length === 0 && <div>Аялал алга</div>}
            {trips.filter((t) => {
              const label = t.dest_label || "";
              return !(label.startsWith("ТӨЛБӨР|") || label.startsWith("ТӨЛСӨН|") || label.startsWith("КРЕДИТ|") || label.startsWith("ШИМТГЭЛ|"));
            }).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id === selected ? null : t.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left", marginBottom: 8,
                  background: t.id === selected ? "#FFF8E0" : "#fff",
                  border: t.id === selected ? "2px solid #0B2545" : "1px solid #D5DBE3",
                  borderRadius: 14, padding: "10px 12px",
                }}
              >
                <div style={{ fontWeight: 800 }}>{t.dest_label || "—"} · {t.status}</div>
                <div className="small">{t.passenger_name || "Зорчигч"} · {t.driver_name || "Жолоочгүй"}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {tugrik(fareOf(t))} · {Number(t.distance_km).toFixed(1)} км
                  {payLabel(t.payment_method) ? ` · ${payLabel(t.payment_method)}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}

        {ready && tab === "drivers" && (
          <div style={{ marginTop: 12 }}>
            {drivers.length === 0 && <div>Жолооч алга</div>}
            {drivers.map((d) => (
              <div key={d.user_id} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 800 }}>{d.name || "Жолооч"} · {d.plate || "дугааргүй"}</div>
                <div className="small">{d.phone} · {d.car_model || "Машин"} · {d.plate || "дугааргүй"} · {d.approved ? "Зөвшөөрсөн" : "Хүлээгдэж буй"}</div>
                <label className="label" htmlFor={`cr-${d.user_id}`} style={{ display: "block", marginTop: 8 }}>Кредит (₮)</label>
                <input
                  id={`cr-${d.user_id}`}
                  type="number"
                  value={credits[d.user_id] ?? "0"}
                  onChange={(e) => setCredits((prev) => ({ ...prev, [d.user_id]: e.target.value }))}
                  style={{ width: "100%", height: 56, fontSize: 22, fontWeight: 800, borderRadius: 16, border: "2px solid #D5DBE3", padding: "0 16px" }}
                />
                <button type="button" className="btn sec" onClick={() => { void saveCredit(d.user_id); }}>Кредит хадгалах</button>
                <button
                  type="button"
                  className="btn cta"
                  style={{ marginTop: 8, height: 56, fontSize: 20 }}
                  onClick={() => { void approve(d.user_id, !d.approved); }}
                >
                  {d.approved ? "Зөвшөөрөл хасах" : "Зөвшөөрөх"}
                </button>
              </div>
            ))}
          </div>
        )}

        {ready && tab === "tariff" && (
          <div style={{ marginTop: 12 }}>
            <div className="small">Зорчигчид зөвхөн нийт үнэ харагдана.</div>
            <label className="label" htmlFor="base" style={{ display: "block", marginTop: 12 }}>Эхлэх үнэ (₮)</label>
            <input
              id="base"
              type="number"
              value={base}
              onChange={(e) => setBase(Number(e.target.value))}
              style={{ width: "100%", height: 64, fontSize: 24, fontWeight: 700, borderRadius: 16, border: "2px solid #D5DBE3", padding: "0 16px" }}
            />
            <label className="label" htmlFor="perkm" style={{ display: "block", marginTop: 12 }}>1 км-ийн үнэ (₮)</label>
            <input
              id="perkm"
              type="number"
              value={perKm}
              onChange={(e) => setPerKm(Number(e.target.value))}
              style={{ width: "100%", height: 64, fontSize: 24, fontWeight: 700, borderRadius: 16, border: "2px solid #D5DBE3", padding: "0 16px" }}
            />
            <label className="label" htmlFor="pct" style={{ display: "block", marginTop: 12 }}>Жолоочийн шимтгэл (%)</label>
            <input
              id="pct"
              type="number"
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              style={{ width: "100%", height: 64, fontSize: 24, fontWeight: 700, borderRadius: 16, border: "2px solid #D5DBE3", padding: "0 16px" }}
            />
            <div className="small" style={{ marginTop: 8 }}>Зорчигчид харагдахгүй. Анхны утга 10%.</div>
            <button className="btn sec" type="button" onClick={() => { void saveCommission(); }}>Шимтгэл хадгалах</button>
            <button className="btn cta" style={{ marginTop: 12 }} type="button" onClick={() => { void saveTariff(); }}>Хадгалах</button>
          </div>
        )}
      </div>
    </div>
  );
}
