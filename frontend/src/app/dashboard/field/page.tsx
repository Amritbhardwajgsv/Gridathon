"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPlus,
  Crosshair,
  Loader2,
  Navigation,
  Phone,
  Radio,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import EnrouteMapPanel from "@/components/EnrouteMapPanel";
import ProtectedRoute from "@/components/ProtectedRoute";
import { listMyFieldAssignments, officerLodgeGrievance, updateDeploymentStatus, updateMyPersonnelLocation } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime, humanize } from "@/lib/format";
import type { CitizenGrievancePayload, DeploymentStatus, FieldAssignment } from "@/types/prediction";

type DutyState = "idle" | "enroute" | "onscene" | "resolved" | "escalated";
type ActiveTab = "duty" | "report";

const DUTY_TRANSITIONS: Record<DutyState, DeploymentStatus | null> = {
  idle: "enroute", enroute: "onscene", onscene: "resolved", resolved: null, escalated: null,
};

function statusToDutyState(status: string): DutyState {
  const map: Record<string, DutyState> = {
    issued: "idle", in_progress: "idle", enroute: "enroute",
    onscene: "onscene", resolved: "resolved", escalated: "escalated",
  };
  return map[status] ?? "idle";
}

const COMPLAINT_TYPES = [
  { value: "event_congestion",      label: "Event Congestion" },
  { value: "illegal_parking",       label: "Illegal Parking" },
  { value: "road_closure",          label: "Road Closure" },
  { value: "accident_or_breakdown", label: "Accident / Breakdown" },
  { value: "signal_failure",        label: "Signal Failure" },
  { value: "other",                 label: "Other" },
];

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

export default function FieldAssignmentPage() {
  const [tab,           setTab]           = useState<ActiveTab>("duty");
  const [assignments,   setAssignments]   = useState<FieldAssignment[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isPolling,     setIsPolling]     = useState(false);
  const [locationStatus,setLocationStatus]= useState("GPS beacon inactive");
  const [lastSeen,      setLastSeen]      = useState<string | null>(null);
  const [officerPos,    setOfficerPos]    = useState<{ lat: number; lng: number } | null>(null);
  const [dutyState,     setDutyState]     = useState<DutyState>("idle");
  const [isUpdating,    setIsUpdating]    = useState(false);
  const [updateError,   setUpdateError]   = useState<string | null>(null);

  const [reportForm,    setReportForm]    = useState<CitizenGrievancePayload>({
    complaint_type: "other", severity: "Medium", location_text: "", description: "",
  });
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submittedToken,setSubmittedToken]= useState<string | null>(null);
  const [submitError,   setSubmitError]   = useState<string | null>(null);

  const autoStartedRef = useRef(false);
  const watchIdRef     = useRef<number | null>(null);
  const user           = getCurrentUser();

  async function loadAssignments() {
    try {
      const data = await listMyFieldAssignments();
      setAssignments(data);
      if (data[0]) setDutyState(statusToDutyState(data[0].status));
    } finally { setIsLoading(false); }
  }

  useEffect(() => {
    loadAssignments();
    const id = window.setInterval(loadAssignments, 30_000);
    return () => {
      window.clearInterval(id);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoStartedRef.current || isPolling) return;
    autoStartedRef.current = true;
    if (!user?.badge_id) { setLocationStatus("Badge not linked by Command Centre"); return; }
    startLocationPolling();
  }, [isPolling, user?.badge_id]);

  function startLocationPolling() {
    if (!navigator.geolocation) { setLocationStatus("GPS unavailable on this device"); return; }
    setIsPolling(true);
    setLocationStatus("Awaiting browser location permission");
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setOfficerPos({ lat: latitude, lng: longitude });
        try {
          const r = await updateMyPersonnelLocation({ accuracy_meters: accuracy, latitude, longitude });
          setLastSeen(r.last_location_at);
          setLocationStatus(`Live beacon synced every ${r.polling_interval_seconds}s`);
        } catch { setLocationStatus("Badge link not confirmed by Command Centre"); }
      },
      () => { setIsPolling(false); setLocationStatus("GPS permission denied"); },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 }
    );
  }

  async function advanceDutyState(next: DutyState) {
    const active = assignments[0];
    if (!active) return;
    const deploymentStatus = DUTY_TRANSITIONS[dutyState];
    if (!deploymentStatus) return;
    setIsUpdating(true); setUpdateError(null);
    try {
      await updateDeploymentStatus(active.order_id, { status: deploymentStatus });
      setDutyState(next);
      await loadAssignments();
    } catch { setUpdateError("Could not update duty status. Try again."); }
    finally { setIsUpdating(false); }
  }

  async function escalateAssignment() {
    const active = assignments[0];
    if (!active) return;
    setIsUpdating(true); setUpdateError(null);
    try {
      await updateDeploymentStatus(active.order_id, { status: "escalated" });
      setDutyState("escalated");
      await loadAssignments();
    } catch { setUpdateError("Could not escalate. Try again."); }
    finally { setIsUpdating(false); }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true); setSubmittedToken(null); setSubmitError(null);
    try {
      const result = await officerLodgeGrievance({
        ...reportForm,
        reporter_name: `${user?.rank || ""} ${user?.name || ""}`.trim() || undefined,
      });
      setSubmittedToken(result.tracking_id);
      setReportForm({ complaint_type: "other", severity: "Medium", location_text: "", description: "" });
    } catch { setSubmitError("Could not submit report. Check connection and try again."); }
    finally { setIsSubmitting(false); }
  }

  const activeAssignment = assignments[0] || null;

  return (
    <ProtectedRoute allowedRoles={["operator"]}>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-kicker flex items-center gap-2 text-[#22d3ee]">
              <Radio className="h-3.5 w-3.5" />Field Operations
            </div>
            <h1 className="page-title mt-1">Officer duty and field reports</h1>
          </div>
          <div className="flex gap-1 rounded-lg border border-[#1c2e4a] bg-[#0d1629] p-0.5">
            <TabBtn active={tab === "duty"}   onClick={() => setTab("duty")}>Active Duty</TabBtn>
            <TabBtn active={tab === "report"} onClick={() => setTab("report")}>
              <ClipboardPlus className="h-3.5 w-3.5" />Lodge Report
            </TabBtn>
          </div>
        </div>

        {tab === "duty" ? (
          <>
            {isLoading ? (
              <div className="cmd-card flex items-center gap-3 p-6 text-[12px] text-[#3d5278]">
                <Loader2 className="h-4 w-4 animate-spin text-[#22d3ee]" />Loading assigned duty…
              </div>
            ) : activeAssignment ? (
              <section className="cmd-card border-t-2 border-t-[#22d3ee] p-5">
                <div className="mono-id text-[#22d3ee]">
                  {activeAssignment.order_number} / {formatDateTime(activeAssignment.created_at)}
                  {activeAssignment.complaint_tracking_id ? ` / ${activeAssignment.complaint_tracking_id}` : null}
                </div>
                <h2 className="mt-3 text-[22px] font-semibold text-[#f0f6ff]">
                  {activeAssignment.complaint_location || activeAssignment.corridor}
                </h2>
                <p className="mt-3 max-w-4xl text-[13px] leading-6 text-[#7c9ab8]">
                  {activeAssignment.field_brief || "Proceed to assigned location and update Command Centre."}
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <InfoTile label="Location"  value={activeAssignment.complaint_location || activeAssignment.corridor} />
                  <InfoTile label="Corridor"  value={activeAssignment.corridor || "--"} />
                  <InfoTile label="Priority"  value={activeAssignment.priority} />
                  <InfoTile label="Complaint" value={humanize(activeAssignment.complaint_type || "field duty")} />
                </div>
              </section>
            ) : (
              <section className="cmd-card grid min-h-64 place-items-center p-8 text-center">
                <div>
                  <CheckCircle2 className="mx-auto h-9 w-9 text-[#10b981]" />
                  <h2 className="mt-3 text-[18px] font-semibold text-[#f0f6ff]">No active duty task</h2>
                  <p className="mt-2 text-[12px] text-[#3d5278]">
                    Stay available. New tasks assigned by Command Centre will appear here.
                  </p>
                </div>
              </section>
            )}

            {dutyState === "enroute" && activeAssignment ? (
              <section className="cmd-card p-5">
                <div className="panel-title mb-4 flex items-center gap-2">
                  <Navigation className="h-3.5 w-3.5 text-[#f59e0b]" />Navigation &amp; Carry Checklist
                </div>
                <EnrouteMapPanel
                  complaintType={activeAssignment.complaint_type || "other"}
                  deploymentId={activeAssignment.order_id}
                  myName={user?.name ?? "Officer"}
                  myRole={user?.role ?? "operator"}
                  officerLat={officerPos?.lat ?? null}
                  officerLng={officerPos?.lng ?? null}
                  targetLabel={activeAssignment.complaint_location || activeAssignment.corridor}
                  targetLat={activeAssignment.deployment_latitude ?? null}
                  targetLng={activeAssignment.deployment_longitude ?? null}
                />
              </section>
            ) : null}

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="cmd-card p-5">
                <div className="panel-title flex items-center gap-2">
                  <Crosshair className="h-3.5 w-3.5 text-[#22d3ee]" />GPS Beacon Status
                </div>
                <div className="mt-4 flex items-center gap-4 rounded-lg border border-[#1c2e4a] bg-[#060c18] p-4">
                  <div className={`live-breathe flex h-14 w-14 items-center justify-center rounded-full ${isPolling ? "bg-[#22d3ee]" : "bg-[#1c2e4a]"}`}>
                    <Navigation className="h-6 w-6 text-[#060c18]" />
                  </div>
                  <div>
                    <div className={`text-[13px] font-semibold ${isPolling ? "text-[#22d3ee]" : "text-[#7c9ab8]"}`}>
                      {isPolling ? "Beacon Active" : "Beacon Inactive"}
                    </div>
                    <div className="mt-1 text-[12px] text-[#7c9ab8]">{locationStatus}</div>
                    {lastSeen ? <div className="mono-id mt-2">LAST {formatDateTime(lastSeen)}</div> : null}
                  </div>
                </div>
                <div className="mt-3 text-[12px] leading-6 text-[#3d5278]">
                  Location permission lets Command Centre assign the nearest available officer.
                </div>
              </div>

              <div className="cmd-card p-5">
                <div className="panel-title flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#f59e0b]" />Officer Actions
                </div>

                {updateError ? (
                  <div className="mt-3 rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/8 px-3 py-2 text-[12px] text-[#fca5a5]">
                    {updateError}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-2">
                  <DutyButton active={dutyState === "enroute"}   disabled={dutyState !== "idle"    || !activeAssignment || isUpdating} loading={isUpdating && dutyState === "idle"}    onClick={() => advanceDutyState("enroute")}>En Route</DutyButton>
                  <DutyButton active={dutyState === "onscene"}   disabled={dutyState !== "enroute" || !activeAssignment || isUpdating} loading={isUpdating && dutyState === "enroute"} onClick={() => advanceDutyState("onscene")}>On Scene</DutyButton>
                  <DutyButton active={dutyState === "resolved"}  disabled={dutyState !== "onscene" || !activeAssignment || isUpdating} loading={isUpdating && dutyState === "onscene"} onClick={() => advanceDutyState("resolved")}>Mark Resolved</DutyButton>
                  <DutyButton active={dutyState === "escalated"} disabled={dutyState === "resolved" || dutyState === "escalated" || !activeAssignment || isUpdating} loading={false}                                   onClick={escalateAssignment}>Escalate</DutyButton>
                  <a className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-[#1c2e4a] px-3 py-2 text-[12px] text-[#dde8f5] hover:bg-[#0d1629]" href="tel:100">
                    <Phone className="h-3.5 w-3.5" />Call Command Centre (100)
                  </a>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="mx-auto max-w-xl">
            <div className="cmd-card p-5">
              <div className="panel-title mb-5 flex items-center gap-2">
                <ClipboardPlus className="h-3.5 w-3.5 text-[#22d3ee]" />File a Field Incident Report
              </div>

              {submittedToken ? (
                <div className="mb-5 rounded-lg border border-[#10b981]/25 bg-[#10b981]/8 p-4">
                  <div className="text-[13px] font-semibold text-[#10b981]">Report submitted.</div>
                  <div className="mono-id mt-2 text-[#10b981]">{submittedToken}</div>
                  <p className="mt-2 text-[12px] text-[#7c9ab8]">
                    Keep this token. The complaint is now visible to the Control Centre operator.
                  </p>
                </div>
              ) : null}

              {submitError ? (
                <div className="mb-5 rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/8 px-3 py-2 text-[12px] text-[#fca5a5]">
                  {submitError}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmitReport}>
                <div>
                  <label className="section-kicker mb-2 block" htmlFor="complaint_type">Incident Type</label>
                  <select
                    className="field-dark"
                    id="complaint_type"
                    onChange={(e) => setReportForm((f) => ({ ...f, complaint_type: e.target.value as CitizenGrievancePayload["complaint_type"] }))}
                    title="Incident type"
                    value={reportForm.complaint_type}
                  >
                    {COMPLAINT_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                  </select>
                </div>

                <div>
                  <div className="section-kicker mb-2">Severity</div>
                  <div className="grid grid-cols-4 gap-1">
                    {SEVERITIES.map((sev) => (
                      <button
                        className={`rounded-lg border py-2 text-[12px] font-semibold transition ${
                          reportForm.severity === sev
                            ? "border-[#22d3ee] bg-[#22d3ee]/10 text-[#22d3ee]"
                            : "border-[#1c2e4a] text-[#3d5278] hover:border-[#243a5c]"
                        }`}
                        key={sev}
                        onClick={() => setReportForm((f) => ({ ...f, severity: sev }))}
                        type="button"
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="section-kicker mb-2 block" htmlFor="location_text">Location / Landmark</label>
                  <input className="field-dark" id="location_text" onChange={(e) => setReportForm((f) => ({ ...f, location_text: e.target.value }))} placeholder="e.g. Hebbal Flyover, ORR North" required type="text" value={reportForm.location_text} />
                </div>

                <div>
                  <label className="section-kicker mb-2 block" htmlFor="description">Description</label>
                  <textarea className="field-dark" id="description" minLength={10} onChange={(e) => setReportForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief situation description for the Control Centre operator…" required rows={4} value={reportForm.description} />
                </div>

                <button className="btn-primary w-full justify-center py-2.5 text-[13px]" disabled={isSubmitting || !reportForm.location_text || !reportForm.description} type="submit">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit Field Report"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function TabBtn({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
        active ? "bg-[#22d3ee]/10 text-[#22d3ee]" : "text-[#3d5278] hover:text-[#7c9ab8]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1c2e4a] bg-[#060c18] p-3">
      <div className="section-kicker">{label}</div>
      <div className="mt-2 text-[12px] font-semibold text-[#f0f6ff]">{value}</div>
    </div>
  );
}

function DutyButton({ active, children, disabled, loading, onClick }: {
  active: boolean; children: string; disabled: boolean; loading: boolean; onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] transition ${
        active   ? "bg-[#22d3ee] text-[#060c18]" :
        disabled ? "border border-[#1c2e4a] text-[#3d5278] opacity-60" :
                   "border border-[#22d3ee]/35 text-[#22d3ee] hover:bg-[#22d3ee]/10"
      }`}
      disabled={disabled || loading}
      onClick={onClick}
      type="button"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}
