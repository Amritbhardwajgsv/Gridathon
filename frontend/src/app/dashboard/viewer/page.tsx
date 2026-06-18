"use client";

import { AlertTriangle, BarChart3, Clock, ClipboardList, MapPinned, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ProgressBar from "@/components/ProgressBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getOperationsSummary, listCitizenGrievances } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { CitizenGrievance, OperationsSummary } from "@/types/prediction";

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "text-[#e05252]",
  High: "text-[#e8a034]",
  Medium: "text-[#4e8fe8]",
  Low: "text-[#35b779]",
};

const SEVERITY_BAR: Record<string, string> = {
  Critical: "bg-[#e05252]",
  High: "bg-[#e8a034]",
  Medium: "bg-[#4e8fe8]",
  Low: "bg-[#35b779]",
};
export default function AnalyticsPage() {
  const [items, setItems] = useState<CitizenGrievance[]>([]);
  const [operations, setOperations] = useState<OperationsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [grievanceData, operationsData] = await Promise.all([
          listCitizenGrievances(),
          getOperationsSummary(),
        ]);
        setItems(grievanceData);
        setOperations(operationsData);
      } catch (error) {
        console.error("Failed to load reports", error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
    const interval = window.setInterval(load, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    items.forEach((item) => {
      byType[item.complaint_type] = (byType[item.complaint_type] || 0) + 1;
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    });

    return {
      bySeverity,
      byType,
      critical: bySeverity.Critical,
      mapped: items.filter((item) => item.latitude && item.longitude).length,
      predictions: operations?.prediction_count ?? 0,
      review: operations?.retraining_ready_count ?? 0,
      total: items.length,
    };
  }, [items, operations]);

  return (
    <ProtectedRoute allowedRoles={["viewer"]}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-kicker flex items-center gap-2 text-[#e8a034]">
              <Radio className="h-3.5 w-3.5" />
              Reports
            </div>
            <h1 className="page-title mt-1">Operational reports and city visibility</h1>
          </div>
          <div className="mono-id flex items-center gap-2 text-[#19b7a5]">
            <span className="live-breathe h-2 w-2 rounded-full bg-[#19b7a5]" />
            LIVE
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          <StatCard accent="stat-top-teal" icon={ClipboardList} iconColor="text-[#19b7a5]" label="Complaints" value={stats.total} />
          <StatCard accent="stat-top-red" icon={AlertTriangle} iconColor="text-[#e05252]" label="Critical" value={stats.critical} />
          <StatCard accent="stat-top-blue" icon={MapPinned} iconColor="text-[#4e8fe8]" label="Mapped" value={stats.mapped} />
          <StatCard accent="stat-top-amber" icon={BarChart3} iconColor="text-[#e8a034]" label="Forecasts" value={stats.predictions} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <div className="command-panel p-5">
              <div className="panel-title mb-5">Severity distribution</div>
              <div className="space-y-4">
                {Object.entries(stats.bySeverity).map(([severity, count]) => {
                  return (
                    <div key={severity}>
                      <div className="mb-2 flex justify-between text-[12px]">
                        <span className={`font-semibold ${SEVERITY_COLOR[severity] ?? "text-[#dce2ea]"}`}>
                          {severity}
                        </span>
                        <span className="mono-id">{count}</span>
                      </div>
                      <ProgressBar
                        colorClass={SEVERITY_BAR[severity] ?? "bg-[#394252]"}
                        max={Math.max(stats.total, 1)}
                        value={count}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="command-panel overflow-hidden">
              <div className="border-b border-[#252b35] px-5 py-4">
                <div className="panel-title">Latest complaint signals</div>
              </div>
              {isLoading ? (
                <div className="p-6 text-[12px] text-[#707987]">Loading reports...</div>
              ) : items.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[12px]">
                    <thead className="border-b border-[#252b35] bg-[#10141b]">
                      <tr>
                        {["Tracking", "Location", "Type", "Severity", "Created"].map((h) => (
                          <th
                            className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#707987]"
                            key={h}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#252b35]">
                      {items.slice(0, 10).map((item) => (
                        <tr className="hover:bg-[#10141b]" key={item.id}>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-[#9ba5b3]">
                            {item.tracking_id}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#f5f7fb]">{item.location_text}</div>
                            <div className="text-[11px] text-[#707987]">{item.corridor || "Corridor pending"}</div>
                          </td>
                          <td className="px-4 py-3 text-[#dce2ea]">{humanize(item.complaint_type)}</td>
                          <td className={`px-4 py-3 font-semibold ${SEVERITY_COLOR[item.severity] ?? "text-[#dce2ea]"}`}>
                            {item.severity}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#707987]">
                            {formatDateTime(item.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-[12px] text-[#707987]">No complaint data yet.</div>
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="command-panel p-5">
              <div className="panel-title mb-4">Top complaint types</div>
              <div className="space-y-2">
                {Object.entries(stats.byType)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <div
                      className="flex items-center justify-between rounded border border-[#252b35] bg-[#10141b] px-3 py-2"
                      key={type}
                    >
                      <span className="text-[12px] text-[#dce2ea]">{humanize(type)}</span>
                      <span className="mono-id text-[#e8a034]">{count}</span>
                    </div>
                  ))}
                {!Object.keys(stats.byType).length ? (
                  <div className="text-[12px] text-[#707987]">No complaint types yet.</div>
                ) : null}
              </div>
            </div>

            <div className="command-panel p-5">
              <div className="panel-title mb-4">
                <Clock className="h-3.5 w-3.5 text-[#e8a034]" />
                Forecast watch
              </div>
              <div className="space-y-3">
                {operations?.recent_predictions.slice(0, 4).map((item) => (
                  <div className="rounded border border-[#252b35] bg-[#10141b] p-3" key={item.id}>
                    <div className="text-[13px] font-semibold text-[#f5f7fb]">
                      {item.event_name || humanize(item.event_cause_grouped)}
                    </div>
                    <div className="mono-id mt-1">
                      {item.impact_level} · {item.predicted_duration_minutes} min · {item.corridor}
                    </div>
                  </div>
                ))}
                {!operations?.recent_predictions.length ? (
                  <div className="text-[12px] text-[#707987]">No forecasts logged yet.</div>
                ) : null}
              </div>
            </div>

            <div className="command-panel stat-top-teal p-4">
              <div className="section-kicker">Review queue</div>
              <div className="mt-2 font-mono text-3xl text-[#f5f7fb]">{stats.review}</div>
              <div className="mt-1 text-[12px] text-[#9ba5b3]">
                Predictions flagged for operator review and model feedback.
              </div>
            </div>
          </aside>
        </section>
      </div>
    </ProtectedRoute>
  );
}

function StatCard({
  accent,
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  accent: string;
  icon: typeof ClipboardList;
  iconColor: string;
  label: string;
  value: number;
}) {
  return (
    <div className={`command-panel ${accent} p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="section-kicker">{label}</div>
          <div className="mt-2 font-mono text-3xl text-[#f5f7fb]">{value}</div>
        </div>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
    </div>
  );
}
