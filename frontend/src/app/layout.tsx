import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { ReactNode } from "react";

import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = "https://drishti-ex4s.onrender.com";
const SITE_NAME = "DRISHTI — Bengaluru Police Traffic Operations";
const SITE_DESC =
  "AI-powered traffic operations platform for Bengaluru Police. Citizens report incidents in plain language; DRISHTI extracts structured data, predicts impact, and dispatches field officers automatically.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: "%s | DRISHTI · BTP",
  },
  description: SITE_DESC,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DRISHTI",
  },
  keywords: [
    "Bengaluru traffic",
    "Bangalore police",
    "traffic complaint",
    "traffic operations",
    "DRISHTI",
    "BTP",
    "smart city",
    "traffic management",
    "citizen grievance",
    "traffic incident report",
    "AI traffic",
    "resource deployment",
  ],
  authors: [{ name: "Bengaluru Traffic Police — DRISHTI Team" }],
  creator: "DRISHTI — BTP Traffic Ops",
  publisher: "Bengaluru Traffic Police",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESC,
    creator: "@blr_traffic_pol",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body className="font-grotesk" suppressHydrationWarning>{children}</body>
    </html>
  );
}
