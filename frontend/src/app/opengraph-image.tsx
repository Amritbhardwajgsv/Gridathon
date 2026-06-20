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
          background: "#08080F",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 72px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,230,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,230,0,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Yellow accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "#FFE600",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", zIndex: 1 }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "#FFE600",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                border: "3px solid #08080F",
                borderRadius: "50%",
                borderTopColor: "transparent",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                color: "#FFE600",
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
                color: "#444455",
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
              border: "2px solid rgba(255,230,0,0.3)",
              borderRadius: "999px",
              padding: "6px 16px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                background: "#FFE600",
                borderRadius: "50%",
              }}
            />
            <span style={{ color: "#FFE600", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em" }}>
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
              color: "#F0F0F8",
              textTransform: "uppercase",
            }}
          >
            <span style={{ display: "block" }}>AI sees</span>
            <span style={{ display: "block", color: "#FFE600" }}>the signal.</span>
            <span style={{ display: "block" }}>Teams move.</span>
          </div>

          <p
            style={{
              marginTop: "28px",
              fontSize: "20px",
              color: "#8888A0",
              lineHeight: 1.6,
              maxWidth: "680px",
            }}
          >
            Citizens report in plain language. DRISHTI extracts structured incident fields,
            predicts impact, and dispatches Bengaluru Police field officers automatically.
          </p>
        </div>

        {/* Stats row */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            gap: "16px",
            zIndex: 1,
          }}
        >
          {[
            { v: "NLP",  l: "Auto Extraction"    },
            { v: "AI",   l: "Impact Prediction"  },
            { v: "GPS",  l: "Officer Dispatch"   },
            { v: "24/7", l: "Police Workflow"    },
          ].map((s) => (
            <div
              key={s.l}
              style={{
                flex: 1,
                border: "2px solid #252535",
                borderRadius: "8px",
                padding: "16px",
                background: "#0F0F1A",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span style={{ color: "#FFE600", fontSize: "28px", fontWeight: 900, fontFamily: "monospace" }}>
                {s.v}
              </span>
              <span style={{ color: "#8888A0", fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", marginTop: "4px" }}>
                {s.l}
              </span>
            </div>
          ))}
        </div>

        {/* URL watermark */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            right: "72px",
            color: "#252535",
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
