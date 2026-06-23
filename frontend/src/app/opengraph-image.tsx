/* eslint-disable */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DRISHTI — Bengaluru Police AI Traffic Operations Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#fffaf6",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 72px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Coral top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: "#f47f5f",
            display: "flex",
          }}
        />

        {/* Subtle dot pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(#f2d8ca 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
            opacity: 0.5,
            display: "flex",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", zIndex: 1 }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "#ffd62f",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                border: "3px solid #342018",
                borderRadius: "50%",
                display: "flex",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                color: "#342018",
                fontSize: "18px",
                fontWeight: 900,
                letterSpacing: "0.22em",
                lineHeight: 1,
              }}
            >
              DRISHTI
            </span>
            <span
              style={{
                color: "#a88778",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                marginTop: "4px",
              }}
            >
              BENGALURU POLICE · TRAFFIC OPS
            </span>
          </div>

          {/* Live badge */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: "2px solid #f2d8ca",
              borderRadius: "999px",
              padding: "6px 18px",
              background: "rgba(244,127,95,0.08)",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                background: "#f47f5f",
                borderRadius: "50%",
                display: "flex",
              }}
            />
            <span style={{ color: "#f47f5f", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em" }}>
              ACTIVE OPERATIONS
            </span>
          </div>
        </div>

        {/* Main headline */}
        <div style={{ marginTop: "52px", zIndex: 1, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ color: "#342018", display: "flex" }}>AI sees</span>
            <span style={{ color: "#f47f5f", display: "flex" }}>the signal.</span>
            <span style={{ color: "#342018", display: "flex" }}>Teams move.</span>
          </div>

          <p
            style={{
              marginTop: "28px",
              fontSize: "20px",
              color: "#795b4e",
              lineHeight: 1.6,
              maxWidth: "680px",
            }}
          >
            Citizens report in plain language. DRISHTI extracts structured incident fields,
            predicts impact, and dispatches Bengaluru Police field officers automatically.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ marginTop: "auto", display: "flex", gap: "16px", zIndex: 1 }}>
          <div style={{ flex: 1, border: "2px solid #f2d8ca", borderRadius: "8px", padding: "16px", background: "#fff0e8", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#f47f5f", fontSize: "28px", fontWeight: 900 }}>NLP</span>
            <span style={{ color: "#795b4e", fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", marginTop: "4px" }}>Auto Extraction</span>
          </div>
          <div style={{ flex: 1, border: "2px solid #f2d8ca", borderRadius: "8px", padding: "16px", background: "#fff0e8", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#f47f5f", fontSize: "28px", fontWeight: 900 }}>AI</span>
            <span style={{ color: "#795b4e", fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", marginTop: "4px" }}>Impact Prediction</span>
          </div>
          <div style={{ flex: 1, border: "2px solid #f2d8ca", borderRadius: "8px", padding: "16px", background: "#fff0e8", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#f47f5f", fontSize: "28px", fontWeight: 900 }}>GPS</span>
            <span style={{ color: "#795b4e", fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", marginTop: "4px" }}>Officer Dispatch</span>
          </div>
          <div style={{ flex: 1, border: "2px solid #f2d8ca", borderRadius: "8px", padding: "16px", background: "#fff0e8", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#f47f5f", fontSize: "28px", fontWeight: 900 }}>24/7</span>
            <span style={{ color: "#795b4e", fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", marginTop: "4px" }}>Police Workflow</span>
          </div>
        </div>

        {/* URL watermark */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            right: "72px",
            color: "#e8b9a1",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            zIndex: 1,
          }}
        >
          drishti-ex4s.onrender.com
        </div>
      </div>
    ),
    { ...size },
  );
}
