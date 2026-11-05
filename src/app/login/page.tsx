"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PhonePad } from "@/components/PhonePad";
import { Suspense } from "react";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function requestOtp() {
    setErr("");
    if (phone.length !== 8) { setErr("8 оронтой дугаар оруулна уу"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Алдаа");
      setStep("code");
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
      const role = data.user?.role;
      if (next !== "/") router.push(next);
      else if (role === "driver") router.push("/driver");
      else if (role === "admin") router.push("/admin");
      else router.push("/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const active = step === "phone" ? phone : code;
  const max = step === "phone" ? 8 : 4;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", paddingBottom: 200 }}>
      <div className="top">
        <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>Дархан Такси</div>
      </div>
      <div style={{ padding: "28px 24px" }}>
        {step === "phone" ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Утасны дугаараа оруулна уу</div>
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
              {[0,1,2,3].map((i) => (
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
          disabled={busy || active.length < (step === "phone" ? 8 : 4)}
          onClick={() => (step === "phone" ? requestOtp() : verify())}
        >
          Үргэлжлүүлэх
        </button>
        {step === "code" && (
          <button
            type="button"
            className="btn sec"
            onClick={() => { setStep("phone"); setCode(""); }}
          >
            Дугаар солих
          </button>
        )}
      </div>
      <PhonePad
        onDigit={(d) => {
          if (active.length >= max) return;
          if (step === "phone") setPhone(phone + d);
          else setCode(code + d);
        }}
        onBack={() => {
          if (step === "phone") setPhone(phone.slice(0, -1));
          else setCode(code.slice(0, -1));
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
