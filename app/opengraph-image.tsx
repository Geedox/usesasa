import { ImageResponse } from "next/og";

export const alt = "Sasa — Apply to every job that fits you. Hands off.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div
            style={{
              width: "104px",
              height: "104px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "9px solid #000000",
              borderRadius: "22px",
              fontSize: "66px",
              fontWeight: 800,
              color: "#000000",
            }}
          >
            S
          </div>
          <div style={{ fontSize: "46px", fontWeight: 700, color: "#000000" }}>
            Sasa
          </div>
        </div>

        {/* Headline + subhead */}
        <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
          <div
            style={{
              fontSize: "74px",
              fontWeight: 800,
              color: "#0a0a0a",
              lineHeight: 1.05,
              maxWidth: "1000px",
            }}
          >
            Apply to every job that fits you. Hands off.
          </div>
          <div style={{ fontSize: "34px", color: "#555555", maxWidth: "1000px" }}>
            An AI agent that watches career pages, tailors your CV per role,
            applies from your browser, and pings you on WhatsApp.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", fontSize: "28px", fontWeight: 600, color: "#000000" }}>
          First 100 beta users get 50 free credits
        </div>
      </div>
    ),
    { ...size }
  );
}
