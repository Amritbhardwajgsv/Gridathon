"use client";

import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  MapPinned,
  Phone,
  RefreshCw,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import PredictionForm from "@/components/PredictionForm";
import PredictionResultCard from "@/components/PredictionResultCard";
import ProgressBar from "@/components/ProgressBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { listCitizenGrievances, updateGrievanceStatus } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type {
  CitizenGrievance,
  GrievanceStatus,
  PredictImpactPayload,
  PredictImpactResponse,
} from "@/types/prediction";

type QueueFilter = "all" | "urgent" | "mapped";

const SEVERITY_DOT: Record<string, string> = {
  Critical: "bg-[#e05252]",
  High:     "bg-[#e8a034]",
  Medium:   "bg-[#4e8fe8]",
  Low:      "bg-[#35b779]",
};

const SEVERITY_TEXT: Record<string, string> = {
  Critical: "text-[#e05252]",
  High:     "text-[#e8a034]",
  Medium:   "text-[#4e8fe8]",
  Low:      "text-[#35b779]",
};

export default function ComplaintsPage() {
  const router = useRouter();
  const [items,            setItems]            = useState<CitizenGrievance[]>([]);
  const [selectedId,       setSelectedId]       = useState<string | null>(null);
  const [filter,           setFilter]           = useState<QueueFilter>("all");
  const [isLoading,        setIsLoading]        = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusMessage,    setStatusMessage]    = useState<{ text: string; ok: boolean } | null>(null);
  const [forecastResult,   setForecastResult]   = useState<PredictImpactResponse | null>(null);
  const [forecastPayload,  setForecastPayload]  = useState<PredictImpactPayload | null>(null);
  const [showForecast,     setShowForecast]     = useState(false);

  async function loadItems() {
    setIsLoading(true);
    try {
      const response = await listCitizenGrievances();
      setItems(response);
      setSelectedId((current) => current || response[0]?.id || null);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
    const interval = window.setInterval(loadItems, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === "urgent") return items.filter((i) => i.severity === "Critical" || i.severity === "High");
    if (filter === "mapped") return items.filter((i) => i.latitude && i.longitude);
    return items;
  }, [filter, items]);

  const selectedItem = filteredItems.find((i) => i.id === selectedId) || filteredItems[0] || null;

  const summary = {
    total:  items.length,
    urgent: items.filter((i) => i.severity === "Critical" || i.severity === "High").length,
    mapped: items.filter((i) => i.latitude && i.longitude).length,
  };

  async function setStatus(nextStatus: GrievanceStatus) {
    if (!selectedItem) return;
    setIsUpdatingStatus(true);
    setStatusMessage(null);
    try {
      const updated = await updateGrievanceStatus(selectedItem.id, { status: nextStatus });
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      setStatusMessage({ text: `Status updated to ${humanize(nextStatus)}.`, ok: true });
    } catch {
      setStatusMessage({ text: "Could not update status. Try again.", ok: false });
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  function handlePrediction(result: PredictImpactResponse, payload: PredictImpactPayload) {
    setForecastResult(result);
    setForecastPayload(payload);
  }

  // Build initial overrides for PredictionForm from selected complaint
  const forecastOverrides = selectedItem
    ? {
        corridor:   selectedItem.corridor   ?? "",
        zone:       selectedItem.zone       ?? "",
        latitude:   selectedItem.latitude   ? String(selectedItem.latitude)  : "12.9716",
        longitude:  selectedItem.longitude  ? String(selectedItem.longitude) : "77.5946",
      }
    : undefined;

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-kicker flex items-center gap-2 text-[#e8a034]">
              <ClipboardList className="h-3.5 w-3.5" />Complaint Queue
            </div>
            <h1 className="page-title mt-1">Citizen reports and triage details</h1>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded border border-[#1c2e4a] bg-[#0d1629] px-3 py-2 text-[12px] text-[#dde8f5] transition hover:bg-[#111f38] disabled:opacity-60"
            disabled={isLoading}
            onClick={loadItems}
            type="button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* KPI strip */}
        <section className="grid gap-3 md:grid-cols-3">
          <StatCard icon={ClipboardList} iconColor="text-[#22d3ee]"  label="Total Reports"      topColor="border-t-[#22d3ee]"  value={summary.total} />
          <StatCard icon={AlertTriangle} iconColor="text-[#e8a034]"  label="High and Critical"  topColor="border-t-[#e8a034]"  value={summary.urgent} />
          <StatCard icon={MapPinned}     iconColor="text-[#3b82f6]"  label="Mapped Locations"   topColor="border-t-[#3b82f6]"  value={summary.mapped} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* Queue list */}
          <div className="cmd-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2e4a] px-5 py-4">
              <div className="panel-title">Incoming reports</div>
              <select
                aria-label="Filter complaints by category"
                className="field-dark py-1.5 text-[12px]"
                onChange={(e) => setFilter(e.target.value as QueueFilter)}
                value={filter}
              >
                <option value="all">All reports</option>
                <option value="urgent">High and critical</option>
                <option value="mapped">Mapped only</option>
              </select>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 p-8 text-[12px] text-[#3d5278]">
                <Loader2 className="h-4 w-4 animate-spin" />Loading complaint queue…
              </div>
            ) : filteredItems.length ? (
              <div className="divide-y divide-[#1c2e4a]">
                {filteredItems.map((item) => {
                  const selected = selectedItem?.id === item.id;
                  return (
                    <button
                      className={`block w-full px-5 py-4 text-left transition ${
                        selected
                          ? "border-l-2 border-[#e8a034] bg-[#111f38]"
                          : "border-l-2 border-transparent hover:bg-[#0d1629]"
                      }`}
                      key={item.id}
                      onClick={() => { setSelectedId(item.id); setForecastResult(null); }}
                      type="button"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[item.severity] ?? "bg-[#3d5278]"}`} />
                          <div className="min-w-0">
                            <div className="mono-id">{item.tracking_id}</div>
                            <div className="mt-1 text-[13px] font-semibold text-[#f5f7fb]">{item.location_text}</div>
                            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#7c9ab8]">{item.description}</p>
                          </div>
                        </div>
                        <span className={`mono-id shrink-0 rounded border border-[#1c2e4a] px-1.5 py-0.5 ${SEVERITY_TEXT[item.severity] ?? "text-[#7c9ab8]"}`}>
                          {item.severity}
                        </span>
                      </div>
                      <div className="mono-id ml-3.5 mt-3">
                        {[humanize(item.complaint_type), humanize(item.status), item.corridor].filter(Boolean).join(" · ")}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-[12px] text-[#3d5278]">No reports match this filter.</div>
            )}
          </div>

          {/* Detail panel */}
          <aside className="space-y-4">
            {selectedItem ? (
              <>
                {/* Complaint meta */}
                <div className="cmd-card p-5">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <div className="mono-id">{selectedItem.tracking_id}</div>
                      <h2 className="mt-1 text-[16px] font-semibold text-[#f5f7fb]">{selectedItem.location_text}</h2>
                    </div>
                    <span className={`mono-id shrink-0 rounded border border-[#1c2e4a] px-2 py-1 ${SEVERITY_TEXT[selectedItem.severity] ?? "text-[#7c9ab8]"}`}>
                      {selectedItem.severity}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Type",    value: humanize(selectedItem.complaint_type) },
                      { label: "Status",  value: humanize(selectedItem.status) },
                      { label: "Zone",    value: selectedItem.zone    || "Not mapped" },
                      { label: "Corridor", value: selectedItem.corridor || "Not mapped" },
                      { label: "Created", value: formatDateTime(selectedItem.created_at) },
                    ].map((row) => (
                      <div className="flex items-start justify-between gap-4 border-b border-[#1c2e4a] pb-2 last:border-0 last:pb-0" key={row.label}>
                        <span className="section-kicker">{row.label}</span>
                        <span className="text-right text-[12px] text-[#dde8f5]">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-[#1c2e4a] bg-[#0d1629] p-3 text-[12px] leading-5 text-[#7c9ab8]">
                    {selectedItem.description}
                  </div>
                </div>

                {/* Triage score */}
                <div className="cmd-card p-5">
                  <div className="panel-title mb-4 flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#e8a034]" />Triage recommendation
                  </div>
                  <div className="rounded-xl border border-[#1c2e4a] bg-[#0d1629] p-4">
                    <div className="flex items-center justify-between">
                      <span className="section-kicker">Priority score</span>
                      <span className="font-mono text-[24px] font-bold text-[#f5f7fb]">
                        {selectedItem.agent_priority_score ?? "--"}
                        <span className="text-[12px] text-[#3d5278]">/100</span>
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={selectedItem.agent_priority_score || 0} />
                    </div>
                    <p className="mt-4 text-[12px] leading-5 text-[#7c9ab8]">
                      {selectedItem.agent_recommendation || "No recommendation returned yet."}
                    </p>
                  </div>
                </div>

                {/* Operational actions */}
                <div className="cmd-card p-5">
                  <div className="panel-title mb-4">Operational actions</div>
                  {statusMessage ? (
                    <div className={`mb-4 rounded-xl border px-3 py-2 text-[12px] ${
                      statusMessage.ok
                        ? "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]"
                        : "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]"
                    }`}>
                      {statusMessage.text}
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    {selectedItem.reporter_phone ? (
                      <a
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/8 px-3 py-2 text-[12px] font-semibold text-[#22d3ee] transition hover:bg-[#22d3ee]/15"
                        href={`tel:${selectedItem.reporter_phone}`}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Call reporter ({selectedItem.reporter_phone})
                      </a>
                    ) : (
                      <button className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#1c2e4a] px-3 py-2 text-[12px] text-[#3d5278]" disabled type="button">
                        <Phone className="h-3.5 w-3.5" />Phone not provided
                      </button>
                    )}
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e8a034]/30 bg-[#e8a034]/10 px-3 py-2 text-[12px] font-semibold text-[#e8a034] transition hover:bg-[#e8a034]/20 disabled:opacity-50"
                      disabled={isUpdatingStatus || selectedItem.status === "in_progress"}
                      onClick={() => setStatus("in_progress")}
                      type="button"
                    >
                      {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Mark in progress
                    </button>
                    <button
                      className="btn-primary py-2 text-[12px]"
                      disabled={isUpdatingStatus}
                      onClick={() => router.push(`/dashboard/operator?grievance=${selectedItem.id}`)}
                      type="button"
                    >
                      Deploy to field
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1c2e4a] px-3 py-2 text-[12px] font-semibold text-[#7c9ab8] transition hover:bg-[#0d1629] disabled:opacity-50"
                      disabled={isUpdatingStatus || selectedItem.status === "resolved"}
                      onClick={() => setStatus("resolved")}
                      type="button"
                    >
                      Mark resolved
                    </button>
                  </div>
                </div>

                {/* Traffic Forecast — event intake moved here */}
                <div className="cmd-card overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left transition hover:bg-[#0d1629]"
                    onClick={() => setShowForecast((v) => !v)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-[#22d3ee]" />
                      <div className="panel-title">Traffic forecast</div>
                    </div>
                    <span className="mono-id text-[#3d5278]">{showForecast ? "▲ hide" : "▼ run forecast"}</span>
                  </button>

                  {showForecast && (
                    <div className="border-t border-[#1c2e4a] p-4 space-y-4">
                      {selectedItem.corridor && (
                        <div className="rounded-xl border border-[#22d3ee]/15 bg-[#22d3ee]/5 px-3 py-2 text-[11px] text-[#22d3ee]">
                          Pre-filled from selected complaint · corridor: <strong>{selectedItem.corridor}</strong>
                        </div>
                      )}
                      <PredictionForm
                        onPrediction={handlePrediction}
                        overrides={forecastOverrides}
                      />
                      {forecastPayload && (
                        <div className="mono-id text-[#3d5278]">
                          Forecast for: {forecastPayload.corridor} / {forecastPayload.zone}
                        </div>
                      )}
                      <PredictionResultCard result={forecastResult} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="cmd-card p-6 text-[12px] text-[#3d5278]">
                Select a complaint to inspect details.
              </div>
            )}
          </aside>
        </section>
      </div>
    </ProtectedRoute>
  );
}

function StatCard({
  icon: Icon,
  iconColor,
  label,
  topColor,
  value,
}: {
  icon: typeof ClipboardList;
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
          <div className="mt-2 font-mono text-3xl font-bold text-[#f0f6ff]">{value}</div>
        </div>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
    </div>
  );
}
