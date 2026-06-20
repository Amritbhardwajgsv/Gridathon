"use client";

import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  Crosshair,
  Loader2,
  MapPin,
  Radio,
  Shield,
  ShieldAlert,
  ShieldOff,
  Siren,
  Users,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { predictIncident } from "@/lib/api";
import { highSignalLocations } from "@/lib/bengaluru";
import type { IncidentPredictionResponse } from "@/types/prediction";

type FormState = {
  description:           string;
  latitude:              string;
  longitude:             string;
  requires_road_closure: boolean;
};

type Stage = "idle" | "validating" | "analyzing" | "done" | "error";

const URGENCY_CONFIG: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  CRITICAL: { border: "border-[#EF4444]/40", bg: "bg-[#EF4444]/10", text: "text-[#EF4444]",  badge: "bg-[#EF4444]/15 text-[#EF4444]  border-[#EF4444]/30"  },
  HIGH:     { border: "border-[#F59E0B]/40", bg: "bg-[#F59E0B]/10", text: "text-[#F59E0B]",  badge: "bg-[#F59E0B]/15 text-[#F59E0B]  border-[#F59E0B]/30"  },
  MEDIUM:   { border: "border-[#3B82F6]/40", bg: "bg-[#3B82F6]/10", text: "text-[#3B82F6]",  badge: "bg-[#3B82F6]/15 text-[#3B82F6]  border-[#3B82F6]/30"  },
  LOW:      { border: "border-[#10B981]/40", bg: "bg-[#10B981]/10", text: "text-[#10B981]",  badge: "bg-[#10B981]/15 text-[#10B981]  border-[#10B981]/30"  },
};

const initialForm: FormState = {
  description:           "",
  latitude:              "12.9716",
  longitude:             "77.5946",
  requires_road_closure: false,
};

export default function PredictPage() {
  const [form,       setForm]       = useState<FormState>(initialForm);
  const [stage,      setStage]      = useState<Stage>("idle");
  const [result,     setResult]     = useState<IncidentPredictionResponse | null>(null);
  const [errMsg,     setErrMsg]     = useState("");
  const [locMsg,     setLocMsg]     = useState("");
  const [isLocating, setIsLocating] = useState(false);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((c) => ({ ...c, [field]: value }));
  }

  function applyPreset(p: (typeof highSignalLocations)[number]) {
    setForm((c) => ({ ...c, latitude: String(p.latitude), longitude: String(p.longitude) }));
    setLocMsg(`Pinned — ${p.label}`);
  }

  function captureGps() {
    setLocMsg("");
    if (!navigator.geolocation) { setLocMsg("Geolocation not supported."); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((c) => ({
          ...c,
          latitude:  pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocMsg("GPS acquired.");
        setIsLocating(false);
      },
      () => { setLocMsg("GPS unavailable. Enter coordinates manually."); setIsLocating(false); },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null); setErrMsg("");

    if (!form.description.trim() || form.description.trim().length < 10) {
      setErrMsg("Description must be at least 10 characters."); return;
    }
    try {
      setStage("validating");
      await new Promise((r) => setTimeout(r, 600));  // let UI render the stage
      setStage("analyzing");

      const res = await predictIncident({
        description:            form.description.trim(),
        latitude:               Number(form.latitude),
        longitude:              Number(form.longitude),
        requires_road_closure:  form.requires_road_closure,
      });

      setResult(res);
      setStage("done");
    } catch {
      setErrMsg("Analysis failed. Backend may be unavailable.");
      setStage("error");
    }
  }

  function reset() {
    setForm(initialForm);
    setResult(null);
    setStage("idle");
    setErrMsg("");
    setLocMsg("");
  }

  const urgencyConf = result?.urgency ? (URGENCY_CONFIG[result.urgency] ?? URGENCY_CONFIG.LOW) : null;
  const isRunning   = stage === "validating" || stage === "analyzing";

  return (
    <div className="min-h-screen bg-[#08080F] text-[#F0F0F8]">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b-2 border-[#252535] bg-[#08080F]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-3" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#FFE600]">
              <Radio className="h-4 w-4 text-[#08080F]" />
            </div>
            <div>
              <div className="font-mono text-[12px] font-bold tracking-[0.22em] text-[#FFE600]">DRISHTI</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#444455]">Incident Estimator</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8888A0] transition hover:text-[#F0F0F8]" href="/citizen/grievance">
              Report Incident
            </Link>
            <Link className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8888A0] transition hover:text-[#F0F0F8]" href="/citizen/track">
              Track Complaint
            </Link>
            <Link className="inline-flex items-center gap-2 rounded border-2 border-[#252535] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#F0F0F8] transition hover:border-[#FFE600] hover:text-[#FFE600]" href="/login">
              Police Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b-2 border-[#252535] px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[#FFE600]/25 bg-[#FFE600]/8 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">
            <Brain className="h-3.5 w-3.5" />
            ML Incident Intelligence · LLM Firewall Active
          </div>
          <h1 className="text-[36px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8] md:text-[44px]">
            Describe the incident.<br />
            <span className="text-[#FFE600]">Get a deployment estimate.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[14px] leading-7 text-[#8888A0]">
            Write one detailed description in <span className="text-[#F0F0F8] font-semibold">English or Kannada</span>.
            Include what happened, where it happened, vehicles involved, road blockage, and any
            emergency details you can see. DRISHTI extracts the fields; police handle the rest.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>

            {/* Location */}
            <div className="hidden">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">
                  <MapPin className="h-3 w-3" /> Location Pin
                </div>
                <button
                  className="ml-auto inline-flex items-center gap-1.5 rounded border-2 border-[#252535] bg-[#0F0F1A] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#F0F0F8] transition hover:border-[#FFE600] hover:text-[#FFE600] disabled:opacity-50"
                  disabled={isLocating || isRunning}
                  onClick={captureGps}
                  type="button"
                >
                  {isLocating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
                  {isLocating ? "Acquiring…" : "Use GPS"}
                </button>
              </div>
              <div className="p-5">
                <p className="mb-3 text-[11px] text-[#444455]">Quick-pin a known Bengaluru location:</p>
                <div className="flex flex-wrap gap-2">
                  {highSignalLocations.map((p) => (
                    <button
                      className="rounded border-2 border-[#252535] bg-[#0F0F1A] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#8888A0] transition hover:border-[#FFE600]/40 hover:text-[#FFE600]"
                      disabled={isRunning}
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      type="button"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {locMsg && (
                  <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-[#22D3EE]">
                    <Wifi className="h-3.5 w-3.5" />{locMsg}
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Latitude" required>
                    <input
                      className={darkInput}
                      disabled={isRunning}
                      placeholder="12.9716"
                      step="any"
                      type="number"
                      value={form.latitude}
                      onChange={(e) => update("latitude", e.target.value)}
                    />
                  </Field>
                  <Field label="Longitude" required>
                    <input
                      className={darkInput}
                      disabled={isRunning}
                      placeholder="77.5946"
                      step="any"
                      type="number"
                      value={form.longitude}
                      onChange={(e) => update("longitude", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Incident description */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">
                  <ShieldAlert className="h-3 w-3" /> Incident Description
                </div>
                <div className="ml-auto rounded border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#10B981]">
                  Kannada / English
                </div>
              </div>
              <div className="p-5 space-y-4">
                <Field
                  hint="Describe what is happening on the road. Both Kannada (ಕನ್ನಡ) and English are supported."
                  label="What is happening?"
                  required
                >
                  <textarea
                    className={`${darkInput} min-h-[130px] resize-y`}
                    disabled={isRunning}
                    placeholder={
                      "e.g. Heavy truck stalled near Hebbal flyover blocking two lanes.\n\nKannada: ಮರ ಬಿದ್ದಿದೆ ರಸ್ತೆ ಬ್ಲಾಕ್ ಆಗಿದೆ"
                    }
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>

                {/* Road closure toggle */}
                <label className="hidden">
                  <div
                    className={`relative h-5 w-10 rounded-full transition-colors ${form.requires_road_closure ? "bg-[#FFE600]" : "bg-[#252535]"}`}
                    onClick={() => update("requires_road_closure", !form.requires_road_closure)}
                  >
                    <div
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#08080F] shadow transition-transform ${form.requires_road_closure ? "translate-x-5" : "translate-x-0.5"}`}
                    />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-[#F0F0F8]">Road closure required</div>
                    <div className="text-[11px] text-[#444455]">Toggle if the incident is blocking the entire road</div>
                  </div>
                </label>

                {errMsg && (
                  <div className="flex items-center gap-2 rounded border-2 border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[13px] font-semibold text-[#EF4444]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />{errMsg}
                  </div>
                )}

                <button
                  className="btn-primary w-full justify-center"
                  disabled={isRunning}
                  type="submit"
                >
                  {isRunning
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Brain className="h-4 w-4" />
                  }
                  {stage === "validating" ? "Validating description…"
                    : stage === "analyzing" ? "Running ML analysis…"
                    : "Submit Description"}
                  {!isRunning && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

          </form>

          {/* Right panel */}
          <div className="space-y-5">

            {/* Processing steps widget */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">
                  <Activity className="h-3 w-3" /> Pipeline Status
                </div>
              </div>
              <div className="p-5 space-y-3">
                {([
                  {
                    id: "input",
                    label: "User input",
                    done: stage !== "idle",
                    active: stage === "idle" && form.description.length > 0,
                    icon: <ShieldAlert className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "firewall",
                    label: "LLM firewall validation",
                    done: stage === "done" || stage === "error",
                    active: stage === "validating",
                    icon: <Shield className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "ml",
                    label: "XGBoost ML inference",
                    done: stage === "done",
                    active: stage === "analyzing",
                    icon: <Brain className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "result",
                    label: "Deployment recommendation",
                    done: stage === "done",
                    active: false,
                    icon: <Users className="h-3.5 w-3.5" />,
                  },
                ] as const).map((step) => (
                  <div className="flex items-center gap-3" key={step.id}>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${step.done ? "border-[#10B981] bg-[#10B981]/15 text-[#10B981]" : step.active ? "border-[#FFE600] bg-[#FFE600]/10 text-[#FFE600]" : "border-[#252535] text-[#444455]"}`}>
                      {step.active
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : step.done
                        ? <CheckCircle2 className="h-3 w-3" />
                        : step.icon}
                    </div>
                    <span className={`text-[12px] font-semibold ${step.done ? "text-[#10B981]" : step.active ? "text-[#FFE600]" : "text-[#444455]"}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* REJECTED result */}
            {stage === "done" && result?.status === "REJECTED" && (
              <div className="browser-card border-2 border-[#EF4444]/40">
                <div className="browser-card-header border-b-2 border-[#EF4444]/30">
                  <span className="browser-dot browser-dot-red" />
                  <span className="browser-dot browser-dot-yellow" />
                  <span className="browser-dot browser-dot-green" />
                  <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#EF4444]">
                    <ShieldOff className="h-3 w-3" /> Firewall Rejected
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-3 rounded border-2 border-[#EF4444]/20 bg-[#EF4444]/8 px-4 py-3">
                    <XCircle className="h-5 w-5 shrink-0 text-[#EF4444] mt-0.5" />
                    <div>
                      <div className="text-[13px] font-bold text-[#EF4444]">Not a traffic incident</div>
                      <div className="mt-1 text-[12px] text-[#8888A0]">{result.firewall.reason}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-[12px] text-[#8888A0]">
                    Please describe an actual road traffic situation — breakdown, accident, tree fall, signal failure, congestion, flooding, etc.
                  </p>
                  <button className="btn-ghost mt-4 w-full justify-center" onClick={reset} type="button">
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* OK result */}
            {stage === "done" && result?.status === "OK" && urgencyConf && (
              <div className={`browser-card border-2 ${urgencyConf.border}`}>
                <div className={`browser-card-header border-b-2 ${urgencyConf.border}`}>
                  <span className="browser-dot browser-dot-red" />
                  <span className="browser-dot browser-dot-yellow" />
                  <span className="browser-dot browser-dot-green" />
                  <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#10B981]">
                    <CheckCircle2 className="h-3 w-3" /> Deployment Estimate
                  </div>
                  <span className={`ml-auto rounded border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.1em] ${urgencyConf.badge}`}>
                    {result.urgency}
                  </span>
                </div>
                <div className="p-5 space-y-3">

                  {/* Duration */}
                  <MetricRow
                    icon={<Clock className="h-4 w-4" />}
                    label="Estimated Duration"
                    value={`${result.estimated_duration_min} min`}
                    sub={`≈ ${result.estimated_duration_hrs} hrs`}
                    accent="text-[#FFE600]"
                  />

                  {/* Priority */}
                  <MetricRow
                    icon={<Siren className="h-4 w-4" />}
                    label="Priority Level"
                    value={result.priority ?? "—"}
                    accent={result.priority === "High" ? "text-[#F59E0B]" : "text-[#10B981]"}
                  />

                  {/* Personnel */}
                  <MetricRow
                    icon={<Users className="h-4 w-4" />}
                    label="Officers to Deploy"
                    value={`${result.personnel_to_deploy} officer${(result.personnel_to_deploy ?? 0) > 1 ? "s" : ""}`}
                    accent="text-[#22D3EE]"
                  />

                  {/* Urgency */}
                  <MetricRow
                    icon={<Zap className="h-4 w-4" />}
                    label="Response Urgency"
                    value={result.urgency ?? "—"}
                    accent={urgencyConf.text}
                  />

                  {/* Divider */}
                  <div className="border-t-2 border-[#252535] pt-3 space-y-2">
                    {result.detected_cause && result.detected_cause !== "others" && (
                      <InfoRow label="Detected cause"  value={result.detected_cause.replace(/_/g, " ")} />
                    )}
                    {result.detected_veh_type && result.detected_veh_type !== "unknown" && (
                      <InfoRow label="Vehicle type"    value={result.detected_veh_type.replace(/_/g, " ")} />
                    )}
                    <InfoRow label="Firewall"         value={result.firewall.reason} />
                  </div>

                  <div className="pt-1 flex gap-2">
                    <Link
                      className="btn-primary flex-1 justify-center text-center"
                      href="/citizen/grievance"
                    >
                      File Official Report <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button className="btn-ghost px-4" onClick={reset} type="button">
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">
                  <Brain className="h-3 w-3" /> How it works
                </div>
              </div>
              <div className="p-5 space-y-4">
                {([
                  {
                    n: "01",
                    t: "Multilingual embed",
                    d: "Your description (English or Kannada) is encoded using a 384-dim sentence transformer.",
                  },
                  {
                    n: "02",
                    t: "LLM firewall",
                    d: "Cosine similarity against traffic anchors. Borderline inputs escalate to Claude Haiku.",
                  },
                  {
                    n: "03",
                    t: "XGBoost inference",
                    d: "Duration regressor + priority classifier trained on Bengaluru ASTRAM incident data.",
                  },
                  {
                    n: "04",
                    t: "Deployment plan",
                    d: "Personnel count and urgency calculated from duration × priority × road closure.",
                  },
                ] as const).map((step) => (
                  <div className="flex items-start gap-3" key={step.n}>
                    <div className="font-mono text-[11px] font-black text-[#FFE600] shrink-0 mt-0.5">{step.n}</div>
                    <div>
                      <div className="text-[12px] font-black uppercase tracking-[0.04em] text-[#F0F0F8]">{step.t}</div>
                      <div className="mt-0.5 text-[11px] text-[#8888A0]">{step.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Local components ──────────────────────────────────────────────────────────

const darkInput =
  "w-full rounded border-2 border-[#252535] bg-[#08080F] px-3 py-2.5 text-[13px] text-[#F0F0F8] placeholder-[#444455] outline-none focus:border-[#FFE600] focus:shadow-[0_0_0_3px_rgba(255,230,0,0.08)] transition disabled:opacity-50";

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8888A0]">
        {label}{required && <span className="text-[#FFE600]">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11px] text-[#444455]">{hint}</div>}
    </div>
  );
}

function MetricRow({
  icon, label, value, sub, accent,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="flex items-center justify-between rounded border-2 border-[#252535] bg-[#08080F] px-4 py-3">
      <div className="flex items-center gap-2 text-[#8888A0]">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <div className="text-right">
        <div className={`font-mono text-[15px] font-black ${accent}`}>{value}</div>
        {sub && <div className="text-[10px] text-[#444455]">{sub}</div>}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#444455] shrink-0">{label}</span>
      <span className="text-[11px] text-[#8888A0] text-right capitalize">{value}</span>
    </div>
  );
}
