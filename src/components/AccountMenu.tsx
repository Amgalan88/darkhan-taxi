"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  phone?: string;
  name?: string;
  /** light text on navy header */
  light?: boolean;
  /** frosted white chip over a map */
  glass?: boolean;
};

export function AccountMenu({ phone, name, light, glass }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function logout() {
    setOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    window.location.assign("/login");
  }

  const fg = light ? "#fff" : "#0B2545";
  const bg = light ? "rgba(255,255,255,.15)" : glass ? "rgba(255,255,255,0.88)" : "#fff";
  const border = light ? "rgba(255,255,255,.35)" : "#D5DBE3";

  return (
    <div ref={ref} style={{ position: "relative", zIndex: 40 }}>
      <button
        type="button"
        aria-label="Профайл"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 44, height: 44, borderRadius: 22,
          border: `2px solid ${border}`,
          background: bg, color: fg,
          backdropFilter: glass ? "blur(8px)" : undefined,
          WebkitBackdropFilter: glass ? "blur(8px)" : undefined,
          fontWeight: 800, fontSize: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {(name || phone || "?")[0]}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: 52,
            minWidth: 200, background: "#fff", color: "#0B2545",
            borderRadius: 16, boxShadow: "0 8px 24px rgba(11,37,69,.2)",
            border: "1px solid #D5DBE3", overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #D5DBE3" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{name || "Хэрэглэгч"}</div>
            {phone && <div style={{ fontSize: 14, color: "#4A5568", marginTop: 2 }}>+976 {phone}</div>}
          </div>
          <button
            type="button"
            onClick={logout}
            style={{
              width: "100%", textAlign: "left", padding: "14px 14px",
              border: "none", background: "#fff", fontWeight: 800, fontSize: 18,
              color: "#B42318", minHeight: 56,
            }}
          >
            Гарах
          </button>
        </div>
      )}
    </div>
  );
}
