"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Clock3,
  Database,
  FileClock,
  MapPinned,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";
import { getOperationsSummary, listCitizenGrievances, listSystemLogs } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { CitizenGrievance, OperationsSummary, SystemLog } from "@/types/prediction";

type Range = "24h" | "7d" | "30d" | "all";

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#3b82f6",
  Low: "#10b981",
};

export default function ViewerDashboard() {
  const [items, setItems] = useState<CitizenGrievance[]>([]);
  const [operations, setOperations] = useState<OperationsSummary | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [range, setRange] = useState<Range>("7d");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [logType, setLogType] = useState("all");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    const [complaintsResult, summaryResult, logsResult] = await Promise.allSettled([
      listCitizenGrievances(),
      getOperationsSummary(),
      listSystemLogs(300),
    ]);
    if (complaintsResult.status === "fulfilled") setItems(complaintsResult.value);
    if (summaryResult.status === "fulfilled") setOperations(summaryResult.value);
    if (logsResult.status === "fulfilled") setLogs(logsResult.value);
    setLastUpdated(new Date());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!withinRange(item.created_at, range)) return false;
      if (severity !== "all" && item.severity !== severity) return false;
      if (status !== "all" && item.status !== status) return false;
      if (type !== "all" && item.complaint_type !== type) return false;
      if (!normalizedQuery) return true;
      return [item.tracking_id, item.location_text, item.description, item.zone, item.corridor]
        .some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
    });
  }, [items, query, range, severity, status, type]);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (!withinRange(log.created_at, range)) return false;
      if (logType !== "all" && log.event_type !== logType) return false;
      if (!normalizedQuery) return true;
      return [log.aggregate_type, log.aggregate_key, log.event_type, JSON.stringify(log.event_payload)]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [logType, logs, query, range]);

  const metrics = useMemo(() => {
    const resolved = filteredItems.filter((item) => item.status === "resolved" || item.status === "closed").length;
    return {
      total: filteredItems.length,
      critical: filteredItems.filter((item) => item.severity === "Critical").length,
      mapped: filteredItems.filter((item) => item.latitude != null && item.longitude != null).length,
      resolved,
      resolutionRate: filteredItems.length ? Math.round((resolved / filteredItems.length) * 100) : 0,
      auditEvents: filteredLogs.length,
    };
  }, [filteredItems, filteredLogs]);

  const severityCounts = useMemo(
    () => countBy(filteredItems, (item) => item.severity),
    [filteredItems],
  );
  const statusCounts = useMemo(
    () => countBy(filteredItems, (item) => item.status),
    [filteredItems],
  );
  const typeCounts = useMemo(
    () => countBy(filteredItems, (item) => item.complaint_type),
    [filteredItems],
  );
  const corridorCounts = useMemo(
    () => countBy(filteredItems.filter((item) => item.corridor), (item) => item.corridor || "Unmapped"),
    [filteredItems],
  );
  const trend = useMemo(() => buildTrend(filteredItems), [filteredItems]);
  const logTypes = useMemo(() => Array.from(new Set(logs.map((log) => log.event_type))).sort(), [logs]);
  const complaintTypes = useMemo(() => Array.from(new Set(items.map((item) => item.complaint_type))).sort(), [items]);
  const statuses = useMemo(() => Array.from(new Set(items.map((item) => item.status))).sort(), [items]);

  return (
    <ProtectedRoute allowedRoles={["viewer"]}>
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-kicker flex items-center gap-2 text-[#f47f5f]"><Database className="h-3.5 w-3.5" />System observatory</div>
            <h1 className="page-title mt-1">Trends, reports and audit logs</h1>
            <p className="mt-2 text-[12px] text-[#795b4e]">Read-only visibility across citizen signals, forecasts and recorded system events.</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && <span className="mono-id">Updated {lastUpdated.toLocaleTimeString("en-IN")}</span>}
            <button className="btn-ghost px-3 py-2 text-[10px]" disabled={loading} onClick={load} type="button">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </button>
          </div>
        </header>

        <section className="command-panel p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(120px,auto))]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a88778]" />
              <input className="field-dark h-10 pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search IDs, locations, descriptions or logs" value={query} />
            </label>
            <FilterSelect label="Time" onChange={setRange} value={range} options={[["24h","24 hours"],["7d","7 days"],["30d","30 days"],["all","All time"]]} />
            <FilterSelect label="Severity" onChange={setSeverity} value={severity} options={[["all","All severity"],["Critical","Critical"],["High","High"],["Medium","Medium"],["Low","Low"]]} />
            <FilterSelect label="Status" onChange={setStatus} value={status} options={[["all","All status"], ...statuses.map((value) => [value, humanize(value)] as [string,string])]} />
            <FilterSelect label="Type" onChange={setType} value={type} options={[["all","All types"], ...complaintTypes.map((value) => [value, humanize(value)] as [string,string])]} />
            <FilterSelect label="Log event" onChange={setLogType} value={logType} options={[["all","All events"], ...logTypes.map((value) => [value, humanize(value)] as [string,string])]} />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric icon={ClipboardList} label="Signals" value={metrics.total} color="#f47f5f" />
          <Metric icon={AlertTriangle} label="Critical" value={metrics.critical} color="#ef4444" />
          <Metric icon={MapPinned} label="Mapped" value={metrics.mapped} color="#3b82f6" />
          <Metric icon={ShieldCheck} label="Resolved" value={metrics.resolved} color="#10b981" />
          <Metric icon={TrendingUp} label="Resolution" value={`${metrics.resolutionRate}%`} color="#f59e0b" />
          <Metric icon={FileClock} label="Audit events" value={metrics.auditEvents} color="#8b5cf6" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
          <div className="command-panel p-5">
            <div className="mb-5 flex items-center justify-between"><div className="panel-title"><BarChart3 className="h-4 w-4 text-[#f47f5f]" />Signal trend</div><span className="mono-id">{rangeLabel(range)}</span></div>
            <div className="flex h-56 items-end gap-2 border-b border-[#f2d8ca] pb-2">
              {trend.map((point) => {
                const max = Math.max(...trend.map((entry) => entry.count), 1);
                return <div className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2" key={point.key}>
                  <span className="font-mono text-[9px] text-[#a88778] opacity-0 transition group-hover:opacity-100">{point.count}</span>
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-[#f47f5f] to-[#ffd62f] transition hover:opacity-80" style={{ height: `${Math.max(4, (point.count / max) * 170)}px` }} />
                  <span className="truncate text-[9px] text-[#795b4e]">{point.label}</span>
                </div>;
              })}
            </div>
          </div>

          <div className="command-panel p-5">
            <div className="panel-title mb-5"><Activity className="h-4 w-4 text-[#f47f5f]" />Severity mix</div>
            <Distribution counts={severityCounts} colors={SEVERITY_COLOR} total={metrics.total} />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <RankedCard title="Trending complaint types" icon={TrendingUp} counts={typeCounts} />
          <RankedCard title="Status workflow" icon={Activity} counts={statusCounts} />
          <RankedCard title="Top corridors" icon={MapPinned} counts={corridorCounts} />
        </section>

        <section className="command-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f2d8ca] bg-[#fff8f2] px-5 py-4">
            <div className="panel-title"><ClipboardList className="h-4 w-4 text-[#f47f5f]" />Filtered complaint records</div>
            <span className="mono-id">{filteredItems.length} records</span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-[#fff8f2] text-left"><tr>{["Tracking","Location","Type","Severity","Status","Created"].map((heading) => <th className="px-4 py-3 text-[9px] uppercase tracking-[0.12em] text-[#a88778]" key={heading}>{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#f2d8ca]">
                {filteredItems.map((item) => <tr className="bg-white hover:bg-[#fff8f2]" key={item.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-[#d66a45]">{item.tracking_id}</td>
                  <td className="px-4 py-3"><div className="font-semibold text-[#342018]">{item.location_text}</div><div className="text-[10px] text-[#a88778]">{item.zone || "Zone pending"} · {item.corridor || "Corridor pending"}</div></td>
                  <td className="px-4 py-3 text-[#795b4e]">{humanize(item.complaint_type)}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: SEVERITY_COLOR[item.severity] }}>{item.severity}</td>
                  <td className="px-4 py-3 text-[#795b4e]">{humanize(item.status)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#a88778]">{formatDateTime(item.created_at)}</td>
                </tr>)}
              </tbody>
            </table>
            {!loading && !filteredItems.length && <div className="p-8 text-center text-[12px] text-[#a88778]">No complaint records match these filters.</div>}
          </div>
        </section>

        <section className="command-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f2d8ca] bg-[#fff8f2] px-5 py-4">
            <div className="panel-title"><Database className="h-4 w-4 text-[#8b5cf6]" />System event log</div>
            <div className="flex items-center gap-3"><span className="mono-id">Latest {filteredLogs.length}</span><span className="rounded-full bg-[#10b981]/10 px-2 py-1 text-[9px] font-bold uppercase text-[#10b981]">Read only</span></div>
          </div>
          <div className="max-h-[520px] divide-y divide-[#f2d8ca] overflow-y-auto">
            {filteredLogs.map((log) => <details className="group bg-white px-5 py-3 open:bg-[#fff8f2]" key={log.id}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2">
                <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
                <span className="min-w-[150px] font-semibold text-[#342018]">{humanize(log.event_type)}</span>
                <span className="rounded-full border border-[#f2d8ca] px-2 py-0.5 font-mono text-[9px] uppercase text-[#795b4e]">{humanize(log.aggregate_type)}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#a88778]">{log.aggregate_key}</span>
                <span className="whitespace-nowrap text-[10px] text-[#a88778]">{formatDateTime(log.created_at)}</span>
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-[#f2d8ca] bg-[#342018] p-4 text-[10px] leading-5 text-[#fff0e8]">{JSON.stringify(log.event_payload, null, 2)}</pre>
            </details>)}
            {!loading && !filteredLogs.length && <div className="p-8 text-center text-[12px] text-[#a88778]">No system events match these filters.</div>}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="command-panel p-5"><div className="panel-title mb-4"><Clock3 className="h-4 w-4 text-[#f47f5f]" />Recent forecast watch</div><div className="space-y-2">{operations?.recent_predictions.map((prediction) => <div className="rounded-xl border border-[#f2d8ca] bg-[#fff8f2] p-3" key={prediction.id}><div className="font-semibold text-[#342018]">{prediction.event_name || humanize(prediction.event_cause_grouped)}</div><div className="mono-id mt-1">{prediction.impact_level} · {Math.round(prediction.predicted_duration_minutes)} min · {prediction.corridor}</div></div>)}{!operations?.recent_predictions.length && <div className="text-[12px] text-[#a88778]">No forecast records available.</div>}</div></div>
          <div className="command-panel p-5"><div className="panel-title mb-4"><ShieldCheck className="h-4 w-4 text-[#10b981]" />Model learning watch</div><div className="grid grid-cols-2 gap-3"><Metric icon={BarChart3} label="All forecasts" value={operations?.prediction_count ?? 0} color="#f47f5f" /><Metric icon={FileClock} label="Review queue" value={operations?.retraining_ready_count ?? 0} color="#8b5cf6" /></div></div>
        </section>
      </div>
    </ProtectedRoute>
  );
}

function withinRange(value: string, range: Range) {
  if (range === "all") return true;
  const age = Date.now() - new Date(value).getTime();
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  return Number.isFinite(age) && age <= hours * 60 * 60 * 1000;
}

function countBy<T>(values: T[], key: (value: T) => string) {
  const counts: Record<string, number> = {};
  values.forEach((value) => { const label = key(value); counts[label] = (counts[label] ?? 0) + 1; });
  return counts;
}

function buildTrend(items: CitizenGrievance[]) {
  const counts: Record<string, number> = {};
  items.forEach((item) => { const key = item.created_at.slice(0, 10); counts[key] = (counts[key] ?? 0) + 1; });
  const keys = Object.keys(counts).sort().slice(-10);
  if (!keys.length) return Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), count: 0 }; });
  return keys.map((key) => ({ key, label: new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), count: counts[key] }));
}

function rangeLabel(range: Range) { return range === "all" ? "All time" : range === "24h" ? "Last 24 hours" : `Last ${range}`; }

function FilterSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [string,string][]; onChange: (value: T) => void }) {
  return <label className="min-w-0"><span className="sr-only">{label}</span><select aria-label={label} className="field-dark h-10 py-2" onChange={(event) => onChange(event.target.value as T)} value={value}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string | number; color: string }) {
  return <div className="command-panel p-4" style={{ borderTop: `3px solid ${color}` }}><div className="flex items-start justify-between"><div><div className="section-kicker">{label}</div><div className="mt-2 font-mono text-3xl font-bold text-[#342018]">{value}</div></div><Icon className="h-4 w-4" style={{ color }} /></div></div>;
}

function Distribution({ counts, colors, total }: { counts: Record<string,number>; colors: Record<string,string>; total: number }) {
  return <div className="space-y-4">{["Critical","High","Medium","Low"].map((label) => { const count = counts[label] ?? 0; const pct = total ? Math.round((count / total) * 100) : 0; return <div key={label}><div className="mb-1.5 flex justify-between text-[11px]"><span className="font-semibold" style={{ color: colors[label] }}>{label}</span><span className="mono-id">{count} · {pct}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f2d8ca]"><div className="h-full rounded-full" style={{ background: colors[label], width: `${pct}%` }} /></div></div>; })}</div>;
}

function RankedCard({ title, icon: Icon, counts }: { title: string; icon: typeof Activity; counts: Record<string,number> }) {
  const rows = Object.entries(counts).sort(([,a],[,b]) => b - a).slice(0, 6);
  const max = Math.max(...rows.map(([,count]) => count), 1);
  return <div className="command-panel p-5"><div className="panel-title mb-4"><Icon className="h-4 w-4 text-[#f47f5f]" />{title}</div><div className="space-y-3">{rows.map(([label,count], index) => <div key={label}><div className="mb-1 flex justify-between text-[11px]"><span className="truncate text-[#795b4e]">{index + 1}. {humanize(label)}</span><span className="mono-id">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#f2d8ca]"><div className="h-full rounded-full bg-[#f47f5f]" style={{ width: `${(count / max) * 100}%` }} /></div></div>)}{!rows.length && <div className="text-[12px] text-[#a88778]">No matching data.</div>}</div></div>;
}
