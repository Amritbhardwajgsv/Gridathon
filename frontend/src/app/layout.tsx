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

export const metadata: Metadata = {
  title: "DRISHTI",
  description:
    "Event impact, deployment planning, and citizen signal triage for Bengaluru traffic operations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body className="font-grotesk" suppressHydrationWarning>{children}</body>
    </html>
  );
}
