"use client";

import { AlertTriangle, CheckCircle2, Clock3, Shield, ShieldCheck, Truck, Users, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { PredictImpactResponse } from "@/types/prediction";

interface PredictionResultCardProps {
  result: PredictImpactResponse | null;
}

const IMPACT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Low:      { text: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/25" },
  Medium:   { text: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10", border: "border-[#3b82f6]/25" },
  High:     { text: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/25" },
  Critical: { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/25" },
};

function ConfBar({ pct }: { pct: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.style.setProperty("--bar-pct", `${pct}%`); }, [pct]);
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#111f38]">
      <div ref={ref} className="data-bar h-full rounded-full bg-[#22d3ee] transition-all duration-700" />
    </div>
  );
}

export default function PredictionResultCard({ result }: PredictionResultCardProps) {
  if (!result) {
    return (
      <div className="cmd-card p-5 text-[12px] text-[#3d5278]">
        Submit a forecast to see predicted duration, impact level, and recommended deployment strength.
      </div>
    );
  }

  const impact   = IMPACT_COLORS[result.impact_level] ?? IMPACT_COLORS.Medium;
  const rec      = result.resource_recommendation;
  const duration = Math.round(result.predicted_duration_minutes);

  return (
    <div className="cmd-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1c2e4a] px-5 py-3.5">
        <CheckCircle2 className="h-4 w-4 text-[#22d3ee]" />
        <div className="panel-title">Forecast result</div>
        <span className="ml-auto mono-id">DRISHTI ML · {result.model_version}</span>
      </div>

      <div className="space-y-5 p-5">
        {/* Duration + Impact */}
        <div className="grid grid-cols-2 gap-3">
          <div className="cmd-card p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d5278]">
              <Clock3 className="h-3.5 w-3.5" />Duration
            </div>
            <div className="mt-2 font-mono text-[28px] font-bold text-[#f0f6ff]">
              {duration}<span className="ml-1 text-[13px] text-[#3d5278]">min</span>
            </div>
          </div>
          <div className={`rounded-xl border p-4 ${impact.bg} ${impact.border}`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${impact.text}`}>
              <AlertTriangle className="h-3.5 w-3.5" />Impact
            </div>
            <div className={`mt-2 font-mono text-[28px] font-bold ${impact.text}`}>
              {result.impact_level}
            </div>
          </div>
        </div>

        {rec && (
          <>
            {/* Deployment hero number */}
            <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#22d3ee]">
                  <Users className="h-4 w-4" />Recommended deployments
                </div>
                <div className="font-mono text-[40px] font-bold leading-none text-[#22d3ee]">
                  {rec.personnel_total}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  { label: "Constables", value: rec.constables },
                  { label: "ASI",        value: rec.asi },
                  { label: "SI",         value: rec.si },
                  { label: "Inspectors", value: rec.inspectors },
                ].map(({ label, value }) => (
                  <div className="rounded-lg bg-[#0d1629] px-2 py-2 text-center" key={label}>
                    <div className="font-mono text-[18px] font-bold text-[#f0f6ff]">{value}</div>
                    <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#3d5278]">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div className="grid grid-cols-3 gap-2">
              <EquipChip icon={<Shield className="h-3.5 w-3.5" />} label="Barricades" value={rec.barricades} />
              <EquipChip icon={<Truck className="h-3.5 w-3.5" />}  label="Tow units"  value={rec.tow_units} />
              <EquipChip icon={<Zap className="h-3.5 w-3.5" />}    label="Medical"    value={rec.medical_units} />
            </div>

            {/* Primary action */}
            {rec.primary_action && (
              <div className="rounded-xl border border-[#1c2e4a] bg-[#0d1629] px-4 py-3">
                <div className="section-kicker mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-[#22d3ee]" />Primary action
                </div>
                <p className="text-[12px] font-semibold text-[#dde8f5]">{rec.primary_action}</p>
              </div>
            )}

            {/* Diversion confidence */}
            <div>
              <div className="flex items-center justify-between">
                <div className="section-kicker">Diversion confidence</div>
                <div className="mono-id text-[#22d3ee]">{Math.round(rec.diversion_confidence * 100)}%</div>
              </div>
              <ConfBar pct={rec.diversion_confidence * 100} />
            </div>

            {/* Deployment notes */}
            {rec.deployment_notes.length > 0 && (
              <div className="space-y-1.5">
                <div className="section-kicker">Deployment notes</div>
                <ul className="space-y-1">
                  {rec.deployment_notes.map((note, i) => (
                    <li className="flex items-start gap-2 text-[12px] leading-5 text-[#7c9ab8]" key={i}>
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#22d3ee]/50" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EquipChip({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#1c2e4a] bg-[#0d1629] px-3 py-2.5">
      <span className="text-[#3d5278]">{icon}</span>
      <div>
        <div className="font-mono text-[15px] font-bold text-[#f0f6ff]">{value}</div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#3d5278]">{label}</div>
      </div>
    </div>
  );
}
