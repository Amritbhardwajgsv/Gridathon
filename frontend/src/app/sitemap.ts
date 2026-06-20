import type { MetadataRoute } from "next";

const BASE = "https://drishti-ex4s.onrender.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                             lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/citizen/grievance`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/citizen/track`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/citizen/predict`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
