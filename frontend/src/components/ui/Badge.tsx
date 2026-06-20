import type { ReactNode } from "react";

import { severityTone } from "@/lib/format";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "signal" | "success" | "warning" | "danger" | "yellow";
  severity?: string;
}

const toneClassName = {
  neutral: "border-[#252535] bg-[#0F0F1A] text-[#8888A0]",
  signal:  "border-[#E84B5A]/30 bg-[#E84B5A]/10 text-[#E84B5A]",
  success: "border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]",
  warning: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]",
  danger:  "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]",
  yellow:  "border-[#FFE600]/30 bg-[#FFE600]/10 text-[#FFE600]",
};

export default function Badge({ children, severity, tone = "neutral" }: BadgeProps) {
  const className = severity ? severityTone(severity) : toneClassName[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.1em] ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
