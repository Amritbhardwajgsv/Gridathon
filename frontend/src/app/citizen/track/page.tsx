"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
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
import { useEffect, useState } from "react";

import { trackCitizenGrievance } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { CitizenGrievance } from "@/types/prediction";

const STATUS_STEPS = [
  { key: "pending",               label: "Received",         desc: "Complaint logged and a tracking token issued." },
  { key: "in_progress",           label: "In Progress",      desc: "Command Centre operator reviewing and triaging." },
  { key: "assigned",              label: "Deployed",         desc: "Field officer dispatched to the location." },
  { key: "pending_verification",  label: "Officer Resolved", desc: "Officer has resolved. Awaiting Command Centre sign-off." },
  { key: "resolved",              label: "Confirmed",        desc: "Command Centre confirmed. Complaint officially closed." },
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    <div className="min-h-screen bg-[#08080F] text-[#F0F0F8]">

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b-2 border-[#252535] bg-[#08080F]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-3" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#FFE600]">
              <Radio className="h-4 w-4 text-[#08080F]" />
            </div>
            <span className="font-mono text-[12px] font-bold tracking-[0.22em] text-[#FFE600]">DRISHTI</span>
          </Link>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#444455]">Karnataka State Police · Bengaluru Traffic</div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-14">

        <Link className="mb-8 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#444455] transition hover:text-[#8888A0]" href="/">
          <ArrowLeft className="h-3.5 w-3.5" />Back to DRISHTI
        </Link>

        <div className="mb-10">
          <div className="section-kicker mb-3 text-[#FFE600]">+ Complaint Tracking</div>
          <h1 className="text-[34px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
            Track your<br />complaint.
          </h1>
          <p className="mt-4 text-[13px] leading-6 text-[#8888A0]">
            Enter the token you received after filing. Format:{" "}
            <span className="font-mono font-bold text-[#F0F0F8]">DRS-BTP-XXXXXXXXXX</span>
          </p>
        </div>

        {/* Search bar */}
        <form className="flex gap-3" onSubmit={handleSubmit}>
          <input
            className="field-dark flex-1 font-mono text-[13px] uppercase tracking-widest"
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
            {!loading && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </form>

        {/* Error states */}
        {error ? (
          <div className="mt-6 flex items-center gap-3 rounded border-2 border-[#EF4444]/30 bg-[#EF4444]/8 px-4 py-3 text-[13px] text-[#FCA5A5]">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />{error}
          </div>
        ) : null}

        {notFound ? (
          <div className="browser-card mt-6">
            <div className="browser-card-header border-b-2 border-[#252535]">
              <span className="browser-dot browser-dot-red" />
              <span className="browser-dot browser-dot-yellow" />
              <span className="browser-dot browser-dot-green" />
              <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">NOT FOUND</span>
            </div>
            <div className="p-8 text-center">
              <XCircle className="mx-auto h-8 w-8 text-[#444455]" />
              <div className="mt-3 text-[15px] font-black uppercase text-[#F0F0F8]">Token not found</div>
              <p className="mt-1.5 text-[12px] text-[#444455]">
                Check for typos. Tokens are case-insensitive and include the full prefix.
              </p>
            </div>
          </div>
        ) : null}

        {/* Result */}
        {result ? (
          <div className="mt-10 space-y-4">

            {/* Header card */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">{result.tracking_id}</span>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[20px] font-black uppercase tracking-[-0.01em] text-[#F0F0F8]">{result.location_text}</h2>
                    <div className="mt-1 font-mono text-[10px] text-[#444455]">
                      {[humanize(result.complaint_type), result.corridor, result.zone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className={SEV_BADGE[result.severity] ?? "badge badge-muted"}>
                    {result.severity}
                  </span>
                </div>
                <p className="mt-4 text-[13px] leading-6 text-[#8888A0]">{result.description}</p>
                <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#444455]">
                  <Clock className="h-3.5 w-3.5" />Reported {formatDateTime(result.created_at)}
                </div>
              </div>
            </div>

            {/* Data cards */}
            <div className="grid grid-cols-3 gap-3">
              <DataCard icon={<Clock className="h-4 w-4 text-[#FFE600]" />} label="Status" value={humanize(result.status)} />
              <DataCard icon={<ShieldCheck className="h-4 w-4 text-[#A78BFA]" />} label="Priority" value={`${result.agent_priority_score ?? "--"}/100`} />
              <DataCard icon={<MapPinned className="h-4 w-4 text-[#22D3EE]" />} label="Corridor" value={result.corridor || "Mapping…"} />
            </div>

            {/* Timeline */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">STATUS TIMELINE</span>
              </div>
              <div className="p-5">
                <ol className="relative space-y-5 border-l-2 border-[#252535] pl-7">
                  {STATUS_STEPS.map((step, idx) => {
                    const done   = idx <= currentStep;
                    const active = idx === currentStep;
                    return (
                      <li className="relative" key={step.key}>
                        <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                          done ? "border-[#10B981] bg-[#10B981]" : "border-[#252535] bg-[#08080F]"
                        }`}>
                          {done ? <CheckCircle2 className="h-3 w-3 text-[#08080F]" /> : null}
                        </span>
                        <div className={`text-[13px] font-bold uppercase tracking-[0.04em] ${active ? "text-[#F0F0F8]" : done ? "text-[#8888A0]" : "text-[#444455]"}`}>
                          {step.label}
                          {active ? (
                            <span className="ml-2 inline-flex items-center rounded border-2 border-[#FFE600]/30 bg-[#FFE600]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#FFE600]">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <p className={`mt-0.5 text-[12px] leading-5 ${done ? "text-[#444455]" : "text-[#252535]"}`}>
                          {step.desc}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            {/* Police note */}
            {result.agent_recommendation ? (() => {
              const isRejected = result.agent_recommendation.startsWith("[FIREWALL REJECTED]");
              return (
                <div className={`browser-card border-2 ${isRejected ? "border-[#EF4444]/40 bg-[#EF4444]/5" : "border-[#FFE600]/20"}`}>
                  <div className={`browser-card-header border-b-2 ${isRejected ? "border-[#EF4444]/30" : "border-[#FFE600]/20"}`}>
                    <span className="browser-dot browser-dot-red" />
                    <span className="browser-dot browser-dot-yellow" />
                    <span className="browser-dot browser-dot-green" />
                    <div className={`ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${isRejected ? "text-[#EF4444]" : "text-[#FFE600]"}`}>
                      {isRejected ? <XCircle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {isRejected ? "Firewall Rejected" : "Police queue note"}
                    </div>
                  </div>
                  <div className="p-5">
                    <p className={`text-[13px] leading-6 ${isRejected ? "text-[#FCA5A5]" : "text-[#8888A0]"}`}>
                      {result.agent_recommendation}
                    </p>
                  </div>
                </div>
              );
            })() : null}
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-16 border-t-2 border-[#252535] pt-8 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#444455]">
          Need to report a new incident?{" "}
          <Link className="text-[#FFE600] hover:underline" href="/citizen/grievance">Go to citizen portal</Link>
          {" "}· Emergency:{" "}
          <a className="text-[#EF4444] hover:underline" href="tel:100">100</a>
        </div>
      </main>
    </div>
  );
}

function DataCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="browser-card">
      <div className="browser-card-header border-b-2 border-[#252535]">
        <span className="browser-dot browser-dot-red" />
        <span className="browser-dot browser-dot-yellow" />
        <span className="browser-dot browser-dot-green" />
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#444455]">
          {icon}{label}
        </div>
        <div className="mt-2 text-[13px] font-bold text-[#F0F0F8]">{value}</div>
      </div>
    </div>
  );
}
