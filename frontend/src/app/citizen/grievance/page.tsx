"use client";

import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  Radio,
  Send,
  Shield,
  Siren,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { highSignalLocations } from "@/lib/bengaluru";
import { submitCitizenGrievance } from "@/lib/api";
import type { CitizenGrievance, CitizenGrievancePayload } from "@/types/prediction";

type FormState = {
  location_text: string;
  latitude:      string;
  longitude:     string;
  description:   string;
  reporter_phone: string;
};

const initial: FormState = {
  location_text:  "",
  latitude:       "",
  longitude:      "",
  description:    "",
  reporter_phone: "",
};

export default function CitizenGrievancePage() {
  const [form,        setForm]        = useState<FormState>(initial);
  const [errors,      setErrors]      = useState<Partial<FormState>>({});
  const [result,      setResult]      = useState<CitizenGrievance | null>(null);
  const [errMsg,      setErrMsg]      = useState("");
  const [locMsg,      setLocMsg]      = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [isLocating,  setIsLocating]  = useState(false);

  const completion = useMemo(() => {
    const fields: Array<keyof FormState> = ["location_text", "description"];
    const done   = fields.filter((f) => form[f].trim()).length;
    return Math.round((done / fields.length) * 100);
  }, [form]);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((c) => ({ ...c, [k]: v }));
    setErrors((c) => ({ ...c, [k]: undefined }));
  }

  function applyPreset(p: (typeof highSignalLocations)[number]) {
    setForm((c) => ({
      ...c,
      location_text: p.label,
      latitude:      String(p.latitude),
      longitude:     String(p.longitude),
    }));
    setErrors({});
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
        setLocMsg("GPS acquired — add nearest landmark name below.");
        setIsLocating(false);
      },
      () => { setLocMsg("GPS unavailable. Enter manually or pick a preset."); setIsLocating(false); },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );
  }

  function validate(): Partial<FormState> {
    const e: Partial<FormState> = {};
    if (!form.location_text.trim())                   e.location_text  = "Enter the nearest junction or landmark.";
    if (!form.description.trim())                     e.description    = "Describe what is happening.";
    else if (form.description.trim().length < 20)     e.description    = "At least 20 characters needed.";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(""); setResult(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) { setErrMsg("Fill the required fields before submitting."); return; }

    setSubmitting(true);
    const payload: CitizenGrievancePayload = {
      complaint_type: "other",
      location_text:  form.location_text.trim(),
      description:    form.description.trim(),
      latitude:       form.latitude  ? Number(form.latitude)  : undefined,
      longitude:      form.longitude ? Number(form.longitude) : undefined,
      reporter_phone: form.reporter_phone || undefined,
    };

    try {
      const res = await submitCitizenGrievance(payload);
      setResult(res);
      setForm(initial);
      setErrors({});
      setLocMsg("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { reason?: string; code?: string } | string } } })
        ?.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.code === "FIREWALL_REJECTED") {
        setErrors((c) => ({ ...c, description: `AI check: ${detail.reason}` }));
        setErrMsg("Your description doesn't match a traffic incident. Please describe the actual road situation.");
      } else {
        setErrMsg("Submission failed. Police intake may be temporarily unavailable.");
      }
    } finally {
      setSubmitting(false);
    }
  }

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
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#444455]">Citizen Incident Portal</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8888A0] transition hover:text-[#F0F0F8]" href="/citizen/predict">
              Get Estimate
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
      <div className="border-b-2 border-[#252535] px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[#FFE600]/25 bg-[#FFE600]/8 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">
            <Siren className="h-3.5 w-3.5" />
            Bengaluru Traffic Police · Public Intake
          </div>
          <h1 className="text-[36px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8] md:text-[44px]">
            Report a traffic incident.<br />
            <span className="text-[#FFE600]">Location + detailed description.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[14px] leading-7 text-[#8888A0]">
            Share your current or nearest location, then explain what happened and what
            is blocked — in English or Kannada. DRISHTI extracts the incident details;
            the police workflow handles the rest. No login required.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>

            {/* Location */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">
                  <MapPin className="h-3 w-3" /> Location
                </div>
                <button
                  className="ml-auto inline-flex items-center gap-1.5 rounded border-2 border-[#252535] bg-[#0F0F1A] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#F0F0F8] transition hover:border-[#FFE600] hover:text-[#FFE600] disabled:opacity-50"
                  disabled={isLocating || submitting}
                  onClick={captureGps}
                  type="button"
                >
                  {isLocating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
                  {isLocating ? "Acquiring…" : "Use GPS"}
                </button>
              </div>
              <div className="p-5">
                {/* Presets */}
                <p className="mb-3 text-[11px] text-[#444455]">Quick-pin a known location:</p>
                <div className="flex flex-wrap gap-2">
                  {highSignalLocations.map((p) => (
                    <button
                      className="rounded border-2 border-[#252535] bg-[#0F0F1A] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#8888A0] transition hover:border-[#FFE600]/40 hover:text-[#FFE600]"
                      disabled={submitting}
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

                {/* Location name + coords */}
                <div className="mt-4 space-y-3">
                  <F label="Nearest junction / landmark" required error={errors.location_text}>
                    <input
                      className={inp}
                      disabled={submitting}
                      placeholder="e.g. Silk Board Junction, Hebbal Flyover"
                      value={form.location_text}
                      onChange={(e) => set("location_text", e.target.value)}
                    />
                  </F>
                  <div className="grid grid-cols-2 gap-3">
                    <F label="Latitude">
                      <input className={inp} disabled={submitting} placeholder="12.9716" step="any" type="number" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} />
                    </F>
                    <F label="Longitude">
                      <input className={inp} disabled={submitting} placeholder="77.5946" step="any" type="number" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} />
                    </F>
                  </div>
                </div>
              </div>
            </div>

            {/* Incident */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">
                  <Shield className="h-3 w-3" /> Incident Description
                </div>
                <div className="ml-auto rounded border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 font-mono text-[9px] font-bold text-[#10B981]">
                  Kannada / English
                </div>
              </div>
              <div className="p-5 space-y-4">
                <F
                  label="What is happening on the road?"
                  required
                  hint="Describe what is blocked, how long, and if emergency vehicles are affected. Kannada supported."
                  error={errors.description}
                >
                  <textarea
                    className={`${inp} min-h-[130px] resize-y`}
                    disabled={submitting}
                    placeholder={"e.g. Heavy truck stalled near Hebbal flyover blocking two lanes.\n\nKannada: ಮರ ಬಿದ್ದಿದೆ ರಸ್ತೆ ಬ್ಲಾಕ್ ಆಗಿದೆ"}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </F>

                <div className="hidden">
                  <input className={inp} disabled={submitting} placeholder="9876543210" value={form.reporter_phone} onChange={(e) => set("reporter_phone", e.target.value)} />
                </div>

                {errMsg && (
                  <div className="flex items-center gap-2 rounded border-2 border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[13px] font-semibold text-[#EF4444]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />{errMsg}
                  </div>
                )}

                <button className="btn-primary mt-1 w-full justify-center" disabled={submitting} type="submit">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Transmitting…" : "Submit to police"}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

          </form>

          {/* Right sidebar */}
          <div className="space-y-5">

            {/* Completion */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">INTAKE COMPLETENESS</span>
                <span className={`ml-auto rounded border px-2 py-0.5 font-mono text-[9px] font-black uppercase ${completion >= 90 ? "border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]" : "border-[#FFE600]/30 bg-[#FFE600]/10 text-[#FFE600]"}`}>
                  {completion >= 90 ? "READY" : "NEEDS DETAILS"}
                </span>
              </div>
              <div className="p-5">
                <div className="font-mono text-[48px] font-black leading-none text-[#F0F0F8]">
                  {completion}<span className="text-[20px] text-[#8888A0]">%</span>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#252535]">
                  <div className="progress-fill" style={{ '--progress': `${completion}%` } as React.CSSProperties} />
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    { label: "Nearest location", done: Boolean(form.location_text.trim()) },
                    { label: "Current GPS (optional)", done: Boolean(form.latitude && form.longitude) },
                    { label: "Detailed description", done: form.description.trim().length >= 20 },
                  ].map((row) => (
                    <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] ${row.done ? "text-[#10B981]" : "text-[#444455]"}`} key={row.label}>
                      <span className={`h-1.5 w-1.5 rounded-full ${row.done ? "bg-[#10B981]" : "bg-[#444455]"}`} />
                      {row.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Success card */}
            {result && (
              <div className="browser-card border-2 border-[#10B981]/30">
                <div className="browser-card-header border-b-2 border-[#10B981]/30">
                  <span className="browser-dot browser-dot-red" />
                  <span className="browser-dot browser-dot-yellow" />
                  <span className="browser-dot browser-dot-green" />
                  <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#10B981]">
                    <CheckCircle2 className="h-3 w-3" /> Complaint Received
                  </div>
                </div>
                <div className="p-5">
                  <div className="rounded border-2 border-[#252535] bg-[#08080F] p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#444455]">Tracking Token</div>
                    <div className="mt-1 font-mono text-[20px] font-black text-[#FFE600]">{result.tracking_id}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded border-2 border-[#252535] bg-[#08080F] p-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#444455]">AI Severity</div>
                      <div className={`mt-1 text-[13px] font-black uppercase ${result.severity === "Critical" ? "text-[#EF4444]" : result.severity === "High" ? "text-[#F59E0B]" : result.severity === "Medium" ? "text-[#3B82F6]" : "text-[#10B981]"}`}>
                        {result.severity}
                      </div>
                    </div>
                    <div className="rounded border-2 border-[#252535] bg-[#08080F] p-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#444455]">Status</div>
                      <div className="mt-1 text-[12px] font-bold text-[#F0F0F8]">{result.status}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <a
                      className="btn-primary justify-center"
                      href={`https://wa.me/?text=${encodeURIComponent(`DRISHTI complaint registered. Token: ${result.tracking_id}. Track: http://localhost:3000/citizen/track?token=${result.tracking_id}`)}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Share on WhatsApp <ArrowRight className="h-4 w-4" />
                    </a>
                    <Link className="btn-ghost justify-center" href={`/citizen/track?token=${encodeURIComponent(result.tracking_id)}`}>
                      Track this complaint
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* What happens next */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <div className="ml-3 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">
                  <Radio className="h-3 w-3" /> What happens next
                </div>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { n: "01", t: "Description validation", d: "The system checks that the report describes a real traffic incident." },
                  { n: "02", t: "NLP extraction", d: "Cause, vehicles, road impact, and urgency are derived from your words." },
                  { n: "03", t: "Police workflow", d: "Command reviews the structured case and manages assignment through resolution." },
                ].map((s) => (
                  <div className="flex items-start gap-3" key={s.n}>
                    <div className="font-mono text-[11px] font-black text-[#FFE600] shrink-0 mt-0.5">{s.n}</div>
                    <div>
                      <div className="text-[12px] font-black uppercase tracking-[0.04em] text-[#F0F0F8]">{s.t}</div>
                      <div className="mt-0.5 text-[11px] text-[#8888A0]">{s.d}</div>
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

const inp = "w-full rounded border-2 border-[#252535] bg-[#08080F] px-3 py-2.5 text-[13px] text-[#F0F0F8] placeholder-[#444455] outline-none focus:border-[#FFE600] focus:shadow-[0_0_0_3px_rgba(255,230,0,0.08)] transition disabled:opacity-50";

function F({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8888A0]">
        {label}{required && <span className="text-[#FFE600]">*</span>}
      </label>
      {children}
      {error  ? <div className="mt-1 text-[11px] font-semibold text-[#EF4444]">{error}</div>
              : hint ? <div className="mt-1 text-[11px] text-[#444455]">{hint}</div>
              : null}
    </div>
  );
}
