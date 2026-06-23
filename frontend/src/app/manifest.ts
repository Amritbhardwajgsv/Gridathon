import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DRISHTI — Bengaluru Police Traffic Operations",
    short_name: "DRISHTI",
    description:
      "AI-powered traffic operations platform for Bengaluru Police.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf6",
    theme_color: "#342018",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
