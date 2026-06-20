import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Police Login",
  description:
    "Bengaluru Traffic Police command and field officer login. Access the DRISHTI operations dashboard for incident management, resource deployment, and live field tracking.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Police Login | DRISHTI · BTP",
    description: "Bengaluru Traffic Police secure login for command and field operations.",
    url: "https://drishti-ex4s.onrender.com/login",
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
