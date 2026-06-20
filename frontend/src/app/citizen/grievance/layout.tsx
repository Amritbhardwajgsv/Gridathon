import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Report a Traffic Incident",
  description:
    "Spotted a traffic jam, accident, road closure, or illegal parking in Bengaluru? Report it in plain language — no technical form filling needed. DRISHTI converts your description into a structured police incident automatically.",
  keywords: ["report traffic incident Bengaluru", "Bangalore traffic complaint", "report accident", "road closure complaint", "traffic police complaint"],
  alternates: { canonical: "https://drishti-ex4s.onrender.com/citizen/grievance" },
  openGraph: {
    title: "Report a Traffic Incident | DRISHTI · Bengaluru Police",
    description:
      "Describe the traffic problem in plain language. DRISHTI extracts the details and sends a structured incident to Bengaluru Police for action. Takes 2 minutes.",
    url: "https://drishti-ex4s.onrender.com/citizen/grievance",
  },
};

export default function GrievanceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
