"use client";

import { BrainCircuit, Check, FileText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const stages = [
  { label: "Description received", icon: FileText },
  { label: "NLP fields extracted", icon: BrainCircuit },
  { label: "Priority assessed", icon: ShieldCheck },
  { label: "Ready for command", icon: Check },
];

export default function DescriptionPipelinePreview() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setActive((value) => (value + 1) % stages.length), 1500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="browser-card w-full border-2 border-[#252535]">
      <div className="browser-card-header border-b-2 border-[#252535]">
        <span className="browser-dot browser-dot-red" />
        <span className="browser-dot browser-dot-yellow" />
        <span className="browser-dot browser-dot-green" />
        <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">Description intelligence</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-[#FFE600]">
          <span className="live-breathe h-1.5 w-1.5 rounded-full bg-[#FFE600]" />Processing
        </span>
      </div>
      <div className="space-y-4 p-5">
        <div className="rounded-xl border-2 border-[#f2d8ca] bg-white p-4">
          <div className="section-kicker mb-2">Citizen description</div>
          <p className="text-[13px] leading-6 text-[#F0F0F8]">
            A city bus has broken down near Silk Board and is blocking two lanes; traffic is building quickly and an ambulance is stuck behind it.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[["Cause", "Vehicle breakdown"], ["Vehicle", "Bus"], ["Road impact", "Lane blocked"], ["Urgency", "High"]].map(([label, value], index) => (
            <div className="rounded-xl border border-[#f47f5f]/35 bg-[#fff0e8] px-3 py-2 transition-all duration-500" key={label} style={{ transitionDelay: `${index * 80}ms` }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#444455]">{label}</div>
              <div className="mt-1 text-[11px] font-bold text-[#F0F0F8]">{value}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-1">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const complete = index <= active;
            return (
              <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${index === active ? "border-[#FFE600] bg-[#FFE600]/10" : complete ? "border-[#f47f5f]/30 bg-[#fff0e8]" : "border-[#f2d8ca] bg-white opacity-45"}`} key={stage.label}>
                <Icon className={`h-4 w-4 ${complete ? "text-[#f47f5f]" : "text-[#444455]"}`} />
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#F0F0F8]">{stage.label}</span>
                {complete && <Check className="ml-auto h-3.5 w-3.5 text-[#10B981]" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
