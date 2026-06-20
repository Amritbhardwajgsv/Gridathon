import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Request Officer Access",
  description:
    "Bengaluru Traffic Police personnel can request access to DRISHTI for command, operations, or field roles. Submit your badge ID and unit details for Command Centre approval.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Request Officer Access | DRISHTI · BTP",
    description: "Register for DRISHTI access as a Bengaluru Traffic Police officer.",
    url: "https://drishti-ex4s.onrender.com/register",
  },
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
