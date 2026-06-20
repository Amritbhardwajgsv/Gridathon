"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  Route,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import dynamic from "next/dynamic";

const DeploymentAssignmentPanel = dynamic(() => import("@/components/DeploymentAssignmentPanel"), {
  loading: () => <div className="flex h-48 items-center justify-center gap-2 text-[12px] text-slate-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#22d3ee] border-t-transparent" />Loading deployment panel…</div>,
});
import ProtectedRoute from "@/components/ProtectedRoute";
import { listCitizenGrievances } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { CitizenGrievance } from "@/types/prediction";

const SEV_DOT: Record<string, string> = {
  Critical: "bg-[#ef4444]",
  High:     "bg-[#f59e0b]",
  Medium:   "bg-[#3b82f6]",
  Low:      "bg-[#10b981]",
};

const SEV_BADGE: Record<string, string> = {
  Critical: "badge badge-red",
  High:     "badge badge-amber",
  Medium:   "badge badge-blue",
  Low:      "badge badge-green",
};

export default function OperatorPage() {
  const [grievances, setGrievances] = useState<CitizenGrievance[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      try { setGrievances(await listCitizenGrievances()); }
      catch { /* silent */ }
      finally { setIsLoading(false); }
    }
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const activeGrievances = useMemo(
    () => grievances.filter((g) => g.status !== "resolved"),
    [grievances],
  );

  const summary = useMemo(() => ({
    critical:   activeGrievances.filter((g) => g.severity === "Critical").length,
    high:       activeGrievances.filter((g) => g.severity === "High").length,
    inProgress: activeGrievances.filter((g) => g.status === "in_progress" || g.status === "In Progress").length,
    total:      activeGrievances.length,
  }), [activeGrievances]);

  const urgentItems = activeGrievances
    .filter((g) => g.severity === "Critical" || g.severity === "High")
    .slice(0, 6);

  return (
    <ProtectedRoute allowedRoles={["admin", "operator"]}>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-kicker flex items-center gap-2 text-[#22d3ee]">
              <Radio className="h-3.5 w-3.5" />Duty Dispatch
            </div>
            <h1 className="page-title mt-1">Assign personnel and brief field duty</h1>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#22d3ee]/25 bg-[#22d3ee]/8 px-3 py-1.5">
            <span className="live-breathe h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
            <span className="mono-id text-[#22d3ee]">{summary.critical + summary.high} urgent signals</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard icon={AlertTriangle} label="Critical"     value={summary.critical}   topColor="border-t-[#ef4444]" iconColor="text-[#ef4444]" />
          <KpiCard icon={Route}         label="High Priority" value={summary.high}       topColor="border-t-[#f59e0b]" iconColor="text-[#f59e0b]" />
          <KpiCard icon={Clock}         label="In Progress"  value={summary.inProgress} topColor="border-t-[#3b82f6]" iconColor="text-[#3b82f6]" />
          <KpiCard icon={CheckCircle2}  label="Total Queue"  value={summary.total}      topColor="border-t-[#22d3ee]" iconColor="text-[#22d3ee]" />
        </div>

        {/* Main panels */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <DeploymentAssignmentPanel />

          <aside className="space-y-4">
            {/* Urgent queue */}
            <div className="cmd-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[#1c2e4a] px-5 py-3.5">
                <Send className="h-3.5 w-3.5 text-[#22d3ee]" />
                <div className="panel-title">Urgent complaint queue</div>
              </div>
              {isLoading ? (
                <div className="p-5 text-[12px] text-[#3d5278]">Loading queue…</div>
              ) : urgentItems.length ? (
                <div className="divide-y divide-[#1c2e4a]">
                  {urgentItems.map((item) => (
                    <div className="p-4" key={item.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEV_DOT[item.severity] ?? "bg-[#3d5278]"}`} />
                          <div className="min-w-0">
                            <div className="mono-id text-[#22d3ee]">{item.tracking_id}</div>
                            <div className="mt-0.5 text-[13px] font-semibold text-[#f0f6ff]">{item.location_text}</div>
                          </div>
                        </div>
                        <span className={SEV_BADGE[item.severity] ?? "badge badge-muted"}>{item.severity}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#7c9ab8]">{item.description}</p>
                      <div className="mono-id mt-2">{[item.corridor, formatDateTime(item.created_at)].filter(Boolean).join(" · ")}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 text-[12px] text-[#3d5278]">No urgent complaints right now.</div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function KpiCard({
  icon: Icon,
  iconColor,
  label,
  topColor,
  value,
}: {
  icon: typeof AlertTriangle;
  iconColor: string;
  label: string;
  topColor: string;
  value: number;
}) {
  return (
    <div className={`cmd-card border-t-2 p-4 ${topColor}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="section-kicker">{label}</div>
          <div className="mt-2 font-mono text-[28px] font-bold text-[#f0f6ff]">{value}</div>
        </div>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
    </div>
  );
}
