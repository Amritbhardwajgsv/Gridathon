import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: ReactNode;
  tone?: "yellow" | "green" | "blue" | "red" | "violet" | "amber";
}

const toneConfig = {
  yellow: { icon: "bg-[#FFE600]/10 text-[#FFE600]", value: "text-[#FFE600]", border: "border-t-[#FFE600]" },
  green:  { icon: "bg-[#10B981]/10 text-[#10B981]", value: "text-[#10B981]", border: "border-t-[#10B981]" },
  blue:   { icon: "bg-[#3B82F6]/10 text-[#3B82F6]", value: "text-[#3B82F6]", border: "border-t-[#3B82F6]" },
  red:    { icon: "bg-[#EF4444]/10 text-[#EF4444]", value: "text-[#EF4444]", border: "border-t-[#EF4444]" },
  violet: { icon: "bg-[#A78BFA]/10 text-[#A78BFA]", value: "text-[#A78BFA]", border: "border-t-[#A78BFA]" },
  amber:  { icon: "bg-[#F59E0B]/10 text-[#F59E0B]", value: "text-[#F59E0B]", border: "border-t-[#F59E0B]" },
};

export default function MetricCard({ helper, icon, label, tone = "yellow", value }: MetricCardProps) {
  const cfg = toneConfig[tone];
  return (
    <div className={`browser-card border-t-[3px] ${cfg.border}`}>
      <div className="browser-card-header border-b-2 border-[#252535]">
        <span className="browser-dot browser-dot-red" />
        <span className="browser-dot browser-dot-yellow" />
        <span className="browser-dot browser-dot-green" />
      </div>
      <div className="p-4">
        <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded ${cfg.icon}`}>
          {icon}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#444455]">{label}</div>
        <div className={`mt-1 font-mono text-[28px] font-black leading-none ${cfg.value}`}>{value}</div>
        {helper ? <div className="mt-1.5 text-[11px] text-[#8888A0]">{helper}</div> : null}
      </div>
    </div>
  );
}
