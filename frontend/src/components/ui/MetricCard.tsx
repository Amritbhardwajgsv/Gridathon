import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: ReactNode;
  tone?: "signal" | "pine" | "amber" | "ink";
}

const toneClassName = {
  signal: "bg-orange-50 text-signal",
  pine: "bg-emerald-50 text-pine",
  amber: "bg-amber-50 text-amber",
  ink: "bg-ink-50 text-ink-700"
};

export default function MetricCard({
  helper,
  icon,
  label,
  tone = "signal",
  value
}: MetricCardProps) {
  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-soft">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded ${toneClassName[tone]}`}>
        {icon}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300">
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold text-ink-950">{value}</div>
      {helper ? <div className="mt-1 text-xs text-ink-500">{helper}</div> : null}
    </section>
  );
}
