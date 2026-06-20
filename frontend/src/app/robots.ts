import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/citizen/grievance", "/citizen/track", "/citizen/predict"],
        disallow: ["/dashboard/", "/login", "/register", "/api/"],
      },
    ],
    sitemap: "https://drishti-ex4s.onrender.com/sitemap.xml",
  };
}
