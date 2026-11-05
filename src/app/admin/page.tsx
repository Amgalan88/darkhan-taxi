"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tugrik } from "@/lib/format";

type Trip = {
  id: string; status: string; price: number; distance_km: number;
  passenger_phone: string; passenger_name: string;
  driver_phone?: string; driver_name?: string;
  dest_label: string; created_at: string;
};
type Driver = {
  user_id: string; phone: string; name: string; approved: boolean;
  car_model: string; plate: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"trips" | "drivers" | "tariff">("trips");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [base, setBase] = useState(3000);
  const [perKm, setPerKm] = useState(1000);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const [t, d, tar] = await Promise.all([
      fetch("/api/admin/trips").then((r) => r.json()),
      fetch("/api/admin/drivers").then((r) => r.json()),
      fetch("/api/admin/tariff").then((r) => r.json()),
    ]);
    if (t.trips) setTrips(t.trips);
    if (t.error) setErr(t.error);
    if (d.drivers) setDrivers(d.drivers);
    if (tar.tariff) {
      setBase(tar.tariff.base_fare);
      setPerKm(tar.tariff.per_km);
    }
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.replace("/login?next=/admin"); return; }
      if (d.user.role !== "admin") { router.replace("/"); return; }
      load();
    });
  }, [router]);

  async function approve(user_id: string, approved: boolean) {
    await fetch("/api/admin/drivers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, approved }),
    });
    setMsg(approved ? "Жолооч зөвшөөрсөн" : "Цуцлагдсан");
    load();
  }

  async function saveTariff() {
    const res = await fetch("/api/admin/tariff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_fare: base, per_km: perKm }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || "Алдаа"); return; }
    setMsg("Тариф хадгаллаа (placeholder — админ өөрчилж болно)");
    load();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F6F9" }}>
      <div className="top">
        <div style={{ fontSize: 28, fontWeight: 800 }}>Админ · Дархан Такси</div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: 16 }}>
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
              flex: 1, height: 48, borderRadius: 14, border: "none", fontWeight: 800,
              background: tab === k ? "#FFC300" : "#fff", color: "#0B2545",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ padding: "0 16px 32px" }}>
        {msg && <div style={{ background: "#E8F5E9", padding: 12, borderRadius: 12, marginBottom: 12 }}>{msg}</div>}
        {err && <div style={{ color: "#B42318", marginBottom: 12 }}>{err}</div>}

        {tab === "trips" && (
          <div>
            {trips.length === 0 && <div>Аялал алга</div>}
            {trips.map((t) => (
              <div key={t.id} className="card" style={{ background: "#fff", marginBottom: 10, border: "1px solid #D5DBE3" }}>
                <div style={{ fontWeight: 800 }}>{t.dest_label || "—"} · {t.status}</div>
                <div className="small">{t.passenger_name} ({t.passenger_phone})</div>
                <div className="small">Жолооч: {t.driver_name || "—"} ({t.driver_phone || "—"})</div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>{tugrik(t.price)} · {Number(t.distance_km).toFixed(1)} км</div>
              </div>
            ))}
          </div>
        )}

        {tab === "drivers" && (
          <div>
            {drivers.map((d) => (
              <div key={d.user_id} className="card" style={{ background: "#fff", marginBottom: 10, border: "1px solid #D5DBE3" }}>
                <div style={{ fontWeight: 800 }}>{d.name} · {d.phone}</div>
                <div className="small">{d.car_model} · {d.plate}</div>
                <div className="small" style={{ marginTop: 4 }}>{d.approved ? "Зөвшөөрсөн" : "Хүлээгдэж буй"}</div>
                <button
                  className="btn cta"
                  style={{ marginTop: 10, height: 56, fontSize: 20 }}
                  onClick={() => approve(d.user_id, !d.approved)}
                >
                  {d.approved ? "Цуцлах" : "Зөвшөөрөх"}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "tariff" && (
          <div className="card" style={{ background: "#fff" }}>
            <div className="small" style={{ marginBottom: 8 }}>Үндсэн үнэ (₮) — placeholder</div>
            <input
              type="number"
              value={base}
              onChange={(e) => setBase(Number(e.target.value))}
              style={{ width: "100%", height: 64, fontSize: 24, fontWeight: 700, borderRadius: 16, border: "2px solid #D5DBE3", padding: "0 16px" }}
            />
            <div className="small" style={{ margin: "16px 0 8px" }}>Км тутам (₮)</div>
            <input
              type="number"
              value={perKm}
              onChange={(e) => setPerKm(Number(e.target.value))}
              style={{ width: "100%", height: 64, fontSize: 24, fontWeight: 700, borderRadius: 16, border: "2px solid #D5DBE3", padding: "0 16px" }}
            />
            <button className="btn cta" style={{ marginTop: 20 }} onClick={saveTariff}>Хадгалах</button>
          </div>
        )}
      </div>
    </div>
  );
}
