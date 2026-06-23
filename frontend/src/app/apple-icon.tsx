/* eslint-disable */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#ffd62f",
          borderRadius: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            color: "#342018",
            fontSize: 96,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: "sans-serif",
            display: "flex",
          }}
        >
          D
        </div>
        <div
          style={{
            color: "#795b4e",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 4,
            fontFamily: "sans-serif",
            display: "flex",
          }}
        >
          BTP
        </div>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
