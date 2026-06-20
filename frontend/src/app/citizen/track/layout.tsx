import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Track Your Complaint",
  description:
    "Enter your DRISHTI complaint tracking ID to see the real-time status of your traffic incident report — from submission through police review, dispatch, and resolution.",
  keywords: ["track traffic complaint", "complaint status Bengaluru", "DRISHTI tracking", "police complaint status"],
  alternates: { canonical: "https://drishti-ex4s.onrender.com/citizen/track" },
  openGraph: {
    title: "Track Your Complaint | DRISHTI · Bengaluru Police",
    description:
      "Check the live status of your traffic incident report. See when police reviewed it, who was dispatched, and when it was resolved.",
    url: "https://drishti-ex4s.onrender.com/citizen/track",
  },
};

export default function TrackLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
