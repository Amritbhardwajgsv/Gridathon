"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPinned,
  MessageSquare,
  Radio,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import ChatPanel from "@/components/ChatPanel";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getCurrentUser } from "@/lib/auth";
import { listCitizenGrievances, listDeploymentOrders, listPersonnel, updateGrievanceStatus } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { CitizenGrievance, DeploymentOrder, PolicePersonnel } from "@/types/prediction";

const PersonnelMap = dynamic(() => import("@/components/PersonnelMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-[12px] text-[#3d5278]">
      <Loader2 className="h-4 w-4 animate-spin text-[#22d3ee]" />Loading map…
    </div>
  ),
});

const SEV: Record<string, { dot: string; bar: string; text: string; badge: string }> = {
  Critical: { dot: "bg-[#ef4444]", bar: "bg-[#ef4444]", text: "text-[#ef4444]", badge: "badge badge-red" },
  High:     { dot: "bg-[#f59e0b]", bar: "bg-[#f59e0b]", text: "text-[#f59e0b]", badge: "badge badge-amber" },
  Medium:   { dot: "bg-[#3b82f6]", bar: "bg-[#3b82f6]", text: "text-[#3b82f6]", badge: "badge badge-blue" },
  Low:      { dot: "bg-[#10b981]", bar: "bg-[#10b981]", text: "text-[#10b981]", badge: "badge badge-green" },
};

const STATUS_COLOR: Record<string, string> = {
  pending:              "text-[#f59e0b]",
  in_progress:          "text-[#3b82f6]",
  assigned:             "text-[#a78bfa]",
  pending_verification: "text-[#22d3ee]",
  resolved:             "text-[#10b981]",
  closed:               "text-[#3d5278]",
};

// Canonical BLR zone prefixes — used to bucket personnel by zone
export default function AdminDashboardPage() {
  const [grievances,      setGrievances]      = useState<CitizenGrievance[]>([]);
  const [personnel,       setPersonnel]       = useState<PolicePersonnel[]>([]);
  const [orders,          setOrders]          = useState<DeploymentOrder[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [personnelError,  setPersonnelError]  = useState(false);
  const [lastRefresh,     setLastRefresh]     = useState<Date | null>(null);
  const [confirming,      setConfirming]      = useState<string | null>(null);
  const [confirmError,    setConfirmError]    = useState<string | null>(null);
  const [rightTab,        setRightTab]        = useState<"feed" | "global" | "deployments">("feed");
  const [chatOrderId,     setChatOrderId]     = useState<string | null>(null);

  const currentUser = getCurrentUser();

  async function load() {
    setPersonnelError(false);
    try {
      const [grievanceResult, personnelResult, orderResult] = await Promise.allSettled([
        listCitizenGrievances(),
        listPersonnel(),
        listDeploymentOrders(),
      ]);

      if (grievanceResult.status === "fulfilled") setGrievances(grievanceResult.value);
      if (personnelResult.status === "fulfilled") {
        setPersonnel(personnelResult.value);
      } else {
        setPersonnelError(true);
      }
      if (orderResult.status === "fulfilled") setOrders(orderResult.value);
      setLastRefresh(new Date());
    } finally { setIsLoading(false); }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const stats = useMemo(() => ({
    critical:   grievances.filter((g) => g.severity === "Critical").length,
    high:       grievances.filter((g) => g.severity === "High").length,
    onDuty:     personnel.filter((p) => p.is_active !== false).length,
    resolved:   grievances.filter((g) => g.status === "resolved" || g.status === "closed").length,
    pending:    grievances.filter((g) => g.status === "pending").length,
    pendingVerif: grievances.filter((g) => g.status === "pending_verification").length,
    total:      grievances.length,
  }), [grievances, personnel]);

  const pendingVerif = useMemo(
    () => grievances.filter((g) => g.status === "pending_verification"),
    [grievances]
  );

  const sevCounts = useMemo(() => {
    const c = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    grievances.forEach((g) => { if (g.severity in c) c[g.severity as keyof typeof c]++; });
    return c;
  }, [grievances]);

  // Dynamic zone coverage — canonical BLR prefixes + any extra zones found in data
  const zoneCoverage = useMemo(() => {
    const zones = new Map<string, number>();
    for (const p of personnel) {
      const zone = p.zone?.trim().replace(/\s+/g, " ");
      if (!zone) continue;
      zones.set(zone, (zones.get(zone) ?? 0) + 1);
    }

    return Array.from(zones, ([label, count]) => ({ label, count })).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [personnel]);

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    grievances.forEach((g) => { c[g.complaint_type] = (c[g.complaint_type] ?? 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [grievances]);

  const maxSev  = Math.max(...Object.values(sevCounts), 1);
  const maxType = Math.max(...typeCounts.map(([, c]) => c), 1);

  async function confirmResolved(grievanceId: string) {
    setConfirming(grievanceId);
    setConfirmError(null);
    try {
      await updateGrievanceStatus(grievanceId, { status: "resolved", notes: "Confirmed by Command Centre" });
      await load();
    } catch {
      setConfirmError("Could not confirm. Try again.");
    } finally {
      setConfirming(null);
    }
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="section-kicker text-[#22d3ee]">Command Centre</div>
            <h1 className="page-title mt-1">Operations Overview</h1>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh ? (
              <div className="mono-id">
                updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            ) : null}
            <div className="flex items-center gap-2 rounded-lg border border-[#22d3ee]/25 bg-[#22d3ee]/8 px-3 py-1.5">
              <span className="live-breathe h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
              <span className="mono-id text-[#22d3ee]">LIVE · 30s</span>
            </div>
          </div>
        </div>

        {/* ── KPI strip ─────────────────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard icon={AlertTriangle} label="Critical"    value={stats.critical}     topColor="border-t-[#ef4444]" iconColor="text-[#ef4444]" sub="Dispatch now" />
          <KpiCard icon={TrendingUp}    label="High"        value={stats.high}          topColor="border-t-[#f59e0b]" iconColor="text-[#f59e0b]" sub="Needs assignment" />
          <KpiCard icon={Users}         label="On Duty"     value={stats.onDuty}        topColor="border-t-[#22d3ee]" iconColor="text-[#22d3ee]" sub="Active officers" />
          <KpiCard icon={ClipboardList} label="Pending"     value={stats.pending}       topColor="border-t-[#3b82f6]" iconColor="text-[#3b82f6]" sub="Awaiting triage" />
          <KpiCard icon={ShieldCheck}   label="Verify"      value={stats.pendingVerif}  topColor="border-t-[#a78bfa]" iconColor="text-[#a78bfa]" sub="Awaiting sign-off" urgent={stats.pendingVerif > 0} />
          <KpiCard icon={Activity}      label="Resolved"    value={stats.resolved}      topColor="border-t-[#10b981]" iconColor="text-[#10b981]" sub="Confirmed closed" />
        </div>

        {/* ── Pending verification queue ───────────────────────────────────── */}
        {(pendingVerif.length > 0 || isLoading) ? (
          <div className="cmd-card overflow-hidden border-[#a78bfa]/25">
            <div className="flex items-center gap-2.5 border-b border-[#1c2e4a] bg-[#a78bfa]/5 px-5 py-4">
              <span className="live-breathe h-2 w-2 rounded-full bg-[#a78bfa]" />
              <div className="panel-title text-[#a78bfa]">
                Pending Command Centre Verification
              </div>
              <span className="ml-auto mono-id rounded border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-2 py-0.5 text-[#a78bfa]">
                {pendingVerif.length} AWAITING
              </span>
            </div>
            {confirmError ? (
              <div className="border-b border-[#1c2e4a] bg-[#ef4444]/8 px-5 py-2.5 text-[12px] text-[#fca5a5]">
                {confirmError}
              </div>
            ) : null}
            {isLoading ? (
              <div className="flex items-center gap-3 px-5 py-8 text-[12px] text-[#3d5278]">
                <Loader2 className="h-4 w-4 animate-spin text-[#22d3ee]" />Loading verification queue…
              </div>
            ) : pendingVerif.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6 text-[12px] text-[#3d5278]">
                <CheckCircle2 className="h-4 w-4 text-[#10b981]" />All clear — no complaints pending verification.
              </div>
            ) : (
              <div className="divide-y divide-[#1c2e4a]">
                {pendingVerif.map((g) => {
                  const sev = SEV[g.severity] ?? SEV.Low;
                  const isConf = confirming === g.id;
                  return (
                    <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4" key={g.id}>
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${sev.dot}`} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mono-id text-[#22d3ee]">{g.tracking_id}</span>
                            <span className={sev.badge}>{g.severity}</span>
                          </div>
                          <div className="mt-1 text-[13px] font-semibold text-[#f0f6ff]">{g.location_text}</div>
                          <div className="mono-id mt-0.5">{humanize(g.complaint_type)} · {g.corridor ?? "—"}</div>
                          {(() => { const r = parseRec(g.agent_recommendation); return (<>
                            <p className="mt-1.5 max-w-lg text-[12px] leading-5 text-[#7c9ab8]">
                              {r.text || g.agent_recommendation || "Officer marked situation resolved. Please verify and confirm."}
                            </p>
                            <MlBadges rec={r} />
                          </>); })()}
                          <div className="mono-id mt-2">Reported {formatDateTime(g.created_at)}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#10b981] px-4 py-2 text-[12px] font-bold text-[#060c18] transition hover:opacity-90 disabled:opacity-60"
                          disabled={isConf}
                          onClick={() => confirmResolved(g.id)}
                          type="button"
                        >
                          {isConf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {isConf ? "Confirming…" : "Confirm Resolved"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* ── Map + live feed ────────────────────────────────────────────────── */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="cmd-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#1c2e4a] px-5 py-4">
              <MapPinned className="h-3.5 w-3.5 text-[#22d3ee]" />
              <div className="panel-title">Personnel &amp; Complaint Map</div>
              <div className="ml-auto mono-id">{personnel.length} officers · {grievances.length} reports</div>
            </div>
            <div className="h-80">
              <PersonnelMap complaints={grievances} personnel={personnel} />
            </div>
            <div className="flex gap-5 border-t border-[#1c2e4a] px-5 py-3 text-[11px] text-[#3d5278]">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#22d3ee]" />Available</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#3d5278]" />On duty</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ef4444]" />Critical</span>
            </div>
          </div>

          {/* ── Right: Signal Feed + Chat hub ── */}
          <div className="cmd-card flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="grid shrink-0 grid-cols-3 border-b border-[#f2d8ca] bg-[#fff8f2]">
              <RightTabBtn active={rightTab === "feed"} onClick={() => setRightTab("feed")}>
                <Radio className="h-3 w-3" />Signal Feed
              </RightTabBtn>
              <RightTabBtn active={rightTab === "global"} onClick={() => setRightTab("global")}>
                <MessageSquare className="h-3 w-3" />All Units
              </RightTabBtn>
              <RightTabBtn active={rightTab === "deployments"} onClick={() => setRightTab("deployments")}>
                <Users className="h-3 w-3" />Deployment Chats
              </RightTabBtn>
            </div>

            {/* Signal Feed */}
            {rightTab === "feed" && (
              <div className="max-h-[352px] divide-y divide-[#1c2e4a] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center gap-3 px-5 py-8 text-[12px] text-[#3d5278]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#22d3ee]" />Loading feed…
                  </div>
                ) : grievances.slice(0, 10).map((item) => {
                  const sev       = SEV[item.severity] ?? SEV.Low;
                  const statusCls = STATUS_COLOR[item.status] ?? "text-[#3d5278]";
                  return (
                    <div className="px-5 py-3" key={item.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${sev.dot}`} />
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-medium text-[#f0f6ff]">{item.location_text}</div>
                            <div className="truncate text-[11px] text-[#3d5278]">{humanize(item.complaint_type)}</div>
                            <MlBadges rec={parseRec(item.agent_recommendation)} />
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={sev.badge}>{item.severity}</span>
                          <span className={`mono-id ${statusCls}`}>{humanize(item.status)}</span>
                        </div>
                      </div>
                      <div className="mono-id mt-1.5 pl-3.5">{formatDateTime(item.created_at)}</div>
                    </div>
                  );
                })}
                {!isLoading && !grievances.length ? (
                  <div className="px-5 py-8 text-[12px] text-[#3d5278]">No live complaints.</div>
                ) : null}
              </div>
            )}

            {/* All-units global broadcast */}
            {rightTab === "global" && currentUser && (
              <div className="p-3">
                <ChatPanel
                  deploymentId="global_ops"
                  myName={currentUser.name}
                  myRole={currentUser.role}
                />
                <p className="mt-2 text-[10px] text-[#394252]">
                  Open broadcast — all logged-in officers see and can reply here.
                </p>
              </div>
            )}

            {/* Per-deployment chats */}
            {rightTab === "deployments" && (
              <div className="flex-1 overflow-y-auto">
                {orders.length === 0 ? (
                  <div className="px-5 py-8 text-[12px] text-[#3d5278]">No active deployment orders.</div>
                ) : (
                  <div className="divide-y divide-[#1c2e4a]">
                    {orders.slice(0, 6).map((order) => {
                      const isOpen = chatOrderId === order.id;
                      return (
                        <div key={order.id}>
                          <button
                            className={`w-full px-4 py-3 text-left transition ${isOpen ? "bg-[#17120a]" : "hover:bg-[#10141b]"}`}
                            onClick={() => setChatOrderId(isOpen ? null : order.id)}
                            type="button"
                          >
                            <div className="mono-id text-[#e8a034]">{order.order_number}</div>
                            <div className="mt-0.5 text-[12px] font-semibold text-[#f5f7fb]">
                              {humanize(order.status)} · {order.assigned_personnel.length} assigned
                            </div>
                            <div className="mono-id mt-0.5">{order.corridor} · {formatDateTime(order.created_at)}</div>
                          </button>
                          {isOpen && currentUser && (
                            <div className="px-3 pb-3">
                              <ChatPanel
                                deploymentId={order.id}
                                myName={currentUser.name}
                                myRole={currentUser.role}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Analytics row ─────────────────────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="cmd-card p-5">
            <div className="panel-title mb-5"><AlertTriangle className="h-3.5 w-3.5 text-[#f59e0b]" />Severity Distribution</div>
            <div className="space-y-3">
              {(["Critical","High","Medium","Low"] as const).map((sev) => {
                const cfg   = SEV[sev];
                const count = sevCounts[sev] ?? 0;
                const pct   = Math.round((count / maxSev) * 100);
                return (
                  <div key={sev}>
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className={cfg.text}>{sev}</span>
                      <span className="mono-id">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#1c2e4a]">
                      <BarFill className={cfg.bar} pct={pct} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cmd-card p-5">
            <div className="panel-title mb-5"><ClipboardList className="h-3.5 w-3.5 text-[#3b82f6]" />Complaint Type Mix</div>
            <div className="space-y-3">
              {typeCounts.length ? typeCounts.map(([type, count]) => {
                const pct = Math.round((count / maxType) * 100);
                return (
                  <div key={type}>
                    <div className="mb-1.5 flex justify-between text-[12px]">
                      <span className="truncate text-[#7c9ab8]">{humanize(type)}</span>
                      <span className="mono-id ml-3 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#1c2e4a]">
                      <BarFill className="bg-[#3b82f6]" pct={pct} />
                    </div>
                  </div>
                );
              }) : <div className="text-[12px] text-[#3d5278]">No data yet.</div>}
            </div>
          </div>

          <div className="cmd-card p-5">
            <div className="panel-title mb-5"><Users className="h-3.5 w-3.5 text-[#22d3ee]" />Zone Coverage</div>
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-[12px] text-[#3d5278]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading zone coverage...</div>
              ) : personnelError ? (
                <div className="text-[12px] text-[#ef4444]">Zone coverage could not be loaded. Personnel service is unavailable.</div>
              ) : personnel.length === 0 ? (
                <div className="text-[12px] text-[#3d5278]">No active officers are registered yet.</div>
              ) : zoneCoverage.length === 0 ? (
                <div className="text-[12px] text-[#3d5278]">Officers are registered, but no zones are assigned.</div>
              ) : zoneCoverage.map(({ label, count }) => {
                const total = personnel.length || 1;
                const pct   = Math.round((count / total) * 100);
                return (
                  <div key={label}>
                    <div className="mb-1.5 flex justify-between text-[12px]">
                      <span className="text-[#7c9ab8]">{label}</span>
                      <span className="mono-id">{count} OFFICER{count !== 1 ? "S" : ""}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#1c2e4a]">
                      <BarFill className="bg-[#22d3ee]" pct={pct} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </ProtectedRoute>
  );
}

// ─── ML recommendation parser ─────────────────────────────────────────────────

interface MlRec {
  text?: string;
  duration_min?: number | null;
  duration_hrs?: number | null;
  personnel?: number | null;
  urgency?: string | null;
  detected_cause?: string | null;
  detected_veh_type?: string | null;
}

function parseRec(raw: string | null | undefined): MlRec {
  if (!raw) return {};
  try { return JSON.parse(raw) as MlRec; }
  catch { return { text: raw }; }
}

const URGENCY_COLOR: Record<string, string> = {
  CRITICAL: "text-[#ef4444]",
  HIGH:     "text-[#f59e0b]",
  MEDIUM:   "text-[#3b82f6]",
  LOW:      "text-[#10b981]",
};

function MlBadges({ rec }: { rec: MlRec }) {
  if (!rec.duration_min && !rec.personnel && !rec.urgency) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {rec.duration_min != null && (
        <span className="inline-flex items-center gap-1 rounded border border-[#252535] bg-[#0d1117] px-2 py-0.5 font-mono text-[10px] text-[#22d3ee]">
          ⏱ {Math.round(rec.duration_min)} min
        </span>
      )}
      {rec.personnel != null && (
        <span className="inline-flex items-center gap-1 rounded border border-[#252535] bg-[#0d1117] px-2 py-0.5 font-mono text-[10px] text-[#a78bfa]">
          👮 {rec.personnel} officer{rec.personnel !== 1 ? "s" : ""}
        </span>
      )}
      {rec.urgency && (
        <span className={`inline-flex items-center gap-1 rounded border border-[#252535] bg-[#0d1117] px-2 py-0.5 font-mono text-[10px] font-bold ${URGENCY_COLOR[rec.urgency] ?? "text-[#7c9ab8]"}`}>
          ⚡ {rec.urgency}
        </span>
      )}
      {rec.detected_cause && rec.detected_cause !== "others" && (
        <span className="inline-flex items-center gap-1 rounded border border-[#252535] bg-[#0d1117] px-2 py-0.5 font-mono text-[10px] text-[#7c9ab8] capitalize">
          {rec.detected_cause.replace(/_/g, " ")}
        </span>
      )}
    </div>
  );
}

function RightTabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-2 py-3 text-[9px] font-semibold uppercase tracking-[0.02em] transition ${
        active
          ? "border-[#22d3ee] text-[#22d3ee]"
          : "border-transparent text-[#3d5278] hover:text-[#7c9ab8]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function BarFill({ pct, className }: { pct: number; className: string }) {
  const width = `${Math.max(0, Math.min(100, pct))}%`;
  return <div className={`h-full rounded-full transition-all duration-700 ${className}`} style={{ width }} />;
}

function KpiCard({ icon: Icon, iconColor, label, topColor, value, sub, urgent }: {
  icon: typeof Activity; iconColor: string; label: string; topColor: string; value: number; sub: string; urgent?: boolean;
}) {
  return (
    <div className={`cmd-card border-t-2 p-4 ${topColor} ${urgent ? "ring-1 ring-[#a78bfa]/30" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="section-kicker truncate">{label}</div>
          <div className="mt-2 font-mono text-[28px] font-bold leading-none text-[#f0f6ff]">{value}</div>
          <div className={`mt-2 text-[10px] ${urgent && value > 0 ? iconColor : "text-[#3d5278]"}`}>{sub}</div>
        </div>
        <Icon className={`h-4 w-4 shrink-0 ${iconColor} ${urgent && value > 0 ? "animate-pulse" : ""}`} />
      </div>
    </div>
  );
}
