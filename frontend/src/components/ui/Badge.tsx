import { Circle } from "lucide-react";
import type { ReactNode } from "react";

import { severityTone } from "@/lib/format";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "signal" | "success" | "warning" | "danger";
  severity?: string;
}

const toneClassName = {
  neutral: "border-line bg-ink-50 text-ink-700",
  signal: "border-orange-200 bg-orange-50 text-orange-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800"
};

export default function Badge({ children, severity, tone = "neutral" }: BadgeProps) {
  const className = severity ? severityTone(severity) : toneClassName[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] ${className}`}
    >
      <Circle className="h-2 w-2 fill-current" />
      {children}
    </span>
  );
}
