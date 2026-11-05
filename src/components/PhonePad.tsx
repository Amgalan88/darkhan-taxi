"use client";

export function PhonePad({
  onDigit,
  onBack,
}: {
  onDigit: (d: string) => void;
  onBack: () => void;
}) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#D5DBE3",
        padding: 8,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {keys.map((k, i) => (
        <button
          key={i}
          type="button"
          disabled={k === ""}
          onClick={() => (k === "⌫" ? onBack() : k && onDigit(k))}
          style={{
            height: 56, minHeight: 56,
            background: k ? "#fff" : "transparent",
            border: "none",
            borderRadius: 10,
            fontSize: 28,
            fontWeight: 700,
            color: "#0B2545",
          }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
