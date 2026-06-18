import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { ReactNode } from "react";

import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DRISHTI",
  description:
    "Event impact, deployment planning, and citizen signal triage for Bengaluru traffic operations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="font-roboto">{children}</body>
    </html>
  );
}
