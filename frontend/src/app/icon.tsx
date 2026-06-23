/* eslint-disable */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#ffd62f",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#342018",
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: "sans-serif",
            display: "flex",
          }}
        >
          D
        </div>
      </div>
    ),
    { width: 32, height: 32 }
  );
}
