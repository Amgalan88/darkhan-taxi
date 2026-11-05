"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PhonePad } from "@/components/PhonePad";
import { resolvePostLoginPath } from "@/lib/roles";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [existing, setExisting] = useState<{ phone: string; name: string; role: string } | null>(null);
  const [left, setLeft] = useState(30);

  useEffect(() => {
    if (step !== "code") return;
    setLeft(30);
    const t = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [step]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setExisting({ phone: d.user.phone, name: d.user.name, role: d.user.role });
      })
      .catch(() => {});
  }, []);

  async function clearSession() {
    await fetch("/api/auth/logout", { method: "POST" });
    setExisting(null);
  }

  async function requestOtp() {
    setErr("");
    if (phone.length !== 8) { setErr("8 оронтой дугаар оруулна уу"); return; }
    setBusy(true);
    try {
      // Drop previous account so the new login cookie is the only session.
      if (existing) await clearSession();
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Алдаа");
      setStep("code");
      setCode("");
      setLeft(30);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setErr("");
    if (code.length < 4) { setErr("Код оруулна уу"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Алдаа");
      const path = resolvePostLoginPath(data.user?.role, next);
      // Hard navigation so the new session cookie is always picked up.
      window.location.assign(path);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const activeLen = step === "phone" ? phone.length : code.length;
  const max = step === "phone" ? 8 : 4;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", paddingBottom: 200 }}>
      <div className="top">
        <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>DMAP</div>
      </div>
      <div style={{ padding: "28px 24px" }}>
        {existing && step === "phone" && (
          <div className="card" style={{ background: "#fff", border: "2px solid #D5DBE3", marginBottom: 20 }}>
            <div className="small">Одоо нэвтэрсэн</div>
            <div style={{ fontWeight: 800 }}>{existing.name || existing.phone}</div>
            <div className="small">+976 {existing.phone} · {existing.role}</div>
            <button
              type="button"
              className="btn sec"
              style={{ marginTop: 12, height: 56 }}
              onClick={async () => {
                await clearSession();
              }}
            >
              Гарах
            </button>
            <button
              type="button"
              className="btn cta"
              style={{ marginTop: 10, height: 56, fontSize: 20 }}
              onClick={() => { window.location.assign(resolvePostLoginPath(existing.role, next)); }}
            >
              Үргэлжлүүлэх
            </button>
          </div>
        )}

        {step === "phone" ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {existing ? "Өөр дугаараар нэвтрэх" : "Утасны дугаараа оруулна уу"}
            </div>
            <div className="small" style={{ marginTop: 8 }}>Бид танд SMS код илгээнэ</div>
            <div className="field" style={{ marginTop: 28, height: 76, fontSize: 30, borderColor: "#0B2545", borderWidth: 3 }}>
              <span style={{ borderRight: "2px solid #D5DBE3", paddingRight: 14 }}>+976</span>
              <span style={{ letterSpacing: 2 }}>{phone || "········"}</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28, fontWeight: 800 }}>SMS код оруулна уу</div>
            <div className="small" style={{ marginTop: 8 }}>
              +976 {phone.slice(0, 4)} •••• · демо код 1234
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, height: 76, borderRadius: 16, background: "#fff",
                    border: `3px solid ${i === code.length ? "#0B2545" : "#D5DBE3"}`,
                    fontSize: 36, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {code[i] || ""}
                </div>
              ))}
            </div>
          </>
        )}
        {err && <div style={{ color: "#B42318", marginTop: 12, fontWeight: 700 }}>{err}</div>}
        <button
          className="btn cta"
          style={{ marginTop: 28 }}
          disabled={busy || activeLen < max}
          onClick={() => (step === "phone" ? requestOtp() : verify())}
        >
          Үргэлжлүүлэх
        </button>
        {step === "code" && (
          <>
            <button
              type="button"
              className="btn sec"
              disabled={left > 0 || busy}
              onClick={() => { void requestOtp(); }}
            >
              {left > 0 ? `Дахин илгээх · ${left}с` : "Дахин илгээх"}
            </button>
            <button
              type="button"
              className="btn sec"
              onClick={() => { setStep("phone"); setCode(""); }}
            >
              Дугаар солих
            </button>
          </>
        )}
      </div>
      <PhonePad
        onDigit={(d) => {
          if (step === "phone") {
            setPhone((p) => (p.length >= 8 ? p : p + d));
          } else {
            setCode((c) => (c.length >= 4 ? c : c + d));
          }
        }}
        onBack={() => {
          if (step === "phone") setPhone((p) => p.slice(0, -1));
          else setCode((c) => c.slice(0, -1));
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Ачаалж байна…</div>}>
      <LoginInner />
    </Suspense>
  );
}
