"use client";

import { useEffect, useState } from "react";
import { MapPin, Siren } from "lucide-react";

type Incident = {
  complaint_type: string;
  severity: string;
  location: string;
  zone: string | null;
  corridor: string | null;
  status: string;
  created_at: string;
};

const SEV_COLOR: Record<string, string> = {
  Critical: "text-[#EF4444]",
  High:     "text-[#F59E0B]",
  Medium:   "text-[#3B82F6]",
  Low:      "text-[#10B981]",
};

const SEV_DOT: Record<string, string> = {
  Critical: "bg-[#EF4444]",
  High:     "bg-[#F59E0B]",
  Medium:   "bg-[#3B82F6]",
  Low:      "bg-[#10B981]",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RecentIncidentsFeed() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loaded,    setLoaded]    = useState(false);

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
    fetch(`${base}/citizen/incidents/recent`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Incident[]) => { setIncidents(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || incidents.length === 0) return null;

  return (
    <section className="border-b-2 border-[#252535] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker mb-3 text-[#EF4444]">+ Live Feed</div>
            <h2 className="text-[32px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
              Recent traffic<br />incidents.
            </h2>
          </div>
          <p className="max-w-xs text-[13px] leading-6 text-[#8888A0]">
            Latest incidents reported by citizens and processed by DRISHTI.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {incidents.map((inc, i) => {
            const sevColor = SEV_COLOR[inc.severity] ?? "text-[#8888A0]";
            const sevDot   = SEV_DOT[inc.severity]   ?? "bg-[#8888A0]";
            return (
              <div className="browser-card flex flex-col" key={i}>
                <div className="browser-card-header border-b-2 border-[#252535]">
                  <span className="browser-dot browser-dot-red" />
                  <span className="browser-dot browser-dot-yellow" />
                  <span className="browser-dot browser-dot-green" />
                  <span className="ml-2 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-[#444455]">
                    {timeAgo(inc.created_at)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4 gap-2">
                  {/* Severity badge */}
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${sevDot}`} />
                    <span className={`text-[10px] font-black uppercase tracking-[0.08em] ${sevColor}`}>
                      {inc.severity}
                    </span>
                  </div>

                  {/* Complaint type */}
                  <div className="text-[12px] font-bold text-[#F0F0F8] capitalize leading-tight">
                    {inc.complaint_type.replace(/_/g, " ")}
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-1 mt-auto">
                    <MapPin className="h-3 w-3 shrink-0 text-[#444455] mt-0.5" />
                    <span className="text-[11px] text-[#8888A0] leading-tight line-clamp-2">
                      {inc.location}
                    </span>
                  </div>

                  {/* Corridor */}
                  {inc.corridor && (
                    <div className="text-[10px] text-[#444455]">{inc.corridor}</div>
                  )}

                  {/* Status chip */}
                  <div className="mt-1 inline-flex w-fit items-center gap-1">
                    <Siren className="h-2.5 w-2.5 text-[#444455]" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#444455]">
                      {inc.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
