"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MapPinned,
  Radio,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";

import { trackCitizenGrievance } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { CitizenGrievance } from "@/types/prediction";

const STATUS_STEPS = [
  { key: "pending",              label: "Received",         desc: "Complaint logged and a tracking token issued." },
  { key: "in_progress",         label: "In Progress",      desc: "Command Centre operator reviewing and triaging." },
  { key: "assigned",            label: "Deployed",         desc: "Field officer dispatched to the location." },
  { key: "pending_verification", label: "Officer Resolved", desc: "Officer has resolved the situation. Awaiting Command Centre sign-off." },
  { key: "resolved",            label: "Confirmed",        desc: "Command Centre confirmed. Complaint officially closed." },
];
const STATUS_ORDER = STATUS_STEPS.map((s) => s.key);

const SEV_BADGE: Record<string, string> = {
  Critical: "badge badge-red",
  High:     "badge badge-amber",
  Medium:   "badge badge-blue",
  Low:      "badge badge-green",
};

export default function CitizenTrackPage() {
  const [trackingId, setTrackingId] = useState("");
  const [result,     setResult]     = useState<CitizenGrievance | null>(null);
  const [error,      setError]      = useState("");
  const [notFound,   setNotFound]   = useState(false);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) { setTrackingId(token); lookup(token); }
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    lookup(trackingId);
  }

  async function lookup(token: string) {
    setError(""); setResult(null); setNotFound(false);
    if (!token.trim()) { setError("Enter your DRISHTI tracking token."); return; }
    setLoading(true);
    try {
      setResult(await trackCitizenGrievance(token.trim()));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 404) setNotFound(true);
      else setError("Could not reach the tracking service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const currentStep = result ? STATUS_ORDER.indexOf(result.status) : -1;

  return (
    <div className="min-h-screen bg-[#060c18] text-[#dde8f5]">

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[#1c2e4a] bg-[#060c18]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
          <Link className="flex items-center gap-2.5" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0ea5c5] to-[#2d6ce0]">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <span className="font-mono text-[13px] font-bold tracking-[0.18em] text-[#22d3ee]">DRISHTI</span>
          </Link>
          <div className="mono-id text-[#3d5278]">Karnataka State Police · Bengaluru Traffic</div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-14">

        {/* Back */}
        <Link className="mb-8 inline-flex items-center gap-2 text-[12px] text-[#3d5278] transition hover:text-[#7c9ab8]" href="/">
          <ArrowLeft className="h-3.5 w-3.5" />Back to DRISHTI
        </Link>

        {/* Heading */}
        <div className="mb-10 text-center">
          <div className="section-kicker mb-3 text-[#22d3ee]">Complaint Tracking</div>
          <h1 className="text-[28px] font-bold text-[#f0f6ff]">Track your complaint</h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-7 text-[#7c9ab8]">
            Enter the token you received after filing. Format:{" "}
            <span className="font-mono text-[#dde8f5]">DRS-BTP-XXXXXXXXXX</span>
          </p>
        </div>

        {/* Search */}
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <input
            className="field-dark flex-1 py-3 font-mono text-[13px] uppercase tracking-widest"
            disabled={loading}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="DRS-BTP-XXXXXXXXXX"
            spellCheck={false}
            value={trackingId}
          />
          <button
            className="btn-primary shrink-0 px-5 py-3"
            disabled={loading || !trackingId.trim()}
            type="submit"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Track
          </button>
        </form>

        {/* Error states */}
        {error ? (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/8 px-4 py-3 text-[13px] text-[#fca5a5]">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#ef4444]" />{error}
          </div>
        ) : null}

        {notFound ? (
          <div className="mt-6 rounded-xl border border-[#1c2e4a] bg-[#0d1629] p-8 text-center">
            <XCircle className="mx-auto h-8 w-8 text-[#3d5278]" />
            <div className="mt-3 text-[14px] font-semibold text-[#f0f6ff]">Token not found</div>
            <p className="mt-1.5 text-[12px] text-[#3d5278]">
              Check for typos. Tokens are case-insensitive and include the full prefix.
            </p>
          </div>
        ) : null}

        {/* Result */}
        {result ? (
          <div className="mt-10 space-y-4">
            {/* Header */}
            <div className="cmd-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mono-id text-[#22d3ee]">{result.tracking_id}</div>
                  <h2 className="mt-2 text-[20px] font-bold text-[#f0f6ff]">{result.location_text}</h2>
                  <div className="mono-id mt-1">
                    {[humanize(result.complaint_type), result.corridor, result.zone].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className={SEV_BADGE[result.severity] ?? "badge badge-muted"}>
                  {result.severity}
                </span>
              </div>
              <p className="mt-4 text-[13px] leading-6 text-[#7c9ab8]">{result.description}</p>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-[#3d5278]">
                <Clock className="h-3.5 w-3.5" />Reported {formatDateTime(result.created_at)}
              </div>
            </div>

            {/* Data cards */}
            <div className="grid grid-cols-3 gap-3">
              <DataCard icon={<Clock className="h-4 w-4 text-[#22d3ee]" />} label="Status" value={humanize(result.status)} />
              <DataCard icon={<ShieldCheck className="h-4 w-4 text-[#a78bfa]" />} label="Priority score" value={`${result.agent_priority_score ?? "--"}/100`} />
              <DataCard icon={<MapPinned className="h-4 w-4 text-[#3b82f6]" />} label="Corridor" value={result.corridor || "Mapping…"} />
            </div>

            {/* Timeline */}
            <div className="cmd-card p-5">
              <div className="panel-title mb-6">Status Timeline</div>
              <ol className="relative space-y-5 border-l border-[#1c2e4a] pl-6">
                {STATUS_STEPS.map((step, idx) => {
                  const done   = idx <= currentStep;
                  const active = idx === currentStep;
                  return (
                    <li className="relative" key={step.key}>
                      <span className={`absolute -left-[25px] flex h-4 w-4 items-center justify-center rounded-full border ${
                        done ? "border-[#10b981] bg-[#10b981]" : "border-[#1c2e4a] bg-[#060c18]"
                      }`}>
                        {done ? <CheckCircle2 className="h-3 w-3 text-[#060c18]" /> : null}
                      </span>
                      <div className={`text-[13px] font-semibold ${active ? "text-[#f0f6ff]" : done ? "text-[#7c9ab8]" : "text-[#3d5278]"}`}>
                        {step.label}
                        {active ? (
                          <span className="ml-2 inline-flex items-center rounded bg-[#22d3ee]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#22d3ee]">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className={`mt-0.5 text-[12px] leading-5 ${done ? "text-[#3d5278]" : "text-[#1c2e4a]"}`}>
                        {step.desc}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Police note */}
            {result.agent_recommendation ? (
              <div className="cmd-card border-[#22d3ee]/15 p-5">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-[#22d3ee]">
                  <ShieldCheck className="h-4 w-4" />Police queue note
                </div>
                <p className="mt-3 text-[13px] leading-6 text-[#7c9ab8]">{result.agent_recommendation}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-16 border-t border-[#1c2e4a] pt-8 text-center text-[12px] text-[#3d5278]">
          Need to report a new incident?{" "}
          <Link className="text-[#22d3ee] hover:underline" href="/citizen/grievance">Go to citizen portal</Link>
          {" "}· Emergency:{" "}
          <a className="text-[#ef4444] hover:underline" href="tel:100">100</a>
        </div>
      </main>
    </div>
  );
}

function DataCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="cmd-card p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d5278]">
        {icon}{label}
      </div>
      <div className="mt-2 text-[13px] font-semibold text-[#f0f6ff]">{value}</div>
    </div>
  );
}
