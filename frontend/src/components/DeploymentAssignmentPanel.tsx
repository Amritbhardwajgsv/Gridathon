"use client";

import {
  CheckCircle2,
  Loader2,
  MapPinned,
  MessageSquare,
  Navigation,
  Radio,
  Send,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ChatPanel from "@/components/ChatPanel";
import ProgressBar from "@/components/ProgressBar";
import {
  createDeploymentOrder,
  listCitizenGrievances,
  listDeploymentOrders,
  listPersonnel,
} from "@/lib/api";
import { haversineKm } from "@/lib/distance";
import { formatDateTime, humanize } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { RANK_ORDER } from "@/lib/roles";
import type { CitizenGrievance, DeploymentOrder, PolicePersonnel } from "@/types/prediction";

// ── Suggested strength from severity ────────────────────────────────────────

const SEVERITY_STRENGTH: Record<string, { count: number; label: string }> = {
  Critical: { count: 12, label: "1 Inspector + 2 SI + 6 Constables + 2 ASI + 1 PCR" },
  High:     { count:  8, label: "1 SI + 4 Constables + 2 ASI" },
  Medium:   { count:  4, label: "1 SI + 3 Constables" },
  Low:      { count:  2, label: "1 Constable + 1 ASI" },
};

type PersonnelWithDist = PolicePersonnel & { distanceKm: number | null };

export default function DeploymentAssignmentPanel() {
  const [grievances, setGrievances]             = useState<CitizenGrievance[]>([]);
  const [personnel, setPersonnel]               = useState<PolicePersonnel[]>([]);
  const [orders, setOrders]                     = useState<DeploymentOrder[]>([]);
  const [selectedGrievanceId, setSelectedGrievanceId] = useState("");
  const [requiredCount, setRequiredCount]       = useState("4");
  const [fieldBrief, setFieldBrief]             = useState("");
  const [isLoading, setIsLoading]               = useState(true);
  const [isIssuing, setIsIssuing]               = useState(false);
  const [message, setMessage]                   = useState<{ text: string; ok: boolean } | null>(null);
  const [manualMode, setManualMode]             = useState(false);
  const [selectedIds, setSelectedIds]           = useState<Set<string>>(new Set());
  const [rankFilter, setRankFilter]             = useState("all");
  const [searchQuery, setSearchQuery]           = useState("");
  const [chatOrderId, setChatOrderId]           = useState<string | null>(null);

  const currentUser = getCurrentUser();

  async function load() {
    setIsLoading(true);
    const [g, p, o] = await Promise.all([
      listCitizenGrievances(),
      listPersonnel(),
      listDeploymentOrders(),
    ]);
    const active = g.filter((item) => item.status !== "resolved");
    setGrievances(active);
    setPersonnel(p);
    setOrders(o);
    setSelectedGrievanceId((cur) => (cur && active.some((a) => a.id === cur) ? cur : active[0]?.id ?? ""));
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  const selectedGrievance = useMemo(
    () => grievances.find((item) => item.id === selectedGrievanceId) ?? null,
    [grievances, selectedGrievanceId],
  );

  // Auto-fill personnel count from severity when complaint changes
  useEffect(() => {
    if (!selectedGrievance) return;
    const suggested = SEVERITY_STRENGTH[selectedGrievance.severity];
    if (suggested) setRequiredCount(String(suggested.count));
  }, [selectedGrievance?.id]);

  // Sort ALL personnel by Haversine distance; keep a separate available-only list for auto-nearest
  const allPersonnelWithDist = useMemo<PersonnelWithDist[]>(() => {
    const compLat = selectedGrievance?.latitude ?? null;
    const compLng = selectedGrievance?.longitude ?? null;
    return personnel
      .map((p) => ({
        ...p,
        distanceKm:
          compLat !== null && compLng !== null && p.current_latitude && p.current_longitude
            ? haversineKm(compLat, compLng, p.current_latitude, p.current_longitude)
            : null,
      }))
      .sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) {
          return (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
        }
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [personnel, selectedGrievance]);

  // Available-only subset — used for auto-nearest count and sidebar preview
  const personnelWithDist = useMemo(
    () => allPersonnelWithDist.filter((p) => p.is_available),
    [allPersonnelWithDist],
  );

  // Manual-mode picker: search across ALL officers, rank-filter and text-filter
  const filteredPersonnel = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPersonnelWithDist.filter((p) => {
      if (rankFilter !== "all" && p.rank !== rankFilter) return false;
      if (!q) return true;
      return (
        p.badge_id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.zone ?? "").toLowerCase().includes(q)
      );
    });
  }, [allPersonnelWithDist, rankFilter, searchQuery]);

  const availableRanks = useMemo(() => {
    const ranks = new Set(allPersonnelWithDist.map((p) => p.rank));
    return Array.from(ranks).sort((a, b) => (RANK_ORDER[a] ?? 99) - (RANK_ORDER[b] ?? 99));
  }, [allPersonnelWithDist]);

  function toggleOfficer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function issueDeployment() {
    if (!selectedGrievance) { setMessage({ text: "Select a complaint first.", ok: false }); return; }
    if (fieldBrief.trim().length < 10) { setMessage({ text: "Add a field brief (min 10 chars).", ok: false }); return; }
    if (manualMode && selectedIds.size === 0) { setMessage({ text: "Select at least one officer.", ok: false }); return; }

    setIsIssuing(true);
    setMessage(null);
    try {
      const order = await createDeploymentOrder({
        grievance_id: selectedGrievance.id,
        auto_assign_nearest: !manualMode,
        required_personnel_count: Number(requiredCount),
        personnel_ids: manualMode ? Array.from(selectedIds) : [],
        field_brief: fieldBrief.trim(),
        status: "issued",
      });
      const assigned = order.assigned_personnel.length;
      setMessage({
        text: `${order.order_number} issued to ${assigned} officer(s).`,
        ok: true,
      });
      setRequiredCount(String(assigned));
      setFieldBrief("");
      setSelectedIds(new Set());
      await load();
    } catch {
      setMessage({ text: "Could not issue deployment order.", ok: false });
    } finally {
      setIsIssuing(false);
    }
  }

  const strength = selectedGrievance ? SEVERITY_STRENGTH[selectedGrievance.severity] : null;
  const hasGPS = !!(selectedGrievance?.latitude && selectedGrievance?.longitude);

  return (
    <div className="command-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#252b35] px-5 py-4">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-[#e8a034]" />
          <div className="panel-title">Complaint-linked Duty Dispatch</div>
        </div>
        <div className="flex gap-1 rounded border border-[#252b35] bg-[#10141b] p-0.5">
          <ModeBtn active={!manualMode} onClick={() => setManualMode(false)}>Auto nearest</ModeBtn>
          <ModeBtn active={manualMode} onClick={() => { setManualMode(true); setSelectedIds(new Set()); setSearchQuery(""); }}>
            Manual select
          </ModeBtn>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 p-8 text-[12px] text-[#707987]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading personnel and complaints...
        </div>
      ) : (
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── Left: complaint selector + brief ─────────────────── */}
          <div className="space-y-4">
            <div>
              <label className="section-kicker mb-2 block" htmlFor="grievance-select">
                Complaint Report
              </label>
              <select
                className="w-full rounded border border-[#252b35] bg-[#10141b] px-3 py-2 text-[13px] text-[#dce2ea] outline-none focus:border-[#e8a034]/50"
                id="grievance-select"
                onChange={(e) => { setSelectedGrievanceId(e.target.value); setSelectedIds(new Set()); }}
                value={selectedGrievanceId}
              >
                {grievances.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.tracking_id} · {item.location_text} · {item.severity}
                  </option>
                ))}
              </select>
            </div>

            {selectedGrievance ? (
              <div className="rounded border border-[#252b35] bg-[#10141b] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mono-id">{selectedGrievance.tracking_id}</div>
                    <div className="mt-1 text-[14px] font-semibold text-[#f5f7fb]">
                      {selectedGrievance.location_text}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-[#9ba5b3]">
                      {selectedGrievance.description}
                    </p>
                  </div>
                  <span className="mono-id shrink-0 rounded border border-[#252b35] px-2 py-1 text-[#e8a034]">
                    {selectedGrievance.severity}
                  </span>
                </div>

                {selectedGrievance.agent_recommendation ? (
                  <div className="mt-3 rounded border border-[#e8a034]/20 bg-[#17120a] p-3 text-[12px] leading-5 text-[#f6e7c8]">
                    <div className="mono-id mb-1 text-[#e8a034]">DRISHTI-AI Recommendation</div>
                    {selectedGrievance.agent_recommendation}
                  </div>
                ) : null}

                {strength ? (
                  <div className="mt-3 rounded border border-[#4e8fe8]/20 bg-[#4e8fe8]/5 p-3">
                    <div className="mono-id mb-1 text-[#4e8fe8]">Predicted Strength Required</div>
                    <div className="text-[12px] text-[#dce2ea]">{strength.label}</div>
                    <div className="mt-2">
                      <ProgressBar
                        colorClass="bg-[#4e8fe8]"
                        max={12}
                        value={strength.count}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                  <span className="mono-id">{selectedGrievance.zone || "Zone pending"}</span>
                  <span className="text-[#394252]">·</span>
                  <span className="mono-id">{selectedGrievance.corridor || "Corridor pending"}</span>
                  <span className="text-[#394252]">·</span>
                  <span className="mono-id">
                    Priority {selectedGrievance.agent_priority_score ?? "--"}/100
                  </span>
                  {hasGPS ? (
                    <>
                      <span className="text-[#394252]">·</span>
                      <span className="mono-id flex items-center gap-1 text-[#35b779]">
                        <MapPinned className="h-3 w-3" /> GPS mapped
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Manual officer picker */}
            {manualMode ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="section-kicker">
                    Select officers
                    {hasGPS ? " — sorted by distance from complaint" : " — sorted by rank"}
                  </div>
                  <div className="flex gap-1">
                    <input
                      className="w-36 rounded border border-[#252b35] bg-[#10141b] px-2 py-1 text-[11px] text-[#dce2ea] placeholder-[#505866] outline-none focus:border-[#e8a034]/50"
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Badge ID or name..."
                      type="text"
                      value={searchQuery}
                    />
                    <select
                      aria-label="Filter by rank"
                      className="rounded border border-[#252b35] bg-[#10141b] px-2 py-1 text-[11px] text-[#dce2ea] outline-none"
                      onChange={(e) => setRankFilter(e.target.value)}
                      value={rankFilter}
                    >
                      <option value="all">All ranks</option>
                      {availableRanks.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {personnel.length === 0 ? (
                  <div className="rounded border border-[#e8a034]/20 bg-[#17120a] px-4 py-3 text-[12px] text-[#f6e7c8]">
                    No officers in registry yet.{" "}
                    <a className="text-[#e8a034] hover:underline" href="/dashboard/personnel">
                      Add via Personnel Registry
                    </a>{" "}
                    — users approved in Access Requests also need a personnel record with badge and zone.
                  </div>
                ) : null}

                <div className="max-h-64 overflow-y-auto rounded border border-[#252b35]">
                  {filteredPersonnel.length ? (
                    <div className="divide-y divide-[#1a1f28]">
                      {filteredPersonnel.map((officer, idx) => {
                        const checked = selectedIds.has(officer.id);
                        return (
                          <button
                            className={`block w-full px-4 py-3 text-left text-[12px] transition ${checked ? "bg-[#19b7a5]/10 border-l-2 border-[#19b7a5]" : "border-l-2 border-transparent hover:bg-[#10141b]"}`}
                            key={officer.id}
                            onClick={() => toggleOfficer(officer.id)}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-[#19b7a5] bg-[#19b7a5]" : "border-[#394252]"}`}>
                                  {checked ? <CheckCircle2 className="h-3 w-3 text-[#0a0c0f]" /> : null}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[#f5f7fb]">
                                      {idx + 1}. {officer.name}
                                    </span>
                                    <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${officer.is_available ? "bg-[#35b779]/15 text-[#35b779]" : "bg-[#e05252]/15 text-[#e05252]"}`}>
                                      {officer.is_available ? "Free" : "Busy"}
                                    </span>
                                  </div>
                                  <div className="mono-id mt-0.5">
                                    {officer.badge_id} · {officer.rank} · {officer.zone || "No zone"}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                {officer.distanceKm !== null ? (
                                  <span className="mono-id flex items-center gap-1 text-[#35b779]">
                                    <Navigation className="h-3 w-3" />
                                    {officer.distanceKm.toFixed(1)} km
                                  </span>
                                ) : (
                                  <span className="mono-id text-[#505866]">No GPS</span>
                                )}
                                {officer.last_location_at ? (
                                  <div className="mono-id mt-0.5 text-[10px] text-[#505866]">
                                    {formatDateTime(officer.last_location_at)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-[12px] text-[#707987]">
                      {personnel.length > 0 ? "No officers match filter." : "No officers in registry."}
                    </div>
                  )}
                </div>

                {selectedIds.size > 0 ? (
                  <div className="rounded border border-[#19b7a5]/30 bg-[#19b7a5]/10 px-3 py-2 text-[12px] text-[#19b7a5]">
                    {selectedIds.size} officer{selectedIds.size > 1 ? "s" : ""} selected
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded border border-[#252b35] bg-[#10141b] px-4 py-3 text-[12px] text-[#9ba5b3]">
                <span className="font-semibold text-[#dce2ea]">Auto-nearest mode:</span> DRISHTI will
                select the closest {requiredCount} available officers using live GPS coordinates.
                {!hasGPS ? " (Complaint has no GPS — auto-assign uses zone matching.)" : ""}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
              <div>
                <label className="section-kicker mb-2 block" htmlFor="req-count">
                  Personnel count
                </label>
                <input
                  className="w-full rounded border border-[#252b35] bg-[#10141b] px-3 py-2 text-[13px] text-[#dce2ea] outline-none focus:border-[#e8a034]/50"
                  id="req-count"
                  max={25}
                  min={1}
                  onChange={(e) => setRequiredCount(e.target.value)}
                  type="number"
                  value={requiredCount}
                />
              </div>
              <div>
                <label className="section-kicker mb-2 block" htmlFor="field-brief">
                  Field duty brief
                </label>
                <input
                  className="w-full rounded border border-[#252b35] bg-[#10141b] px-3 py-2 text-[13px] text-[#dce2ea] placeholder-[#505866] outline-none focus:border-[#e8a034]/50"
                  id="field-brief"
                  onChange={(e) => setFieldBrief(e.target.value)}
                  placeholder="Proceed to location, secure junction, update control room."
                  value={fieldBrief}
                />
              </div>
            </div>

            {message ? (
              <div
                className={`rounded border px-3 py-2 text-[12px] ${
                  message.ok
                    ? "border-[#35b779]/30 bg-[#35b779]/10 text-[#35b779]"
                    : "border-[#e05252]/30 bg-[#e05252]/10 text-[#e05252]"
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <button
              className="inline-flex items-center gap-2 rounded bg-[#e8a034] px-5 py-2.5 text-[12px] font-semibold text-[#0a0c0f] transition hover:bg-[#f0b75d] disabled:opacity-60"
              disabled={isIssuing || !selectedGrievance}
              onClick={issueDeployment}
              type="button"
            >
              {isIssuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {manualMode ? `Issue to ${selectedIds.size || "selected"} officer(s)` : "Issue nearest duty task"}
            </button>
          </div>

          {/* ── Right: availability panel ─────────────────────────── */}
          <aside className="space-y-4">
            <div className="command-panel stat-top-teal p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="section-kicker">Available officers</div>
                  <div className="mt-2 font-mono text-3xl text-[#f5f7fb]">
                    {personnelWithDist.length}
                  </div>
                  {hasGPS ? (
                    <div className="mono-id mt-1 text-[#35b779]">
                      Distances computed from complaint GPS
                    </div>
                  ) : (
                    <div className="mono-id mt-1 text-[#707987]">
                      Complaint has no GPS — auto-assign uses zone
                    </div>
                  )}
                </div>
                <Users className="h-4 w-4 text-[#19b7a5]" />
              </div>
            </div>

            {/* Top 5 nearest in auto mode */}
            {!manualMode && personnelWithDist.length > 0 ? (
              <div className="command-panel overflow-hidden">
                <div className="border-b border-[#252b35] px-4 py-3">
                  <div className="panel-title text-[10px]">
                    <Navigation className="h-3 w-3 text-[#19b7a5]" />
                    {hasGPS ? "Nearest to complaint" : "Available officers by rank"}
                  </div>
                </div>
                <div className="divide-y divide-[#1a1f28]">
                  {personnelWithDist.slice(0, 5).map((officer, idx) => (
                    <div className="flex items-center justify-between px-4 py-2.5" key={officer.id}>
                      <div>
                        <div className="text-[12px] font-semibold text-[#f5f7fb]">
                          {idx + 1}. {officer.name}
                        </div>
                        <div className="mono-id mt-0.5">{officer.rank} · {officer.zone || "--"}</div>
                      </div>
                      {officer.distanceKm !== null ? (
                        <span className="mono-id text-[#35b779]">
                          {officer.distanceKm.toFixed(1)} km
                        </span>
                      ) : (
                        <span className="mono-id text-[#505866]">No GPS</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="command-panel overflow-hidden">
              <div className="border-b border-[#252b35] px-4 py-3">
                <div className="panel-title text-[10px]">
                  <MapPinned className="h-3 w-3 text-[#e8a034]" />
                  Active duty orders · click to open deployment chat
                </div>
              </div>
              <div className="divide-y divide-[#1a1f28]">
                {orders.slice(0, 4).map((order) => {
                  const isSelected = chatOrderId === order.id;
                  return (
                    <div key={order.id}>
                      <button
                        className={`w-full px-4 py-3 text-left transition ${isSelected ? "bg-[#17120a]" : "hover:bg-[#10141b]"}`}
                        onClick={() => setChatOrderId(isSelected ? null : order.id)}
                        type="button"
                      >
                        <div className="mono-id">{order.order_number}</div>
                        <div className="mt-1 text-[12px] font-semibold text-[#f5f7fb]">
                          {humanize(order.status)} · {order.assigned_personnel.length} assigned
                        </div>
                        <div className="mono-id mt-0.5">
                          {order.corridor} · {formatDateTime(order.created_at)}
                        </div>
                      </button>
                      {isSelected && currentUser && (
                        <div className="px-4 pb-3">
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
                {!orders.length ? (
                  <div className="px-4 py-4 text-[12px] text-[#707987]">No active duty orders.</div>
                ) : null}
              </div>
            </div>

            {/* ── All-units broadcast channel ─────────────────────── */}
            {currentUser && (
              <div className="command-panel overflow-hidden">
                <div className="border-b border-[#252b35] px-4 py-3">
                  <div className="panel-title text-[10px] flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 text-[#19b7a5]" />
                    All Units Broadcast
                  </div>
                  <div className="mono-id mt-0.5 text-[10px]">
                    All field officers can see and reply here
                  </div>
                </div>
                <div className="p-3">
                  <ChatPanel
                    deploymentId="global_ops"
                    myName={currentUser.name}
                    myRole={currentUser.role}
                  />
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function ModeBtn({
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
      className={`rounded px-3 py-1 text-[11px] font-semibold transition ${
        active ? "bg-[#e8a034] text-[#0a0c0f]" : "text-[#9ba5b3] hover:text-[#dce2ea]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
